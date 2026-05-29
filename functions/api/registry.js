// ============================================================
// functions/api/registry.js — FART derivatives registry
// ============================================================
//   GET  /api/registry  → { tokens: [...], count: N, backend: "kv" | "ntfy" }
//   POST /api/registry  → body = { tid, sym, name, img, by, tx, ts, ma }
//                       → { ok: true, backend, count }
// ============================================================

const KV_KEY     = "fart_derivatives";
const NTFY_TOPIC = "fartprint-derivatives-mints-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

function makeStore(env) {
  const hasKV = () => !!(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

  async function kv(command) {
    const r = await fetch(env.KV_REST_API_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.KV_REST_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    let j = null;
    try { j = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error("KV HTTP " + r.status + (j && j.error ? " — " + j.error : ""));
    if (j && j.error) throw new Error("KV error — " + j.error);
    return j ? j.result : null;
  }

  async function getTokens() {
    if (hasKV()) {
      const raw = await kv(["HVALS", KV_KEY]);
      return (raw || []).map((s) => { try { return JSON.parse(s); } catch (_) { return null; } }).filter(Boolean);
    }
    const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
    if (!r.ok) return [];
    const text = await r.text();
    if (!text.trim()) return [];
    const out = [];
    for (const line of text.trim().split("\n")) {
      try {
        const evt = JSON.parse(line);
        if (evt.event === "message" && evt.message) {
          try { out.push(JSON.parse(evt.message)); } catch (_) {}
        }
      } catch (_) {}
    }
    return out;
  }

  async function putToken(rec) {
    if (hasKV()) {
      await kv(["HSET", KV_KEY, String(rec.tid), JSON.stringify(rec)]);
      return;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
  }

  return { hasKV, getTokens, putToken };
}

export async function onRequest({ request, env }) {
  const { hasKV, getTokens, putToken } = makeStore(env);

  try {
    if (request.method === "GET") {
      const tokens = await getTokens();
      return json({ tokens, count: tokens.length, backend: hasKV() ? "kv" : "ntfy" });
    }

    if (request.method === "POST") {
      const rec = await readBody(request);
      if (!rec || typeof rec !== "object") return json({ ok: false, message: "Could not read JSON body." }, 400);
      if (!rec.tid || !rec.sym) {
        return json({ ok: false, message: "Record must include 'tid' and 'sym'.", received: Object.keys(rec) }, 400);
      }
      await putToken(rec);
      const tokens = await getTokens();
      return json({ ok: true, backend: hasKV() ? "kv" : "ntfy", count: tokens.length });
    }

    return json({ ok: false, message: "Use GET or POST." }, 405);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
