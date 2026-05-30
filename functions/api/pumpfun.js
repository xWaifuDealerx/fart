// ============================================================
// functions/api/pumpfun.js — Cloudflare proxy for pump.fun coins
// ============================================================
//   GET /api/pumpfun?mint={mintAddress}
//   → pump.fun coin JSON, including `usd_market_cap`
// ============================================================

const PUMP_BASES = [
  "https://frontend-api-v3.pump.fun/coins/",
  "https://frontend-api.pump.fun/coins/",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function onRequest({ request }) {
  if (request.method !== "GET") return json({ error: "Use GET." }, 405);

  const url  = new URL(request.url);
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return json({ error: "A 'mint' query parameter is required." }, 400);

  let lastErr = null;
  for (const base of PUMP_BASES) {
    try {
      const upstream = await fetch(base + encodeURIComponent(mint), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; FartCupBot/1.0)",
        },
      });
      if (!upstream.ok) { lastErr = "HTTP " + upstream.status; continue; }
      const text = await upstream.text();
      if (!text || text.trim() === "" || text.trim() === "null") { lastErr = "empty body"; continue; }
      return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      lastErr = String((e && e.message) || e);
    }
  }
  return json({ error: "pump.fun fetch failed", detail: lastErr }, 502);
}
