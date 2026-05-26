// ============================================================
// api/bags.js — Vercel serverless proxy for the bags.fm API
// ============================================================
// Bags.fm requires an API key for any meaningful endpoint, and
// some endpoints don't send CORS headers — same problem we solved
// for Printr. This serverless function lives on the same origin as
// the site, so the browser can call it freely. It attaches the
// API key here (keeps it off the client).
//
// Usage from the browser:
//   GET  /api/bags?path=/tokens                 (list tokens)
//   POST /api/bags?path=/tokens                 (create a token, body = spec)
//   GET  /api/bags?path=/tokens/{mint}          (token detail)
//
// You can also override the upstream base URL at request time via
// ?base=<url> — useful if Bags changes their public API hostname.
// ============================================================

// Bags API key (Production)
const BAGS_API_KEY  = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID = "2737eeee-d1b1-4caa-a93e-476b97f2619a";

// Best-guess base URL — Bags publishes their public API under
// `public-api-v2.bags.fm`. If they ever move it, override with ?base=
// at the call site. Trailing slash off.
const BAGS_BASE_DEFAULT = "https://public-api-v2.bags.fm/api/v1";

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if(req.method === "OPTIONS"){ res.status(200).end(); return; }

  if(req.method !== "GET" && req.method !== "POST"){
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
    return;
  }

  const path = (req.query && req.query.path) || "";
  if(typeof path !== "string" || !path.startsWith("/")){
    res.status(400).json({ error: { code: "BAD_PATH", message: "A 'path' query parameter starting with '/' is required." } });
    return;
  }
  const base = (req.query && req.query.base) || BAGS_BASE_DEFAULT;

  try {
    const init = {
      method: req.method,
      headers: {
        "x-api-key":     BAGS_API_KEY,
        "Authorization": "Bearer " + BAGS_API_KEY,  // some Bags routes use this instead
        "x-user-id":     BAGS_USER_UUID,            // pass user UUID — needed by some routes
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
    };

    if(req.method === "POST"){
      init.body = typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(base + path, init);
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text || "{}");
  } catch(e){
    res.status(502).json({ error: { code: "PROXY_ERROR", message: String((e && e.message) || e) } });
  }
}
