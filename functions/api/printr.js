// ============================================================
// functions/api/printr.js — Cloudflare proxy for the Printr API
// ============================================================
// The Printr Partner Preview API doesn't send CORS headers — same
// problem we solve for pump.fun + bags.fm. Runs on the same origin
// as the site, attaches the bearer JWT here so it never reaches the
// client, forwards to Printr server-side.
//
//   POST /api/printr?path=/print
//   POST /api/printr?path=/print/quote
//   GET  /api/printr?path=/tokens/{id}/deployments
// ============================================================

const PRINTR_JWT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYXJrc3UifQ.Oij3d5eNtIdcQ4fSUKIgZg-KKxtW-qHumOEVb95_aU0";
const PRINTR_BASE = "https://api-preview.printr.money/v0";

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

  try {
    const init = {
      method: request.method,
      headers: {
        "Authorization": "Bearer " + PRINTR_JWT,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
    };

    if (request.method === "POST") {
      const text = await request.text();
      init.body = text || "{}";
    }

    const upstream = await fetch(PRINTR_BASE + path, init);
    const text = await upstream.text();
    return new Response(text || "{}", {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: { code: "PROXY_ERROR", message: String((e && e.message) || e) } }, 502);
  }
}
