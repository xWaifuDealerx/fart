// ============================================================
// api/printr.js — Vercel serverless proxy for the Printr API
// ============================================================
// The Printr Partner Preview API (api-preview.printr.money) does not
// send CORS headers, so a browser can't call it directly — every
// request fails with "Failed to fetch".
//
// This serverless function runs on the same origin as the site, so
// the browser can call it with no CORS issue. It forwards the request
// to Printr server-side, attaching the JWT here (keeping it off the
// client). Vercel auto-deploys any .js file in the /api folder.
//
// Usage from the browser:
//   POST /api/printr?path=/print            (body = token spec)
//   POST /api/printr?path=/print/quote      (body = quote spec)
//   GET  /api/printr?path=/tokens/{id}/deployments
// ============================================================

const PRINTR_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYWlseSJ9.Ml8JzU5AedtwjRHAy6qZBZB4FEyc9jy5CkXsLv__nRQ";
const PRINTR_BASE = "https://api-preview.printr.money/v0";

export default async function handler(req, res) {
  // Same-origin in practice, but harmless to be permissive.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
    return;
  }

  // The Printr API path to hit, e.g. "/print" or "/tokens/0x.../deployments"
  const path = (req.query && req.query.path) || "";
  if (typeof path !== "string" || !path.startsWith("/")) {
    res.status(400).json({
      error: { code: "BAD_PATH", message: "A 'path' query parameter starting with '/' is required." }
    });
    return;
  }

  try {
    const init = {
      method: req.method,
      headers: {
        "Authorization": "Bearer " + PRINTR_JWT,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };

    if (req.method === "POST") {
      // Vercel parses JSON bodies automatically; re-serialize for upstream.
      init.body = typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(PRINTR_BASE + path, init);
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text || "{}");
  } catch (e) {
    res.status(502).json({
      error: { code: "PROXY_ERROR", message: String((e && e.message) || e) }
    });
  }
}
