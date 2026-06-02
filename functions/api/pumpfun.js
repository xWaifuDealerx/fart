// ============================================================
// functions/api/pumpfun.js — Cloudflare proxy for pump.fun coins
// ============================================================
//   GET /api/pumpfun?mint={mintAddress}
//   → pump.fun coin JSON, including `usd_market_cap` and `image_uri`
// ============================================================
// pump.fun sits behind Cloudflare's bot-detection. Two things matter for
// avoiding a 403/403-but-empty-body:
//
//   1. The User-Agent must look like a real browser. Anything with "Bot",
//      "crawl", "spider", "fetch", etc. gets pattern-matched out.
//   2. A Referer (pump.fun's own origin) helps requests look like they
//      came from their own front-end app, which is the path through their
//      challenge that always passes.
//
// We also gently cache successful responses on Cloudflare's edge for a
// minute so a podium reload doesn't slam pump.fun with 48 fresh requests.
// ============================================================

const PUMP_BASES = [
  "https://frontend-api-v3.pump.fun/coins/",
  "https://frontend-api.pump.fun/coins/",
];

// Rotating pool of recent real-browser User-Agents — varying the UA per
// call reduces the chance that pump.fun's edge throttles us by string match.
const UA_POOL = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

function pickUa(mint){
  // Deterministic-but-distributed UA pick keyed on the mint, so the same
  // coin always uses the same UA (better for any per-coin caching pump.fun
  // does on its side) but the pool is spread across 48 requests.
  let h = 0;
  for(let i = 0; i < mint.length; i++) h = ((h * 31) + mint.charCodeAt(i)) | 0;
  return UA_POOL[Math.abs(h) % UA_POOL.length];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Edge-cache successful pump.fun responses for a minute. The CDN
      // serves repeat hits without ever touching pump.fun again. The 'sw'
      // (stale-while-revalidate) keeps things snappy through expiry.
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=60, stale-while-revalidate=120" : "no-store",
    },
  });
}

async function readBodySafe(res){
  try {
    const text = await res.text();
    if(!text || !text.trim() || text.trim() === "null") return null;
    return text;
  } catch(_){ return null; }
}

export async function onRequest({ request }) {
  if (request.method !== "GET") return json({ error: "Use GET." }, 405);

  const url  = new URL(request.url);
  const mint = (url.searchParams.get("mint") || "").trim();
  if (!mint) return json({ error: "A 'mint' query parameter is required." }, 400);

  const ua = pickUa(mint);
  let lastErr = null;

  for (const base of PUMP_BASES) {
    try {
      const upstream = await fetch(base + encodeURIComponent(mint), {
        // Real-browser-looking headers help us slip past pump.fun's
        // Cloudflare protection. The Referer is especially important —
        // it makes the request look like it came from their own app.
        headers: {
          "Accept":             "application/json, text/plain, */*",
          "Accept-Language":    "en-US,en;q=0.9",
          "User-Agent":         ua,
          "Referer":            "https://pump.fun/",
          "Origin":             "https://pump.fun",
          "Sec-Fetch-Dest":     "empty",
          "Sec-Fetch-Mode":     "cors",
          "Sec-Fetch-Site":     "same-site",
          "Cache-Control":      "no-cache",
        },
        // Cloudflare Workers fetch options — let the runtime cache the
        // upstream response so subsequent requests hit the cache directly.
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      if (!upstream.ok) { lastErr = "HTTP " + upstream.status; continue; }
      const text = await readBodySafe(upstream);
      if (!text) { lastErr = "empty body"; continue; }
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type":  "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
        },
      });
    } catch (e) {
      lastErr = String((e && e.message) || e);
    }
  }
  return json({ error: "pump.fun fetch failed", detail: lastErr }, 502);
}
