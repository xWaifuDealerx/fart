// ============================================================
// functions/api/bags.js — Cloudflare proxy for the bags.fm API
// ============================================================
// Holds the production bags.fm API key + user UUID server-side, forwards
// arbitrary paths to the upstream API.
//
//   GET  /api/bags?path=/tokens
//   POST /api/bags?path=/tokens
//   GET  /api/bags?path=/tokens/{mint}
//   ?base=<url> overrides the upstream base if Bags ever moves hosts.
// ============================================================

const BAGS_API_KEY   = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID = "2737eeee-d1b1-4caa-a93e-476b97f2619a";
const BAGS_BASE_DEFAULT = "https://public-api-v2.bags.fm/api/v1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." } }, 405);
  }

  const url  = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (typeof path !== "string" || !path.startsWith("/")) {
    return json({ error: { code: "BAD_PATH", message: "A 'path' query parameter starting with '/' is required." } }, 400);
  }
  const base = url.searchParams.get("base") || BAGS_BASE_DEFAULT;

  try {
    const init = {
      method: request.method,
      headers: {
        "x-api-key":     BAGS_API_KEY,
        "Authorization": "Bearer " + BAGS_API_KEY,
        "x-user-id":     BAGS_USER_UUID,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
    };
    if (request.method === "POST") {
      const text = await request.text();
      init.body = text || "{}";
    }
    const upstream = await fetch(base + path, init);
    const text = await upstream.text();
    return new Response(text || "{}", { status: upstream.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return json({ error: { code: "PROXY_ERROR", message: String((e && e.message) || e) } }, 502);
  }
}
