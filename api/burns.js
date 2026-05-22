// ============================================================
// burns.js — shared $FARTPRINT burn ledger (single source of truth)
// ============================================================
// One place to record every on-chain $FARTPRINT burn. The index page,
// Fart Cup, and FartWheel all load this file and render the same data.
//
// To log a new burn: add a row to BURNS with the transaction signature,
// which app did the burn, and the date. The burned AMOUNT is read live
// from the chain in the browser (getTransaction), so you never have to
// type it — it's always exactly what happened on-chain. If you want, you
// can pin an `amount:` on a row and it'll be used as a fallback when RPC
// is unavailable.
//
//   FartBurns.load()  -> Promise<[{ sig, app, appKey, ts, amount, url }]>
//                        newest first, amount filled in from chain.
// ============================================================
(function () {
  const MINT = "AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY";
  const DECIMALS = 6;
  const RPCS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana",
  ];

  // ── The ledger. Newest or oldest order doesn't matter; load() sorts. ──
  const BURNS = [
    {
      sig: "Jn6DBfcEgXmRWzNmD2KZnUJaqtPtGxfEXeVJhW2ENkjXhJ3oreeJnLPvtTPDw6W71HugFmDj3FemUfEQKFiKcqT",
      app: "Fart Cup",
      appKey: "cup",
      ts: "2026-05-22",
      // amount: 0,   // optional manual fallback if RPC can't be reached
    },
  ];

  async function rpc(method, params) {
    let lastErr;
    for (const url of RPCS) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (!r.ok) { lastErr = new Error("HTTP " + r.status); continue; }
        const j = await r.json();
        if (j.error) { lastErr = new Error(j.error.message); continue; }
        return j.result;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("All RPCs failed");
  }

  const toUi = (raw) => Number(raw) / Math.pow(10, DECIMALS);

  // Pull the $FARTPRINT burn amount out of a parsed transaction.
  // Strategy: sum every spl-token burn / burnChecked instruction that
  // targets the $FARTPRINT mint (top-level + inner / CPI instructions).
  // If no burn instruction is found, fall back to the net decrease of
  // $FARTPRINT across all token balances in the tx.
  function extractBurn(tx) {
    if (!tx || !tx.meta || !tx.transaction) return null;
    const meta = tx.meta;
    const msg = tx.transaction.message || {};
    const keys = (msg.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));

    // token account pubkey -> mint (from pre/post balances)
    const acctMint = {};
    [...(meta.preTokenBalances || []), ...(meta.postTokenBalances || [])].forEach((b) => {
      const pk = keys[b.accountIndex];
      if (pk) acctMint[pk] = b.mint;
    });

    // all instructions: top-level + every inner instruction group
    let ixs = [...(msg.instructions || [])];
    (meta.innerInstructions || []).forEach((g) => { ixs = ixs.concat(g.instructions || []); });

    let burned = 0, found = false;
    for (const ix of ixs) {
      if (ix.program !== "spl-token" || !ix.parsed) continue;
      const type = ix.parsed.type;
      const info = ix.parsed.info || {};
      if (type === "burnChecked") {
        if (info.mint && info.mint !== MINT) continue;
        const ui = info.tokenAmount && info.tokenAmount.uiAmount != null
          ? Number(info.tokenAmount.uiAmount)
          : toUi(info.amount || 0);
        if (ui > 0) { burned += ui; found = true; }
      } else if (type === "burn") {
        // plain burn has no mint field — verify via the account's mint
        const m = acctMint[info.account];
        if (m && m !== MINT) continue;
        const ui = toUi(info.amount || 0);
        if (ui > 0) { burned += ui; found = true; }
      }
    }
    if (found) return burned;

    // Fallback: net decrease of $FARTPRINT across token balances
    const pre = {}, post = {};
    (meta.preTokenBalances || []).forEach((b) => { if (b.mint === MINT) pre[b.accountIndex] = Number(b.uiTokenAmount.uiAmount || 0); });
    (meta.postTokenBalances || []).forEach((b) => { if (b.mint === MINT) post[b.accountIndex] = Number(b.uiTokenAmount.uiAmount || 0); });
    let dec = 0;
    Object.keys(pre).forEach((i) => { const d = pre[i] - (post[i] || 0); if (d > 0) dec += d; });
    return dec > 0 ? dec : null;
  }

  async function getBurnAmount(sig) {
    const tx = await rpc("getTransaction", [sig, { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" }]);
    return extractBurn(tx);
  }

  let _cache = null;          // only cached once every amount is resolved
  async function load() {
    if (_cache) return _cache;
    const out = await Promise.all(BURNS.map(async (b) => {
      let amount = (typeof b.amount === "number") ? b.amount : null;
      try {
        const a = await getBurnAmount(b.sig);
        if (a != null && isFinite(a) && a > 0) amount = a;
      } catch (_) {}
      return {
        sig: b.sig,
        app: b.app,
        appKey: b.appKey || null,
        ts: b.ts || null,
        amount: amount,
        url: "https://solscan.io/tx/" + b.sig,
      };
    }));
    out.sort((a, b) => {
      const ta = a.ts ? Date.parse(a.ts) : 0;
      const tb = b.ts ? Date.parse(b.ts) : 0;
      return tb - ta;
    });
    // Cache only if every burn resolved an amount, so a transient RPC
    // failure retries on the next call instead of sticking at "—".
    if (out.every((r) => r.amount != null)) _cache = out;
    return out;
  }

  async function total() {
    const r = await load();
    return r.reduce((s, x) => s + (x.amount || 0), 0);
  }

  window.FartBurns = { MINT, DECIMALS, BURNS, load, total, getBurnAmount };
})();
