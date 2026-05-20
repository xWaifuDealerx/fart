// ============================================================
// api/pumpfun.js — Vercel serverless proxy for the pump.fun coin API
// ============================================================
// DexScreener only lists a token once it has a tradeable pair, so
// pump.fun coins that are still on the bonding curve show no market
// cap there. pump.fun's own API has the live market cap, but it does
// not send CORS headers (and sits behind Cloudflare), so a browser
// can't call it directly.
//
// This function runs on the same origin as the site and forwards the
// request to pump.fun server-side, returning the JSON with permissive
// CORS headers. Vercel auto-deploys any .js file in the /api folder.
//
// Usage from the browser:
//   GET /api/pumpfun?mint={mintAddress}
//   → pump.fun coin JSON, including `usd_market_cap`
// ============================================================

const PUMP_BASES = [
  "https://frontend-api-v3.pump.fun/coins/",
  "https://frontend-api.pump.fun/coins/",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET." });
    return;
  }

  const mint = (req.query && req.query.mint) || "";
  if (typeof mint !== "string" || !mint.trim()) {
    res.status(400).json({ error: "A 'mint' query parameter is required." });
    return;
  }

  let lastErr = null;
  for (const base of PUMP_BASES) {
    try {
      const upstream = await fetch(base + encodeURIComponent(mint.trim()), {
        headers: {
          "Accept": "application/json",
          // pump.fun's Cloudflare edge rejects requests with no UA.
          "User-Agent": "Mozilla/5.0 (compatible; FartCupBot/1.0)",
        },
      });
      if (!upstream.ok) { lastErr = "HTTP " + upstream.status; continue; }
      const text = await upstream.text();
      // pump.fun returns a JSON object for a valid mint; skip empty/non-JSON.
      if (!text || text.trim() === "" || text.trim() === "null") { lastErr = "empty body"; continue; }
      res.status(200);
      res.setHeader("Content-Type", "application/json");
      res.send(text);
      return;
    } catch (e) {
      lastErr = String((e && e.message) || e);
    }
  }

  res.status(502).json({ error: "pump.fun fetch failed", detail: lastErr });
}
