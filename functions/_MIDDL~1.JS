// ============================================================
// functions/_middleware.js — Global CORS + cache headers
// ============================================================
// Runs before every Cloudflare Pages Function. Handles the OPTIONS
// preflight uniformly and applies "no-store" + CORS to every response
// so each function can return a bare `new Response(...)` without
// CORS boilerplate.
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-admin-secret, x-api-key, x-user-id, authorization",
};

export async function onRequest({ request, next }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  const res = await next();
  // Apply CORS + no-store to whatever the function returned.
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
