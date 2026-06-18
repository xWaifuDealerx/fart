// =================================================================
// trade.js — GOLD ↔ $FARTPRINT marketplace settlement (Phase 2).
//
// SECURITY MODEL (no smart contract, no hot wallet):
//   • GOLD is a server-authoritative ledger (this module owns the balance).
//   • Selling ESCROWS gold out of the ledger into a listing.
//   • The buyer pays $FARTPRINT DIRECTLY to the seller's wallet on-chain.
//   • The buyer submits the tx signature; the server VERIFIES it on Solana:
//       - transaction succeeded & is confirmed,
//       - the SELLER received >= the quoted $FARTPRINT (pre/post token-balance
//         delta on the seller's account for the FARTPRINT mint),
//       - the signature has NEVER been used before (replay protection).
//   • Only then is the escrowed gold released to the buyer (minus a gold fee).
//   The server never holds funds or a private key — it only READS the chain.
//
// ⚠ MUST be tested on devnet / with tiny amounts before real value:
//   the on-chain parse depends on your token + RPC behaviour.
// =================================================================
'use strict';
const { Connection, PublicKey } = require('@solana/web3.js');

module.exports = function createTrade(db, opts) {
  const MINT    = opts.mint;
  const RPC     = opts.rpc;
  const FEE_PCT = (opts.feePct != null) ? opts.feePct : 5;
  const LOCK_MS = 3 * 60 * 1000;          // buyer has 3 min to pay after locking
  // Burn tiers: $FARTPRINT burned → GOLD granted (must match the client UI).
  const BURN_TIERS = opts.burnTiers || { 10000: 1, 50000: 6, 250000: 35 };
  const conn = new Connection(RPC, 'confirmed');

  db.exec(`
    CREATE TABLE IF NOT EXISTS gold_ledger (
      wallet TEXT PRIMARY KEY,
      gold   REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS listings (
      id          TEXT PRIMARY KEY,
      seller      TEXT,         -- seller connection id (wallet)
      sellerName  TEXT,
      gold        REAL,
      pricePer    REAL,         -- $FARTPRINT per gold
      created     INTEGER,
      lockedBy    TEXT,         -- buyer wallet currently paying (or NULL)
      lockUntil   INTEGER
    );
    CREATE TABLE IF NOT EXISTS used_sigs (
      sig TEXT PRIMARY KEY,
      ts  INTEGER
    );
  `);

  const qGold    = db.prepare('SELECT gold FROM gold_ledger WHERE wallet = ?');
  const qGoldSet = db.prepare('INSERT INTO gold_ledger (wallet, gold) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET gold = excluded.gold');
  const qListAll = db.prepare('SELECT * FROM listings');
  const qListGet = db.prepare('SELECT * FROM listings WHERE id = ?');
  const qListIns = db.prepare('INSERT INTO listings (id,seller,sellerName,gold,pricePer,created,lockedBy,lockUntil) VALUES (@id,@seller,@sellerName,@gold,@pricePer,@created,@lockedBy,@lockUntil)');
  const qListDel = db.prepare('DELETE FROM listings WHERE id = ?');
  const qListLock= db.prepare('UPDATE listings SET lockedBy=@lockedBy, lockUntil=@lockUntil WHERE id=@id');
  const qSigUsed = db.prepare('SELECT 1 FROM used_sigs WHERE sig = ?');
  const qSigAdd  = db.prepare('INSERT OR IGNORE INTO used_sigs (sig, ts) VALUES (?, ?)');

  function getGold(wallet) { try { const r = qGold.get(wallet); return r ? (r.gold || 0) : 0; } catch (_) { return 0; } }
  function setGold(wallet, g) { try { qGoldSet.run(wallet, Math.max(0, +g || 0)); } catch (_) {} }
  function addGold(wallet, delta) { const g = getGold(wallet) + (+delta || 0); setGold(wallet, g); return g; }

  function listingsSnapshot() {
    const now = Date.now();
    return qListAll.all().map(l => ({
      id: l.id, seller: l.seller, sellerName: l.sellerName, sellerWallet: l.seller,
      gold: l.gold, pricePer: l.pricePer,
      locked: !!(l.lockedBy && l.lockUntil > now),
    }));
  }

  // Verify an on-chain $FARTPRINT payment to `sellerWallet` of >= `amount`.
  async function verifyPayment(sig, sellerWallet, amount) {
    if (await new Promise(r => { try { r(!!qSigUsed.get(sig)); } catch (_) { r(false); } })) {
      return { ok: false, reason: 'This payment was already used.' };
    }
    let tx;
    try {
      tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    } catch (e) { return { ok: false, reason: 'Could not fetch transaction (RPC).' }; }
    if (!tx) return { ok: false, reason: 'Transaction not found / not confirmed yet.' };
    if (tx.meta && tx.meta.err) return { ok: false, reason: 'Transaction failed on-chain.' };

    const pre  = (tx.meta && tx.meta.preTokenBalances)  || [];
    const post = (tx.meta && tx.meta.postTokenBalances) || [];
    const preAmt  = sumFor(pre,  sellerWallet);
    const postAmt = sumFor(post, sellerWallet);
    const received = postAmt - preAmt;
    if (received + 1e-9 < amount) {
      return { ok: false, reason: 'Seller received ' + received + ' $FARTPRINT, need ' + amount + '.' };
    }
    return { ok: true, received };
  }
  function sumFor(balances, owner) {
    let t = 0;
    for (const b of balances) {
      if (b.mint === MINT && b.owner === owner) t += (b.uiTokenAmount && b.uiTokenAmount.uiAmount) || 0;
    }
    return t;
  }

  // Verify an on-chain $FARTPRINT BURN by `ownerWallet` of >= `amount`
  // (their token balance for the mint dropped by at least that much).
  async function verifyBurn(sig, ownerWallet, amount) {
    try { if (qSigUsed.get(sig)) return { ok: false, reason: 'This burn was already credited.' }; } catch (_) {}
    let tx;
    try { tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); }
    catch (e) { return { ok: false, reason: 'Could not fetch transaction (RPC).' }; }
    if (!tx) return { ok: false, reason: 'Transaction not found / not confirmed yet.' };
    if (tx.meta && tx.meta.err) return { ok: false, reason: 'Transaction failed on-chain.' };
    const pre  = sumFor((tx.meta && tx.meta.preTokenBalances) || [], ownerWallet);
    const post = sumFor((tx.meta && tx.meta.postTokenBalances) || [], ownerWallet);
    const burned = pre - post;
    if (burned + 1e-9 < amount) return { ok: false, reason: 'Only ' + burned + ' $FARTPRINT left the wallet, need ' + amount + '.' };
    return { ok: true, burned };
  }

  // Release any expired buy-locks so abandoned purchases free up.
  function sweepLocks() {
    const now = Date.now();
    for (const l of qListAll.all()) {
      if (l.lockedBy && l.lockUntil && l.lockUntil < now) qListLock.run({ id: l.id, lockedBy: null, lockUntil: 0 });
    }
  }
  setInterval(sweepLocks, 30000);

  // ── Message handler. Returns true if it handled the message. ──
  // ctx: { id, wallet, name, send(obj), broadcastListings() }
  async function handle(c, m, ctx) {
    switch (m.t) {
      case 'gmListings': ctx.send({ t: 'gmListings', list: listingsSnapshot(), gold: getGold(c.wallet) }); return true;

      // ── Gold ledger sync (keeps the authoritative balance in step with the
      //    legit in-game gold flows) ──
      case 'goldBalance': ctx.send({ t: 'goldBalance', gold: getGold(c.wallet) }); return true;

      case 'goldBurn': {   // verified on-chain on-ramp: burn $FARTPRINT → GOLD
        if (!c.wallet) return true;
        const tier = Math.floor(+m.tier || 0);
        const grant = BURN_TIERS[tier];
        const sig = String(m.txSig || '');
        if (!grant || !sig) { ctx.send({ t: 'gmErr', msg: 'Invalid burn tier.' }); return true; }
        const v = await verifyBurn(sig, c.wallet, tier);
        if (!v.ok) { ctx.send({ t: 'gmErr', msg: 'Burn not verified: ' + v.reason }); return true; }
        qSigAdd.run(sig, Date.now());
        const bal = addGold(c.wallet, grant);
        ctx.send({ t: 'goldBalance', gold: bal });
        console.log('[trade] burn-credit', c.wallet.slice(0, 6), '+' + grant, 'gold (', tier, 'burned )');
        return true;
      }

      case 'goldSpend': {   // safe sink: deduct gold the player spends in-game
        if (!c.wallet) return true;
        const n = Math.max(0, +m.n || 0);
        if (getGold(c.wallet) < n) { ctx.send({ t: 'goldBalance', gold: getGold(c.wallet) }); ctx.send({ t: 'gmErr', msg: 'Not enough gold.' }); return true; }
        ctx.send({ t: 'goldBalance', gold: addGold(c.wallet, -n) });
        return true;
      }

      case 'goldConvert': {  // bank silver→gold. NOTE: silver is still client-trusted,
        if (!c.wallet) return true;          // so this is the one soft spot until silver is authoritative.
        const n = Math.max(0, +m.gold || 0);
        ctx.send({ t: 'goldBalance', gold: addGold(c.wallet, n) });
        return true;
      }

      case 'gmList': {
        if (!c.wallet) { ctx.send({ t: 'gmErr', msg: 'Connect Phantom to sell gold.' }); return true; }
        const gold = Math.floor(+m.gold || 0);
        const pricePer = Math.floor(+m.pricePer || 0);
        if (gold <= 0 || pricePer <= 0) { ctx.send({ t: 'gmErr', msg: 'Enter a gold amount and price.' }); return true; }
        if (getGold(c.wallet) < gold) { ctx.send({ t: 'gmErr', msg: 'You only have ' + getGold(c.wallet) + ' gold.' }); return true; }
        addGold(c.wallet, -gold);                       // escrow out of the ledger
        qListIns.run({ id: 'L' + Date.now() + Math.floor(Math.random() * 1e4), seller: c.wallet, sellerName: c.name || 'Seller', gold, pricePer, created: Date.now(), lockedBy: null, lockUntil: 0 });
        ctx.send({ t: 'gmGold', gold: getGold(c.wallet) });
        ctx.broadcastListings();
        return true;
      }

      case 'gmCancel': {
        const l = qListGet.get(String(m.id || ''));
        if (!l || l.seller !== c.wallet) return true;
        addGold(c.wallet, l.gold);                       // return escrowed gold
        qListDel.run(l.id);
        ctx.send({ t: 'gmGold', gold: getGold(c.wallet) });
        ctx.broadcastListings();
        return true;
      }

      case 'gmBuyLock': {
        if (!c.wallet) { ctx.send({ t: 'gmErr', msg: 'Connect Phantom to buy gold.' }); return true; }
        const l = qListGet.get(String(m.id || ''));
        if (!l) { ctx.send({ t: 'gmErr', msg: 'That listing is gone.' }); return true; }
        if (l.seller === c.wallet) { ctx.send({ t: 'gmErr', msg: "You can't buy your own listing." }); return true; }
        const now = Date.now();
        if (l.lockedBy && l.lockUntil > now && l.lockedBy !== c.wallet) { ctx.send({ t: 'gmErr', msg: 'Someone else is buying this right now — try again shortly.' }); return true; }
        qListLock.run({ id: l.id, lockedBy: c.wallet, lockUntil: now + LOCK_MS });
        ctx.broadcastListings();
        // Tell the buyer exactly what to pay: total $FARTPRINT to the seller's wallet.
        ctx.send({ t: 'gmQuote', id: l.id, sellerWallet: l.seller, mint: MINT, total: +(l.gold * l.pricePer), gold: l.gold, expires: now + LOCK_MS });
        return true;
      }

      case 'gmSettle': {
        if (!c.wallet) return true;
        const l = qListGet.get(String(m.id || ''));
        if (!l) { ctx.send({ t: 'gmErr', msg: 'Listing no longer exists.' }); return true; }
        if (l.lockedBy !== c.wallet) { ctx.send({ t: 'gmErr', msg: 'Your purchase lock expired — try again.' }); return true; }
        const sig = String(m.txSig || '');
        if (!sig) { ctx.send({ t: 'gmErr', msg: 'Missing payment signature.' }); return true; }
        const total = +(l.gold * l.pricePer);
        const v = await verifyPayment(sig, l.seller, total);
        if (!v.ok) { ctx.send({ t: 'gmErr', msg: 'Payment not verified: ' + v.reason }); return true; }
        // Re-check the listing still exists & is locked to us (guard races), then settle atomically-ish.
        const l2 = qListGet.get(l.id);
        if (!l2 || l2.lockedBy !== c.wallet) { ctx.send({ t: 'gmErr', msg: 'Listing changed during settlement — contact support with your tx.' }); return true; }
        qSigAdd.run(sig, Date.now());                    // burn the signature (replay-proof)
        const netGold = +(l.gold * (1 - FEE_PCT / 100)); // 5% fee skimmed in gold
        addGold(c.wallet, netGold);                      // credit buyer
        qListDel.run(l.id);                              // consume the listing
        ctx.send({ t: 'gmBought', id: l.id, gold: netGold, balance: getGold(c.wallet) });
        ctx.broadcastListings();
        console.log('[trade] settled', l.id, sig.slice(0, 8), '→', c.wallet.slice(0, 6), netGold, 'gold');
        return true;
      }
    }
    return false;
  }

  return { handle, getGold, setGold, addGold, listingsSnapshot };
};
