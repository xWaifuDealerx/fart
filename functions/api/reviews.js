// ============================================================
// api/reviews.js — $FARTPRINT app review registry
// ============================================================
// Stores Phantom-signed, per-app star ratings + comments.
//
//   GET  /api/reviews            → { reviews: [...], count: N, backend }
//   POST /api/reviews            → body = one review record:
//        { app, w, s, c, sig, msg, ts }
//        app = app key (e.g. "fartcup"), w = wallet, s = 1..5 stars,
//        c = comment, sig = base64 Phantom signature, msg = signed message,
//        ts = timestamp.  One review per wallet per app (re-posting updates).
//
// Storage:
//   • Vercel KV  — used automatically when KV_REST_API_URL + KV_REST_API_TOKEN
//                  env vars exist. Permanent. Recommended.
//   • ntfy.sh    — fallback when KV isn't configured (note: ~12h retention).
// ============================================================

const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_KEY   = "fart_reviews";

const NTFY_TOPIC = "fartprint-app-reviews-v1-r4m8qz";
const NTFY_BASE  = "https://ntfy.sh";

const hasKV = () => !!(KV_URL && KV_TOKEN);

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
  // ntfy keeps every event; collapse to the latest review per app+wallet.
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const reviews = await getReviews();
      res.status(200).json({ reviews, count: reviews.length, backend: hasKV() ? "kv" : "ntfy" });
      return;
    }

    if (req.method === "POST") {
      const rec = await readBody(req);
      if (!rec || typeof rec !== "object") {
        res.status(400).json({ ok: false, message: "Could not read JSON body." });
        return;
      }
      const stars = Number(rec.s);
      if (!rec.app || !rec.w || !(stars >= 1 && stars <= 5)) {
        res.status(400).json({ ok: false, message: "Record needs 'app', 'w', and 's' (1-5).", received: Object.keys(rec) });
        return;
      }
      // Trim comment to a sane size.
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
      res.status(200).json({ ok: true, backend: hasKV() ? "kv" : "ntfy", count: reviews.length });
      return;
    }

    res.status(405).json({ ok: false, message: "Use GET or POST." });
  } catch (e) {
    res.status(500).json({ ok: false, message: String((e && e.message) || e) });
  }
}
