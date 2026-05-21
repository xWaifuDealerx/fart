// ============================================================
// api/pump-create.js — pump.fun metadata (IPFS) upload proxy
// ============================================================
// pump.fun's IPFS endpoint (pump.fun/api/ipfs) does not send CORS
// headers, so the browser can't upload token metadata directly. This
// serverless function runs on the same origin, rebuilds the multipart
// upload server-side, and returns the resulting metadata URI.
//
//   POST /api/pump-create
//     body: { name, symbol, description, imageBase64, twitter, telegram, website }
//   → { metadataUri: "https://ipfs..." }
//
// The browser then hands that URI to PumpPortal's /trade-local create
// call to build the on-chain transaction the user signs with Phantom.
// Requires a Node 18+ runtime (global fetch / FormData / Blob), which
// Vercel provides by default.
// ============================================================

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ message: "Use POST." }); return; }

  try {
    const body = await readBody(req);
    if (!body || typeof body !== "object") { res.status(400).json({ message: "Could not read JSON body." }); return; }

    const { name, symbol, description, imageBase64, twitter, telegram, website } = body;
    if (!name || !symbol || !imageBase64) {
      res.status(400).json({ message: "name, symbol and imageBase64 are required." });
      return;
    }

    // Decode the base64 image (strip any data: prefix).
    const b64 = String(imageBase64).replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");

    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "image/png" }), "image.png");
    fd.append("name", String(name));
    fd.append("symbol", String(symbol));
    fd.append("description", String(description || ""));
    fd.append("twitter", String(twitter || ""));
    fd.append("telegram", String(telegram || ""));
    fd.append("website", String(website || ""));
    fd.append("showName", "true");

    const up = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: fd,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FartDerivativesBot/1.0)" },
    });
    const text = await up.text();
    if (!up.ok) {
      res.status(502).json({ message: "pump.fun IPFS HTTP " + up.status, detail: text.slice(0, 240) });
      return;
    }
    let j = {};
    try { j = JSON.parse(text); } catch (_) {}
    const metadataUri = j.metadataUri || j.uri || (j.metadata && j.metadata.metadataUri) || null;
    if (!metadataUri) {
      res.status(502).json({ message: "pump.fun returned no metadataUri", detail: text.slice(0, 240) });
      return;
    }
    res.status(200).json({ metadataUri });
  } catch (e) {
    res.status(500).json({ message: String((e && e.message) || e) });
  }
}
