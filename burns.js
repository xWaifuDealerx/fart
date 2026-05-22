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
  const INITIAL_SUPPLY = 1e9;   // 1,000,000,000 — the mint's launch supply
  const RPCS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana",
  ];

  // ── Transaction-style burns (Fart Cup buyback & burn, etc.) ──
  // Newest or oldest order doesn't matter; load() sorts.
  const BURNS = [
    {
      sig: "Jn6DBfcEgXmRWzNmD2KZnUJaqtPtGxfEXeVJhW2ENkjXhJ3oreeJnLPvtTPDw6W71HugFmDj3FemUfEQKFiKcqT",
      app: "Fart Cup",
      appKey: "cup",
      ts: "2026-05-22",
      amount: 704111.28,   // exact burned amount (pinned; authoritative)
    },
  ];

  // ── FartBurner burns, recorded by the wallet that burned. These don't
  // come with tx signatures, so they're seeded here and merged into the
  // FartBurner leaderboard (burner.html) and the FartWheel totals. ──
  const BURNER_SEEDS = [
    { w: "6QFGLogbnL3e2JzCdwwqSRyNsiuF1bjibJNysXVjX3Sd", a: 5295,  ts: "2026-04-29" },
    { w: "AGxQ89MaCn4rYcPdxpLXYZamXReVsoJjpZxuHXQggn7g", a: 53420, ts: "2026-04-29" },
    { w: "AcVYYQ2E4SRHuZbvRTAjfs27fR8o83Mqqt4c2vrrykwC", a: 63911, ts: "2026-04-29" },
    { w: "HikiUM8x7KUGS8x3B2v6a6pmGd8QtANCZdE8GLsSR2Am", a: 51899, ts: "2026-04-29" },
    { w: "3KcPSJ8ouE7H1feoWHmhDwXhLnXhpxP6R6713uytFmBM", a: 1335,  ts: "2026-05-15" },
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
      // A pinned amount is authoritative — only read the chain when a row
      // has no amount set (avoids buy-and-burn txs being mis-parsed).
      if (amount == null) {
        try {
          const a = await getBurnAmount(b.sig);
          if (a != null && isFinite(a) && a > 0) amount = a;
        } catch (_) {}
      }
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

  // Current circulating supply (uiAmount) from the chain.
  async function getSupply() {
    try {
      const r = await rpc("getTokenSupply", [MINT]);
      const v = r && r.value ? r.value.uiAmount : null;
      return (v != null && isFinite(v)) ? Number(v) : null;
    } catch (_) { return null; }
  }

  // FartBurner seed burns, normalised to the burner.html record shape
  // ({ w, a, ts(ms), tx, seed }) plus a couple of display helpers.
  function burnerRecords() {
    return BURNER_SEEDS.map((s, i) => ({
      w: s.w,
      a: Number(s.a),
      ts: Date.parse(s.ts),
      tsISO: s.ts,
      tx: "seed-burner-" + i,
      seed: true,
      app: "FartBurner",
      appKey: "burner",
      url: "https://solscan.io/account/" + s.w,
    }));
  }

  function burnerTotal() {
    return BURNER_SEEDS.reduce((s, x) => s + Number(x.a || 0), 0);
  }

  window.FartBurns = {
    MINT, DECIMALS, INITIAL_SUPPLY, BURNS, BURNER_SEEDS,
    load, total, getBurnAmount, getSupply, burnerRecords, burnerTotal,
  };
})();
