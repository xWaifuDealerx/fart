// ============================================================
// functions/api/fartforum.js — FartForum backend (threads + posts)
// ============================================================
//   GET  /api/fartforum            → { threads:[...], burned:N, backend }
//   GET  /api/fartforum?thread=ID  → { thread:{...}, posts:[...], burned, backend }
//   POST /api/fartforum            → { kind:"thread"|"reply", ... }
// ============================================================

const EVENTS_KEY = "fart_forum_events";
const SIGS_KEY   = "fart_forum_sigs";
const MAX_EVENTS = 8000;
const NTFY_TOPIC = "fartprint-forum-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

const MINT = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
async function readBody(request) { try { return await request.json(); } catch { return null; } }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

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

  async function getEvents() {
    if (hasKV()) {
      const raw = await kv(["LRANGE", EVENTS_KEY, "0", "-1"]);
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
        if (evt.event === "message" && evt.message) { try { out.push(JSON.parse(evt.message)); } catch (_) {} }
      } catch (_) {}
    }
    return out;
  }

  async function reserveSig(sig, events) {
    if (hasKV()) {
      const added = await kv(["SADD", SIGS_KEY, sig]);
      return Number(added) === 1;
    }
    return !(events || []).some((e) => e && e.sig === sig);
  }

  async function appendEvent(evt) {
    if (hasKV()) {
      await kv(["RPUSH", EVENTS_KEY, JSON.stringify(evt)]);
      await kv(["LTRIM", EVENTS_KEY, String(-MAX_EVENTS), "-1"]);
      return;
    }
    await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(evt),
    });
  }

  return { hasKV, getEvents, reserveSig, appendEvent };
}

function reconstruct(events) {
  const threads = new Map();
  let burned = 0;
  for (const e of events) {
    if (!e || !e.kind) continue;
    burned += 1;
    if (e.kind === "thread") {
      threads.set(e.id, {
        id: e.id, title: e.title || "(untitled)", author: e.author || "anon",
        ts: e.ts, lastTs: e.ts,
        posts: [{ author: e.author || "anon", text: e.text || "", ts: e.ts, sig: e.sig, verified: !!e.verified }],
      });
    } else if (e.kind === "reply") {
      const t = threads.get(e.thread);
      if (t) {
        t.posts.push({ author: e.author || "anon", text: e.text || "", ts: e.ts, sig: e.sig, verified: !!e.verified });
        t.lastTs = e.ts;
      }
    }
  }
  return { threads: Array.from(threads.values()), burned };
}

async function verifyBurn(sig, author) {
  for (const rpc of RPCS) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
        }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const tx = j && j.result;
      if (!tx) continue;
      const groups = [];
      const msg = tx.transaction && tx.transaction.message;
      if (msg && Array.isArray(msg.instructions)) groups.push(msg.instructions);
      const inner = tx.meta && tx.meta.innerInstructions;
      if (Array.isArray(inner)) for (const ig of inner) if (Array.isArray(ig.instructions)) groups.push(ig.instructions);
      for (const ixs of groups) {
        for (const ix of ixs) {
          const p = ix && ix.parsed;
          if (p && (p.type === "burn" || p.type === "burnChecked") && ix.program === "spl-token") {
            const info = p.info || {};
            if (info.mint === MINT && (!author || info.authority === author || info.owner === author)) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (_) {}
  }
  return null;
}

export async function onRequest({ request, env }) {
  const { hasKV, getEvents, reserveSig, appendEvent } = makeStore(env);

  try {
    const backend = hasKV() ? "kv" : "ntfy";
    const url = new URL(request.url);

    if (request.method === "GET") {
      const events = await getEvents();
      const { threads, burned } = reconstruct(events);
      const wantThread = url.searchParams.get("thread");
      if (wantThread) {
        const t = threads.find((x) => x.id === wantThread);
        if (!t) return json({ ok: false, message: "Thread not found.", burned, backend }, 404);
        return json({ ok: true, thread: { id: t.id, title: t.title, author: t.author, ts: t.ts }, posts: t.posts, burned, backend });
      }
      const list = threads
        .map((t) => ({
          id: t.id, title: t.title, author: t.author, ts: t.ts, lastTs: t.lastTs,
          replies: t.posts.length - 1,
          preview: (t.posts[0] && t.posts[0].text ? String(t.posts[0].text).slice(0, 140) : ""),
        }))
        .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return json({ ok: true, threads: list, burned, backend });
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      if (!body || typeof body !== "object") return json({ ok: false, message: "Could not read JSON body." }, 400);

      const kind   = body.kind === "reply" ? "reply" : "thread";
      const author = typeof body.author === "string" ? body.author.trim() : "";
      const sig    = typeof body.sig === "string" ? body.sig.trim() : "";
      const text   = typeof body.text === "string" ? body.text.trim() : "";

      if (!author) return json({ ok: false, message: "Connect a wallet ('author' required)." }, 400);
      if (!sig || sig.length < 32) return json({ ok: false, message: "A burn transaction signature is required." }, 400);
      if (!text) return json({ ok: false, message: "Message text is required." }, 400);
      if (text.length > 5000) return json({ ok: false, message: "Message too long (5000 char max)." }, 400);

      const events = await getEvents();
      const fresh = await reserveSig(sig, events);
      if (!fresh) return json({ ok: false, message: "That burn has already been used to post." }, 409);

      const verified = await verifyBurn(sig, author);
      const ts = Date.now();
      let evt;
      if (kind === "thread") {
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) return json({ ok: false, message: "A thread needs a title." }, 400);
        if (title.length > 160) return json({ ok: false, message: "Title too long (160 char max)." }, 400);
        evt = { kind: "thread", id: newId(), title, text, author, sig, ts, verified: verified === true };
      } else {
        const thread = typeof body.thread === "string" ? body.thread.trim() : "";
        if (!thread) return json({ ok: false, message: "A reply needs a 'thread' id." }, 400);
        const exists = events.some((e) => e && e.kind === "thread" && e.id === thread);
        if (!exists) return json({ ok: false, message: "Thread not found." }, 404);
        evt = { kind: "reply", id: newId(), thread, text, author, sig, ts, verified: verified === true };
      }

      await appendEvent(evt);
      const after = reconstruct(events.concat([evt]));
      return json({ ok: true, id: kind === "thread" ? evt.id : evt.thread, burned: after.burned, verified, backend });
    }

    return json({ ok: false, message: "Use GET or POST." }, 405);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
