// ============================================================
// functions/api/reviews.js — $FARTPRINT app review registry
// ============================================================
//   GET  /api/reviews → { reviews: [...], count, backend }
//   POST /api/reviews → body = { app, w, s, c, sig, msg, ts }
// ============================================================

const KV_KEY     = "fart_reviews";
const NTFY_TOPIC = "fartprint-app-reviews-v1-r4m8qz";
const NTFY_BASE  = "https://ntfy.sh";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

function makeKv(env) {
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

  async function getReviews() {
    if (hasKV()) {
      const raw = await kv(["HVALS", KV_KEY]);
      return (raw || [])
        .map((s) => { try { return JSON.parse(s); } catch (_) { return null; } })
        .filter(Boolean);
    }
    const r = await fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=all`);
    if (!r.ok) return [];
    const text = await r.text();
    if (!text.trim()) return [];
    const latest = new Map();
    for (const line of text.trim().split("\n")) {
      try {
        const evt = JSON.parse(line);
        if (evt.event === "message" && evt.message) {
          try {
            const rec = JSON.parse(evt.message);
            if (rec && rec.app && rec.w) {
              const k = rec.app + "|" + rec.w;
              const prev = latest.get(k);
              if (!prev || (rec.ts || 0) >= (prev.ts || 0)) latest.set(k, rec);
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    return [...latest.values()];
  }

  async function putReview(rec) {
    const field = String(rec.app) + "|" + String(rec.w);
    if (hasKV()) {
      await kv(["HSET", KV_KEY, field, JSON.stringify(rec)]);
      return;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rec),
    });
  }

  return { hasKV, getReviews, putReview };
}

export async function onRequest({ request, env }) {
  const { hasKV, getReviews, putReview } = makeKv(env);

  try {
    if (request.method === "GET") {
      const reviews = await getReviews();
      return json({ reviews, count: reviews.length, backend: hasKV() ? "kv" : "ntfy" });
    }

    if (request.method === "POST") {
      const rec = await readBody(request);
      if (!rec || typeof rec !== "object") return json({ ok: false, message: "Could not read JSON body." }, 400);
      const stars = Number(rec.s);
      if (!rec.app || !rec.w || !(stars >= 1 && stars <= 5)) {
        return json({ ok: false, message: "Record needs 'app', 'w', and 's' (1-5).", received: Object.keys(rec) }, 400);
      }
      const clean = {
        app: String(rec.app).slice(0, 40),
        w: String(rec.w).slice(0, 64),
        s: Math.round(stars),
        c: String(rec.c || "").slice(0, 500),
        sig: String(rec.sig || "").slice(0, 200),
        msg: String(rec.msg || "").slice(0, 800),
        ts: Number(rec.ts) || Date.now(),
      };
      await putReview(clean);
      const reviews = await getReviews();
      return json({ ok: true, backend: hasKV() ? "kv" : "ntfy", count: reviews.length });
    }

    return json({ ok: false, message: "Use GET or POST." }, 405);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
