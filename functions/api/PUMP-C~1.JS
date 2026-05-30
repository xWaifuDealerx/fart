// ============================================================
// functions/api/pump-create.js — pump.fun metadata (IPFS) upload proxy
// ============================================================
//   POST /api/pump-create
//     body: { name, symbol, description, imageBase64, twitter, telegram, website }
//   → { metadataUri: "https://ipfs..." }
// ============================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function readBody(request) {
  try { return await request.json(); }
  catch { return null; }
}

// Base64 → Uint8Array (Cloudflare Workers don't have Node's Buffer)
function b64ToBytes(b64) {
  const clean = String(b64).replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function onRequest({ request }) {
  if (request.method !== "POST") return json({ message: "Use POST." }, 405);

  try {
    const body = await readBody(request);
    if (!body || typeof body !== "object") return json({ message: "Could not read JSON body." }, 400);

    const { name, symbol, description, imageBase64, twitter, telegram, website } = body;
    if (!name || !symbol || !imageBase64) {
      return json({ message: "name, symbol and imageBase64 are required." }, 400);
    }

    const bytes = b64ToBytes(imageBase64);

    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: "image/png" }), "image.png");
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
      return json({ message: "pump.fun IPFS HTTP " + up.status, detail: text.slice(0, 240) }, 502);
    }
    let j = {};
    try { j = JSON.parse(text); } catch (_) {}
    const metadataUri = j.metadataUri || j.uri || (j.metadata && j.metadata.metadataUri) || null;
    if (!metadataUri) {
      return json({ message: "pump.fun returned no metadataUri", detail: text.slice(0, 240) }, 502);
    }
    return json({ metadataUri });
  } catch (e) {
    return json({ message: String((e && e.message) || e) }, 500);
  }
}
