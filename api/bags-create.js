// ============================================================
// api/bags-create.js — bags.fm token-create proxy
// ============================================================
// Mirrors api/pump-create.js but for bags.fm. The browser POSTs token
// metadata + image (base64) here. We:
//   1. Upload metadata + image to Bags
//   2. Ask Bags for a local create-token transaction
//   3. Return { metadataUri, txBase64, mint } so the client can sign it
//
// The exact Bags endpoint shapes aren't fully public-documented, so this
// proxy tries a few likely endpoint patterns and normalizes the response.
// If your Bags account exposes different paths, the candidates in
// TOKEN_CREATE_PATHS / METADATA_UPLOAD_PATHS are the place to edit.
//
// Request body (from the client / derivatives.html mintBags):
//   {
//     name, symbol, description,
//     imageBase64,
//     twitter, telegram, website,
//     launchpadConfigKey,
//     creator,           // payer/signer wallet pubkey
//     initialBuySol      // optional, 0 for none
//   }
//
// Response on success (normalized):
//   {
//     ok: true,
//     metadataUri: "https://...",
//     txBase64: "<base64 serialized VersionedTransaction>",
//     mint: "<solana mint address>"
//   }
// ============================================================

const BAGS_API_KEY   = "bags_prod_4CFspFz1h5xt8jH0jyOJTyu2Dlclu4c1u1Y4CqrmJxw";
const BAGS_USER_UUID = "2737eeee-d1b1-4caa-a93e-476b97f2619a";
const BAGS_BASES = [
  "https://public-api-v2.bags.fm/api/v1",
  "https://public-api.bags.fm/api/v1",
  "https://api.bags.fm/v1",
  "https://api.bags.fm",
];

// Candidate endpoint paths — first one that returns 2xx wins.
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

function bagsHeaders(extra){
  return Object.assign({
    "x-api-key":     BAGS_API_KEY,
    "Authorization": "Bearer " + BAGS_API_KEY,
    "x-user-id":     BAGS_USER_UUID,
    "Accept":        "application/json",
  }, extra || {});
}

async function readBody(req){
  if(req.body){
    if(typeof req.body === "object") return req.body;
    if(typeof req.body === "string"){ try { return JSON.parse(req.body); } catch(_){ return null; } }
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : null;
  } catch(_){ return null; }
}

// Try (base × path) combinations until one returns 2xx.
async function tryPaths(paths, payload){
  let lastErr = null;
  for(const base of BAGS_BASES){
    for(const p of paths){
      try {
        const r = await fetch(base + p, {
          method: "POST",
          headers: bagsHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        let j = null;
        try { j = text ? JSON.parse(text) : null; } catch(_){}
        if(r.ok){
          console.log("[bags-create] ok:", base + p);
          return { ok:true, path:p, base, json:j, raw:text };
        }
        lastErr = { base, path:p, status:r.status, body:(text||"").slice(0,300) };
      } catch(e){
        lastErr = { base, path:p, error:String((e && e.message) || e) };
      }
    }
  }
  return { ok:false, error:lastErr };
}

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS"){ res.status(200).end(); return; }
  if(req.method !== "POST"){
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
    return;
  }

  try {
    const body = await readBody(req);
    if(!body || typeof body !== "object"){
      res.status(400).json({ error: { code: "BAD_BODY", message: "JSON body required." } });
      return;
    }
    const {
      name, symbol, description = "",
      imageBase64,
      twitter = "", telegram = "", website = "",
      launchpadConfigKey, creator,
      initialBuySol = 0,
    } = body;

    if(!name || !symbol || !imageBase64){
      res.status(400).json({ error: { code: "MISSING_FIELDS", message: "name, symbol, imageBase64 are required." } });
      return;
    }

    // 1) Metadata upload (image + JSON)
    const metaPayload = {
      name, symbol, description,
      image: imageBase64,                       // some APIs accept base64 directly
      image_base64: imageBase64,                // alternate field name
      twitter, telegram, website,
      external_url: website,
      userId: BAGS_USER_UUID,
      user_id: BAGS_USER_UUID,
    };
    const metaRes = await tryPaths(METADATA_UPLOAD_PATHS, metaPayload);
    let metadataUri = null;
    if(metaRes.ok && metaRes.json){
      metadataUri = metaRes.json.metadataUri || metaRes.json.metadata_url || metaRes.json.uri || metaRes.json.url || null;
    }
    // If we have no metadataUri, continue anyway — some Bags create endpoints
    // accept metadata inline.

    // 2) Token create (asks Bags for a serialized create-tx the user signs)
    const createPayload = {
      name, symbol, description,
      metadataUri,
      image: imageBase64,                       // include in case create endpoint also wants it
      twitter, telegram, website,
      launchpadConfigKey,
      configKey: launchpadConfigKey,            // alternate field name
      platformConfig: launchpadConfigKey,       // alternate field name
      feeConfigPubkey: launchpadConfigKey,      // alternate field name
      userId: BAGS_USER_UUID,
      user_id: BAGS_USER_UUID,
      creator,
      payer: creator,
      walletAddress: creator,
      initialBuySol,
      action: "create",
    };
    const createRes = await tryPaths(TOKEN_CREATE_PATHS, createPayload);
    if(!createRes.ok){
      res.status(502).json({
        ok: false,
        error: {
          code: "BAGS_CREATE_FAILED",
          message: "None of the candidate Bags create endpoints accepted the request. Check api/bags-create.js TOKEN_CREATE_PATHS and Bags docs.",
          attempt: createRes.error,
          metadataAttempt: metaRes.ok ? null : metaRes.error,
        },
      });
      return;
    }

    // Normalize the response — pull a serialized transaction + mint from
    // whatever shape Bags returns.
    const j = createRes.json || {};
    const txBase64 = j.txBase64 || j.tx || j.transaction || j.serializedTx || null;
    const mint = j.mint || j.mintAddress || j.contract_address || j.tokenAddress || null;

    if(!txBase64){
      res.status(502).json({
        ok: false,
        error: {
          code: "BAGS_NO_TX",
          message: "Bags create endpoint returned no serialized transaction. Wallet has nothing to sign.",
          response: j,
          path: createRes.path,
        },
      });
      return;
    }

    res.status(200).json({
      ok: true,
      metadataUri,
      txBase64,
      mint,
      bagsCreatePath: createRes.path,
    });
  } catch(e){
    res.status(500).json({ error: { code: "PROXY_ERROR", message: String((e && e.message) || e) } });
  }
}
