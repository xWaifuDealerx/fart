// ============================================================
// api/fartforum.js — FartForum backend (threads + posts)
// ============================================================
// A classic forum where every post (a new thread or a reply) costs the
// poster 1 $FARTPRINT, burned on-chain in the browser before the message
// is submitted here. This endpoint stores the messages and tracks the
// running total of tokens burned through the forum.
//
//   GET  /api/fartforum            → { threads:[...], burned:N, backend }
//   GET  /api/fartforum?thread=ID  → { thread:{...}, posts:[...], burned, backend }
//   POST /api/fartforum            → body:
//        { kind:"thread", title, text, author, sig }   (opens a thread)
//        { kind:"reply",  thread, text, author, sig }   (replies to one)
//      → { ok:true, id, burned, verified, backend }
//
// Anti-abuse: each burn transaction signature can be used exactly once
// (one post per burn). The burn is also best-effort verified on-chain.
//
// Storage:
//   • Vercel KV  — used when KV_REST_API_URL + KV_REST_API_TOKEN exist.
//   • ntfy.sh    — fallback when KV isn't configured.
// The model is event-sourced: every post is one event; threads and the
// burn total are reconstructed from the event log, so both backends agree.
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const EVENTS_KEY = "fart_forum_events";   // KV list of event JSON strings
const SIGS_KEY   = "fart_forum_sigs";     // KV set of used burn signatures
const MAX_EVENTS = 8000;                  // keep the list bounded

const NTFY_TOPIC = "fartprint-forum-v1-9k3xq";
const NTFY_BASE  = "https://ntfy.sh";

// $FARTPRINT mint — must match burns.js
const MINT = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

const hasKV = () => !!(KV_URL && KV_TOKEN);

// --- Vercel KV / Upstash REST helper ------------------------------------
async function kv(command) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { "Authorization": "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  let j = null;
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error("KV HTTP " + r.status + (j && j.error ? " — " + j.error : ""));
  if (j && j.error) throw new Error("KV error — " + j.error);
  return j ? j.result : null;
}

// --- Robust request-body reader -----------------------------------------
async function readBody(req) {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (_) { return null; } }
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// --- Event log read/write ------------------------------------------------
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

// Returns true if this signature is new (and reserves it); false if already used.
async function reserveSig(sig, events) {
  if (hasKV()) {
    const added = await kv(["SADD", SIGS_KEY, sig]);
    return Number(added) === 1;
  }
  // ntfy fallback: scan existing events for the signature.
  return !(events || []).some((e) => e && e.sig === sig);
}

async function appendEvent(evt) {
  if (hasKV()) {
    await kv(["RPUSH", EVENTS_KEY, JSON.stringify(evt)]);
    await kv(["LTRIM", EVENTS_KEY, String(-MAX_EVENTS), "-1"]);
    return;
  }
  await fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evt),
  });
}

// --- Reconstruct threads/posts from the event log ------------------------
function reconstruct(events) {
  const threads = new Map();
  let burned = 0;
  for (const e of events) {
    if (!e || !e.kind) continue;
    burned += 1; // every event is exactly one burned token
    if (e.kind === "thread") {
      threads.set(e.id, {
        id: e.id,
        title: e.title || "(untitled)",
        author: e.author || "anon",
        ts: e.ts,
        lastTs: e.ts,
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

// --- Best-effort on-chain burn verification ------------------------------
// Confirms the signature really burns the $FARTPRINT mint. Never hard-fails
// the post on RPC trouble (returns null) so the forum keeps working; the
// result is only used to show a "verified burn" badge.
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
      if (!tx) continue;                       // not found yet on this RPC → try next
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
      return false; // tx exists but no matching $FARTPRINT burn
    } catch (_) { /* try next RPC */ }
  }
  return null; // couldn't verify (RPC unavailable) — accept, badge as unverified
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Handler ------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const backend = hasKV() ? "kv" : "ntfy";

    if (req.method === "GET") {
      const events = await getEvents();
      const { threads, burned } = reconstruct(events);
      const wantThread = req.query && req.query.thread;
      if (wantThread) {
        const t = threads.find((x) => x.id === wantThread);
        if (!t) { res.status(404).json({ ok: false, message: "Thread not found.", burned, backend }); return; }
        res.status(200).json({ ok: true, thread: { id: t.id, title: t.title, author: t.author, ts: t.ts }, posts: t.posts, burned, backend });
        return;
      }
      // Thread list: newest activity first, with a light summary (no full posts).
      const list = threads
        .map((t) => ({ id: t.id, title: t.title, author: t.author, ts: t.ts, lastTs: t.lastTs, replies: t.posts.length - 1, preview: (t.posts[0] && t.posts[0].text ? String(t.posts[0].text).slice(0, 140) : "") }))
        .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      res.status(200).json({ ok: true, threads: list, burned, backend });
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (!body || typeof body !== "object") { res.status(400).json({ ok: false, message: "Could not read JSON body." }); return; }

      const kind = body.kind === "reply" ? "reply" : "thread";
      const author = typeof body.author === "string" ? body.author.trim() : "";
      const sig = typeof body.sig === "string" ? body.sig.trim() : "";
      const text = typeof body.text === "string" ? body.text.trim() : "";

      if (!author) { res.status(400).json({ ok: false, message: "Connect a wallet ('author' required)." }); return; }
      if (!sig || sig.length < 32) { res.status(400).json({ ok: false, message: "A burn transaction signature is required." }); return; }
      if (!text) { res.status(400).json({ ok: false, message: "Message text is required." }); return; }
      if (text.length > 5000) { res.status(400).json({ ok: false, message: "Message too long (5000 char max)." }); return; }

      const events = await getEvents();

      // One post per burn: a signature can only be used once.
      const fresh = await reserveSig(sig, events);
      if (!fresh) { res.status(409).json({ ok: false, message: "That burn has already been used to post." }); return; }

      const verified = await verifyBurn(sig, author);

      const ts = Date.now();
      let evt;
      if (kind === "thread") {
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) { res.status(400).json({ ok: false, message: "A thread needs a title." }); return; }
        if (title.length > 160) { res.status(400).json({ ok: false, message: "Title too long (160 char max)." }); return; }
        evt = { kind: "thread", id: newId(), title, text, author, sig, ts, verified: verified === true };
      } else {
        const thread = typeof body.thread === "string" ? body.thread.trim() : "";
        if (!thread) { res.status(400).json({ ok: false, message: "A reply needs a 'thread' id." }); return; }
        const exists = events.some((e) => e && e.kind === "thread" && e.id === thread);
        if (!exists) { res.status(404).json({ ok: false, message: "Thread not found." }); return; }
        evt = { kind: "reply", id: newId(), thread, text, author, sig, ts, verified: verified === true };
      }

      await appendEvent(evt);

      const after = reconstruct(events.concat([evt]));
      res.status(200).json({ ok: true, id: kind === "thread" ? evt.id : evt.thread, burned: after.burned, verified, backend });
      return;
    }

    res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
}
