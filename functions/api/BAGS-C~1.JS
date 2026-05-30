// ============================================================
// functions/api/bags-create.js — bags.fm token-create proxy
// ============================================================
//   POST /api/bags-create
//     body: { name, symbol, description, imageBase64, twitter, telegram,
//             website, launchpadConfigKey, creator, initialBuySol }
//   → { ok, metadataUri, txBase64, mint }
// ============================================================

const BAGS_API_KEY   = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID = "2737eeee-d1b1-4caa-a93e-476b97f2619a";
const BAGS_BASES = [
  "https://public-api-v2.bags.fm/api/v1",
  "https://public-api.bags.fm/api/v1",
  "https://api.bags.fm/v1",
  "https://api.bags.fm",
];
const METADATA_UPLOAD_PATHS = [
  "/tokens/metadata",
  "/tokens/metadata/upload",
  "/metadata",
  "/upload/metadata",
  "/ipfs/metadata",
];
const TOKEN_CREATE_PATHS = [
  "/tokens/create",
  "/tokens",
  "/tokens/create-local",
  "/tokens/create/local",
  "/launchpad/create",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function bagsHeaders(extra) {
  return Object.assign({
    "x-api-key":     BAGS_API_KEY,
    "Authorization": "Bearer " + BAGS_API_KEY,
    "x-user-id":     BAGS_USER_UUID,
    "Accept":        "application/json",
  }, extra || {});
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

async function tryPaths(paths, payload) {
  let lastErr = null;
  for (const base of BAGS_BASES) {
    for (const p of paths) {
      try {
        const r = await fetch(base + p, {
          method: "POST",
          headers: bagsHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        let j = null;
        try { j = text ? JSON.parse(text) : null; } catch (_) {}
        if (r.ok) {
          console.log("[bags-create] ok:", base + p);
          return { ok: true, path: p, base, json: j, raw: text };
        }
        lastErr = { base, path: p, status: r.status, body: (text || "").slice(0, 300) };
      } catch (e) {
        lastErr = { base, path: p, error: String((e && e.message) || e) };
      }
    }
  }
  return { ok: false, error: lastErr };
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, 405);
  }

  try {
    const body = await readBody(request);
    if (!body || typeof body !== "object") {
      return json({ error: { code: "BAD_BODY", message: "JSON body required." } }, 400);
    }
    const {
      name, symbol, description = "",
      imageBase64,
      twitter = "", telegram = "", website = "",
      launchpadConfigKey, creator,
      initialBuySol = 0,
    } = body;

    if (!name || !symbol || !imageBase64) {
      return json({ error: { code: "MISSING_FIELDS", message: "name, symbol, imageBase64 are required." } }, 400);
    }

    // 1) Metadata upload
    const metaPayload = {
      name, symbol, description,
      image: imageBase64,
      image_base64: imageBase64,
      twitter, telegram, website,
      external_url: website,
      userId: BAGS_USER_UUID,
      user_id: BAGS_USER_UUID,
    };
    const metaRes = await tryPaths(METADATA_UPLOAD_PATHS, metaPayload);
    let metadataUri = null;
    if (metaRes.ok && metaRes.json) {
      metadataUri = metaRes.json.metadataUri || metaRes.json.metadata_url || metaRes.json.uri || metaRes.json.url || null;
    }

    // 2) Token create
    const createPayload = {
      name, symbol, description,
      metadataUri,
      image: imageBase64,
      twitter, telegram, website,
      launchpadConfigKey,
      configKey: launchpadConfigKey,
      platformConfig: launchpadConfigKey,
      feeConfigPubkey: launchpadConfigKey,
      userId: BAGS_USER_UUID,
      user_id: BAGS_USER_UUID,
      creator,
      payer: creator,
      walletAddress: creator,
      initialBuySol,
      action: "create",
    };
    const createRes = await tryPaths(TOKEN_CREATE_PATHS, createPayload);
    if (!createRes.ok) {
      return json({
        ok: false,
        error: {
          code: "BAGS_CREATE_FAILED",
          message: "None of the candidate Bags create endpoints accepted the request. Check functions/api/bags-create.js TOKEN_CREATE_PATHS and Bags docs.",
          attempt: createRes.error,
          metadataAttempt: metaRes.ok ? null : metaRes.error,
        },
      }, 502);
    }

    const j = createRes.json || {};
    const txBase64 = j.txBase64 || j.tx || j.transaction || j.serializedTx || null;
    const mint = j.mint || j.mintAddress || j.contract_address || j.tokenAddress || null;

    if (!txBase64) {
      return json({
        ok: false,
        error: {
          code: "BAGS_NO_TX",
          message: "Bags create endpoint returned no serialized transaction. Wallet has nothing to sign.",
          response: j,
          path: createRes.path,
        },
      }, 502);
    }

    return json({
      ok: true,
      metadataUri,
      txBase64,
      mint,
      bagsCreatePath: createRes.path,
    });
  } catch (e) {
    return json({ error: { code: "PROXY_ERROR", message: String((e && e.message) || e) } }, 500);
  }
}
