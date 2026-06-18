// =================================================================
// Fartprint authoritative game server — Phase 1
//   • One shared world. Players connect over WebSocket and join directly
//     (no host/join). Capacity = MAX_SLOTS, and the simulated bots count
//     toward it (BOT_COUNT reserved).
//   • Persistence in SQLite, keyed by Phantom WALLET address. The whole
//     player State blob is stored (silver, gold, inventory, level, xp,
//     prestige, rank, profile, username, guild, gold↔$FARTPRINT listings…)
//     plus a cross-player `guilds` table.
//   • Guests connect but are NOT saved (must connect Phantom to persist).
//
// Run:  npm install  &&  node server.js
// Env:  PORT=8080  DB_PATH=./fartprint.db  MAX_SLOTS=100  BOT_COUNT=2
// =================================================================
'use strict';
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');
const createTrade = require('./trade');

const PORT       = parseInt(process.env.PORT || '8080', 10);
const DB_PATH    = process.env.DB_PATH || './fartprint.db';
const MAX_SLOTS  = parseInt(process.env.MAX_SLOTS || '100', 10);
const BOT_COUNT  = parseInt(process.env.BOT_COUNT || '2', 10);   // server-reserved bot slots
const HUMAN_CAP  = Math.max(1, MAX_SLOTS - BOT_COUNT);

// Shared spiders (authoritative — the same spiders for every player).
const SPIDER_MAX      = parseInt(process.env.SPIDER_MAX || '6', 10);
const SPIDER_SPEED    = 1.6;     // m/s
const SPIDER_ISLAND_R = 86;      // main-island clamp radius (client ISLAND_RADIUS = 90)

// GOLD ↔ $FARTPRINT marketplace (Phase 2 settlement, see trade.js)
const FARTPRINT_MINT = process.env.FARTPRINT_MINT || 'AA1GFBvxU39PxnrCY5eiQPgsTH5vuA7zGQoxgP6LMEaY';
const SOLANA_RPC     = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const TRADE_FEE_PCT  = parseInt(process.env.TRADE_FEE_PCT || '5', 10);

// ── Database ─────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    wallet     TEXT PRIMARY KEY,
    username   TEXT,
    state      TEXT,            -- JSON blob of the player's whole State
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS guilds (
    tag        TEXT PRIMARY KEY,
    name       TEXT,
    owner      TEXT,            -- owner wallet
    public     INTEGER,
    logo       TEXT,
    color      INTEGER,
    xp         INTEGER DEFAULT 0,
    season     INTEGER DEFAULT 0,
    members    TEXT,            -- JSON array of wallets
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS bases (
    idx        INTEGER PRIMARY KEY,   -- brainrot base index (matches client BASE_POS)
    owner      TEXT,                  -- owner connection id (wallet / g:n / bot:Name) or NULL
    ownerName  TEXT,                  -- display name
    until      INTEGER,               -- lease end (ms epoch)
    toilets    TEXT                   -- JSON array of 6 brainrot-type ids or null
  );
  CREATE TABLE IF NOT EXISTS plots (
    id          TEXT PRIMARY KEY,     -- plot id (matches client "plot_N")
    owner       TEXT,
    ownerName   TEXT,
    crop        TEXT,
    plantedAt   INTEGER,
    rentedUntil INTEGER
  );
`);

// GOLD ↔ $FARTPRINT marketplace settlement engine (own ledger + escrow + on-chain verify).
const trade = createTrade(db, { mint: FARTPRINT_MINT, rpc: SOLANA_RPC, feePct: TRADE_FEE_PCT });

const qLoad   = db.prepare('SELECT username, state FROM accounts WHERE wallet = ?');
const qSave   = db.prepare(`INSERT INTO accounts (wallet, username, state, updated_at)
                            VALUES (@wallet, @username, @state, @updated_at)
                            ON CONFLICT(wallet) DO UPDATE SET
                              username = excluded.username,
                              state    = excluded.state,
                              updated_at = excluded.updated_at`);
const qGuildsAll = db.prepare('SELECT tag, name, owner, public, logo, color, xp, season, members FROM guilds');
const qGuildUpsert = db.prepare(`INSERT INTO guilds (tag, name, owner, public, logo, color, xp, season, members, created_at)
                            VALUES (@tag, @name, @owner, @public, @logo, @color, @xp, @season, @members, @created_at)
                            ON CONFLICT(tag) DO UPDATE SET
                              name=excluded.name, public=excluded.public, logo=excluded.logo,
                              color=excluded.color, xp=excluded.xp, season=excluded.season, members=excluded.members`);

function loadAccount(wallet) {
  try { const r = qLoad.get(wallet); return r ? { username: r.username, state: JSON.parse(r.state || '{}') } : null; }
  catch (_) { return null; }
}
function saveAccount(wallet, username, state) {
  if (!wallet) return;   // guests aren't persisted
  try { qSave.run({ wallet, username: username || null, state: JSON.stringify(state || {}), updated_at: Date.now() }); }
  catch (e) { console.error('[db] save', e.message); }
}
function allGuilds() {
  try { return qGuildsAll.all().map(g => ({ ...g, public: !!g.public, members: JSON.parse(g.members || '[]') })); }
  catch (_) { return []; }
}

// ── Brainrot bases (shared, authoritative, persisted) ────────────
const BASE_COUNT = 26;                     // matches client BASE_POS.length
const BASE_RENT_MS = 60 * 60 * 1000;       // 1 hour lease
const BASE_BRAINROTS = ['fartbubu', 'baldur', 'fartolero', 'fartitos', 'popofanto', 'fartifito'];
const BOT_OWNERS = ['Skibidireaper', 'Toiletcarta'];
// id → { owner, ownerName, until, toilets:[6] }
const bases = new Map();
const qBaseUpsert = db.prepare(`INSERT INTO bases (idx, owner, ownerName, until, toilets)
  VALUES (@idx,@owner,@ownerName,@until,@toilets)
  ON CONFLICT(idx) DO UPDATE SET owner=excluded.owner, ownerName=excluded.ownerName, until=excluded.until, toilets=excluded.toilets`);
try {
  for (const r of db.prepare('SELECT * FROM bases').all()) {
    bases.set(r.idx, { owner: r.owner || null, ownerName: r.ownerName || null, until: r.until || 0, toilets: JSON.parse(r.toilets || '[null,null,null,null,null,null]') });
  }
} catch (_) {}
function baseSave(idx) {
  const b = bases.get(idx); if (!b) return;
  try { qBaseUpsert.run({ idx, owner: b.owner, ownerName: b.ownerName, until: Math.floor(Number(b.until) || 0), toilets: JSON.stringify(b.toilets || []) }); } catch (_) {}
}
function basesSnapshot() {
  const list = [];
  for (const [idx, b] of bases) {
    if (!b.owner) continue;
    list.push({ idx, owner: b.owner, ownerName: b.ownerName, until: b.until, toilets: b.toilets });
  }
  return list;
}
function broadcastBases() { broadcast({ t: 'bases', list: basesSnapshot() }, null); }
function baseOwnedBy(ownerId) { for (const [idx, b] of bases) if (b.owner === ownerId) return idx; return null; }
function freeBase(idx) { const b = bases.get(idx); if (b) { b.owner = null; b.ownerName = null; b.until = 0; b.toilets = [null, null, null, null, null, null]; baseSave(idx); } }
function rentBaseFor(idx, ownerId, ownerName) {
  // one base per owner — release any other they hold
  const prev = baseOwnedBy(ownerId);
  if (prev != null && prev !== idx) freeBase(prev);
  bases.set(idx, { owner: ownerId, ownerName: ownerName, until: Date.now() + BASE_RENT_MS, toilets: [null, null, null, null, null, null] });
  baseSave(idx);
}

// ── Farming plots (shared, authoritative, persisted) ────────────
// id → { owner, ownerName, crop, plantedAt, rentedUntil }
const plots = new Map();
const qPlotUpsert = db.prepare(`INSERT INTO plots (id, owner, ownerName, crop, plantedAt, rentedUntil)
  VALUES (@id,@owner,@ownerName,@crop,@plantedAt,@rentedUntil)
  ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, ownerName=excluded.ownerName,
    crop=excluded.crop, plantedAt=excluded.plantedAt, rentedUntil=excluded.rentedUntil`);
const qPlotDel = db.prepare('DELETE FROM plots WHERE id = ?');
try {
  for (const r of db.prepare('SELECT * FROM plots').all()) {
    plots.set(r.id, { owner: r.owner || null, ownerName: r.ownerName || null, crop: r.crop || null, plantedAt: r.plantedAt || 0, rentedUntil: r.rentedUntil || 0 });
  }
} catch (_) {}
function plotSaveRow(id) {
  const p = plots.get(id);
  if (!p) { try { qPlotDel.run(id); } catch (_) {} return; }
  try { qPlotUpsert.run({ id, owner: p.owner, ownerName: p.ownerName, crop: p.crop, plantedAt: Math.floor(Number(p.plantedAt) || 0), rentedUntil: Math.floor(Number(p.rentedUntil) || 0) }); } catch (_) {}
}
function plotsSnapshot() {
  const list = [];
  for (const [id, p] of plots) { if (!p.owner) continue; list.push({ id, owner: p.owner, ownerName: p.ownerName, crop: p.crop, plantedAt: p.plantedAt, rentedUntil: p.rentedUntil }); }
  return list;
}
function broadcastPlots() { broadcast({ t: 'plots', list: plotsSnapshot() }, null); }

// ── Dropped items on the ground (shared, transient — not persisted) ──
// dropId → { id, qty, x, z }
const drops = new Map();
const DROP_CAP = 300;
function dropsSnapshot() {
  const list = [];
  for (const [dropId, d] of drops) list.push({ dropId, id: d.id, qty: d.qty, x: d.x, z: d.z });
  return list;
}

// ── Guild flags / PVP-island posts (shared, in-memory per season) ──
// dir → { tag, color, logo }
const flags = new Map();
function flagsSnapshot() {
  const list = [];
  for (const [dir, f] of flags) list.push({ dir, tag: f.tag, color: f.color, logo: f.logo });
  return list;
}

// ── Leaderboard scoreboard (derived from saved + live State) ─────
// id → { name, level, totalXp, credits, farts, elo, dmWins, dmLosses, guildTag }
const scores = new Map();
function totalXpOf(level, xp) { const L = level || 1; return 100 * (L - 1) * L / 2 + (xp || 0); }
function scoreFromState(name, st, guildTag) {
  st = st || {};
  return {
    name: name || 'Printer', level: st.level || 1, totalXp: totalXpOf(st.level, st.xp),
    credits: st.credits || 0, gold: st.gold || 0, vault: (st.vaultSilver || 0) + (st.vaultCash || 0),
    farts: st.totalFarts || 0, elo: st.elo || 1000,
    dmWins: st.dmWins || 0, dmLosses: st.dmLosses || 0, guildTag: guildTag || null,
  };
}
try {
  for (const r of db.prepare('SELECT wallet, username, state FROM accounts').all()) {
    let st = {}; try { st = JSON.parse(r.state || '{}'); } catch (_) {}
    scores.set(r.wallet, scoreFromState(r.username || st.username, st, (st.guild && st.guild.tag) || null));
  }
} catch (_) {}
function leaderboardRows() {
  return [...scores.values()].sort((a, b) => (b.totalXp || 0) - (a.totalXp || 0)).slice(0, 100);
}

// ── Live world ───────────────────────────────────────────────────
// id → { ws, wallet, guest, name, x, y, z, yaw, walking, lastSave }
const clients = new Map();
let nextGuest = 1;

// Shared spider world: id → { x, z, yaw }
const spiders = new Map();
let nextSpider = 1;
let spiderSpawnAcc = 0;

function humanCount() { return clients.size; }
function totalSlots() { return clients.size + BOT_COUNT; }

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (_) {} }
function broadcast(obj, exceptId) {
  const s = JSON.stringify(obj);
  for (const [id, c] of clients) { if (id !== exceptId) { try { c.ws.send(s); } catch (_) {} } }
}
function roster() {
  const list = [];
  for (const [id, c] of clients) list.push({ id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, look: c.look || null });
  return list;
}
// Lighter roster for the online-players list (name + rank/prestige/guild meta).
function rosterFull() {
  const list = [];
  for (const [id, c] of clients) list.push({
    id, name: c.name, level: c.level | 0, prestige: c.prestige | 0, guildTag: c.guildTag || null,
    ping: Math.round((c.ws && c.ws._lastPing) || 0),
  });
  return list;
}

// ── HTTP (health/status) + WebSocket ─────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ online: humanCount(), bots: BOT_COUNT, used: totalSlots(), max: MAX_SLOTS }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Fartprint server up · ' + totalSlots() + '/' + MAX_SLOTS + ' slots');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let id = null;
  let authed = false;

  // Measure round-trip latency: the ping interval stamps _pingSentAt, the
  // pong reply lands here → _lastPing is shown in the player list.
  ws.on('pong', () => { if (ws._pingSentAt) ws._lastPing = Date.now() - ws._pingSentAt; });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!m || !m.t) return;

    // ---- AUTH (must be first) ----
    if (m.t === 'auth') {
      if (authed) return;
      // Capacity check (bots count toward the cap).
      if (humanCount() >= HUMAN_CAP) { send(ws, { t: 'full', max: MAX_SLOTS, used: totalSlots() }); try { ws.close(); } catch (_) {} return; }
      const wallet = (typeof m.wallet === 'string' && m.wallet.length >= 32) ? m.wallet : null;
      const guest = !wallet;
      id = wallet || ('g:' + (nextGuest++));
      // If this wallet is already connected elsewhere, drop the old session.
      if (clients.has(id)) { try { clients.get(id).ws.close(); } catch (_) {} clients.delete(id); }
      const acct = wallet ? loadAccount(wallet) : null;
      const name = (m.name || (acct && acct.username) || (guest ? 'Guest' + id.slice(2) : 'Printer')).slice(0, 24);
      const c = { ws, wallet, guest, name, x: 0, y: 0, z: 0, yaw: 0, walking: false, lastSave: 0,
                  level: m.level | 0, prestige: m.prestige | 0, guildTag: m.guildTag || null };
      clients.set(id, c);
      authed = true;
      send(ws, {
        t: 'welcome',
        you: { id, name, wallet, guest },
        state: acct ? acct.state : null,          // null = brand-new player, client uses defaults
        roster: roster().filter(r => r.id !== id),
        guilds: allGuilds(),
        bases: basesSnapshot(),
        plots: plotsSnapshot(),
        drops: dropsSnapshot(),
        flags: flagsSnapshot(),
        gold: wallet ? trade.getGold(wallet) : 0,   // authoritative gold ledger
        listings: trade.listingsSnapshot(),
        slots: { used: totalSlots(), max: MAX_SLOTS, bots: BOT_COUNT },
      });
      broadcast({ t: 'join', id, name }, id);
      broadcast({ t: 'roster', list: rosterFull() }, null);   // refresh everyone's player list
      console.log('[join]', id, '(' + humanCount() + '/' + HUMAN_CAP + ' humans, ' + totalSlots() + '/' + MAX_SLOTS + ' slots)');
      return;
    }
    if (!authed) return;
    const c = clients.get(id); if (!c) return;

    // ── GOLD ↔ $FARTPRINT marketplace (async, isolated in trade.js) ──
    if (m.t === 'gmListings' || m.t === 'gmList' || m.t === 'gmCancel' || m.t === 'gmBuyLock' || m.t === 'gmSettle'
        || m.t === 'goldBalance' || m.t === 'goldBurn' || m.t === 'goldSpend' || m.t === 'goldConvert') {
      trade.handle(c, m, {
        send: (o) => send(ws, o),
        broadcastListings: () => broadcast({ t: 'gmListings', list: trade.listingsSnapshot() }, null),
      }).catch((e) => { try { send(ws, { t: 'gmErr', msg: 'Trade error.' }); } catch (_) {} console.error('[trade]', e && e.message); });
      return;
    }

    switch (m.t) {
      case 'pos': {
        c.x = +m.x || 0; c.y = +m.y || 0; c.z = +m.z || 0; c.yaw = +m.yaw || 0; c.walking = !!m.walking;
        c.hidden = !!m.hidden;         // sleeping / on a boat → spiders ignore + flee
        if (m.look) c.look = m.look;   // appearance: { gun, flag, vehicle }
        broadcast({ t: 'peer', id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, walking: c.walking, look: c.look || null }, id);
        break;
      }
      case 'chat': {
        const text = String(m.text || '').slice(0, 200);
        if (text) broadcast({ t: 'chat', id, name: c.name, text }, null);
        break;
      }
      case 'save': {
        c.lastState = m.state || {};              // keep latest for the disconnect save
        if (m.username) c.name = String(m.username).slice(0, 24);
        // Update the player-list meta; rebroadcast the roster only on change.
        let metaChanged = false;
        if (m.username && m.username !== c._lastName) { c._lastName = m.username; metaChanged = true; }
        if (typeof m.level === 'number' && (m.level | 0) !== c.level) { c.level = m.level | 0; metaChanged = true; }
        if (typeof m.prestige === 'number' && (m.prestige | 0) !== c.prestige) { c.prestige = m.prestige | 0; metaChanged = true; }
        if ('guildTag' in m && (m.guildTag || null) !== c.guildTag) { c.guildTag = m.guildTag || null; metaChanged = true; }
        if (metaChanged) broadcast({ t: 'roster', list: rosterFull() }, null);
        // Refresh this player's leaderboard entry from their State blob.
        scores.set(id, scoreFromState(c.name, m.state, c.guildTag));
        // Throttle DB writes to once / 5s per player.
        const now = Date.now();
        if (now - c.lastSave < 5000) break;
        c.lastSave = now;
        saveAccount(c.wallet, c.name, c.lastState);
        break;
      }
      case 'guild': {
        handleGuild(c, m);
        break;
      }
      case 'spiderHit': {
        const sid = m.id;
        if (sid && spiders.has(sid)) {
          const s = spiders.get(sid);
          spiders.delete(sid);
          broadcast({ t: 'spiderKill', id: sid, x: s.x, z: s.z }, null);
        }
        break;
      }
      // ── Brainrot bases ──
      case 'baseRent': {
        const idx = m.idx | 0;
        if (idx < 0 || idx >= BASE_COUNT) break;
        const b = bases.get(idx);
        const taken = b && b.owner && b.until > Date.now();
        if (taken) { send(ws, { t: 'baseErr', idx, msg: 'That base is already taken' }); break; }
        rentBaseFor(idx, id, c.name);
        broadcastBases();
        break;
      }
      case 'baseToilet': {
        const idx = m.idx | 0, slot = m.slot | 0;
        const b = bases.get(idx);
        if (!b || b.owner !== id) break;                 // only the owner fills their toilets
        if (slot < 0 || slot > 5) break;
        const br = (typeof m.brainrot === 'string' && BASE_BRAINROTS.includes(m.brainrot)) ? m.brainrot : null;
        b.toilets[slot] = br;
        baseSave(idx); broadcastBases();
        break;
      }
      case 'baseSteal': {
        const idx = m.idx | 0, slot = m.slot | 0;
        const b = bases.get(idx);
        if (!b || !b.owner || b.owner === id) break;     // can't steal from yourself / empty
        if (slot < 0 || slot > 5 || !b.toilets[slot]) break;
        b.toilets[slot] = null;
        baseSave(idx); broadcastBases();
        break;
      }
      // ── Farming plots ──
      case 'plotSet': {
        const pid = String(m.id || ''); if (!pid) break;
        const now = Date.now();
        const cur = plots.get(pid);
        const curOwned = cur && cur.owner && cur.rentedUntil > now;
        // First-writer-wins on rent: reject if someone else still owns it.
        if (curOwned && m.owner && cur.owner !== m.owner) {
          send(ws, { t: 'plotErr', id: pid });
          send(ws, { t: 'plots', list: plotsSnapshot() });
          break;
        }
        if (!m.owner) { plots.delete(pid); }
        else { plots.set(pid, { owner: m.owner, ownerName: m.ownerName || null, crop: m.crop || null, plantedAt: Math.floor(Number(m.plantedAt) || 0), rentedUntil: Math.floor(Number(m.rentedUntil) || 0) }); }
        plotSaveRow(pid);
        broadcastPlots();
        break;
      }
      // ── Dropped items ──
      case 'dropAdd': {
        const dropId = String(m.dropId || '');
        if (!dropId || typeof m.id !== 'string') break;
        if (drops.size >= DROP_CAP) { const first = drops.keys().next().value; if (first) { drops.delete(first); broadcast({ t: 'dropRemove', dropId: first }, null); } }
        drops.set(dropId, { id: m.id, qty: m.qty | 0 || 1, x: +m.x || 0, z: +m.z || 0 });
        broadcast({ t: 'dropAdd', dropId, id: m.id, qty: m.qty | 0 || 1, x: +m.x || 0, z: +m.z || 0 }, id);
        break;
      }
      case 'dropPick': {
        const dropId = String(m.dropId || '');
        if (dropId && drops.has(dropId)) { drops.delete(dropId); broadcast({ t: 'dropRemove', dropId }, null); }
        break;
      }
      case 'flagCapture': {
        const dir = String(m.dir || ''); if (!dir) break;
        flags.set(dir, { tag: String(m.tag || '').slice(0, 5), color: m.color | 0, logo: m.logo || null });
        broadcast({ t: 'flags', list: flagsSnapshot() }, null);
        break;
      }
      case 'dm': {
        // Relay a deathmatch duel message to the other players (1v1 filtering
        // happens client-side via phase/opponent id).
        if (m.msg) broadcast({ t: 'dm', msg: m.msg }, id);
        break;
      }
      case 'shot': {
        // Relay gunfire so nearby players hear it. Throttle to curb auto-fire spam.
        const now = Date.now();
        if (now - (c.lastShot || 0) < 60) break;
        c.lastShot = now;
        broadcast({ t: 'peerShot', id, x: +m.x || 0, z: +m.z || 0 }, id);
        break;
      }
      case 'lbReq': send(ws, { t: 'lb', rows: leaderboardRows() }); break;
      case 'rosterReq': send(ws, { t: 'roster', list: rosterFull() }); break;
      case 'profileReq': {
        const tid = String(m.id || '');
        const target = clients.get(tid);
        let st = null, name = null, wallet = null;
        if (target) { st = target.lastState || (target.wallet ? (loadAccount(target.wallet) || {}).state : null); name = target.name; wallet = target.wallet; }
        else { const acc = loadAccount(tid); if (acc) { st = acc.state; name = acc.username; wallet = tid; } }
        if (!st) { send(ws, { t: 'profile', id: tid, found: false }); break; }
        const pf = st.profile || {};
        send(ws, {
          t: 'profile', id: tid, found: true, name: name || st.username || 'Printer', wallet: wallet || null,
          stats: {
            pvpKills: pf.pvpKills || 0, mobKills: st.spidersKilled || 0, deaths: st.deaths || 0,
            playMs: pf.playMs || 0, xp: totalXpOf(st.level, st.xp), silver: st.credits || 0,
            brainrotSilver: pf.brainrotSilver || 0, motto: pf.motto || '', level: st.level || 1, prestige: st.prestige || 0,
          },
        });
        break;
      }
      case 'ping': send(ws, { t: 'pong' }); break;
    }
  });

  ws.on('close', () => {
    if (id && clients.has(id)) {
      const c = clients.get(id);
      // Final save on disconnect (wallets only).
      if (c.wallet && c.lastState) saveAccount(c.wallet, c.name, c.lastState);
      if (c.guest) scores.delete(id);   // guests aren't kept on the board
      clients.delete(id);
      broadcast({ t: 'leave', id }, id);
      broadcast({ t: 'roster', list: rosterFull() }, null);   // refresh everyone's player list
      console.log('[leave]', id, '(' + humanCount() + '/' + HUMAN_CAP + ' humans)');
    }
  });
  ws.on('error', () => {});
});

// ── Guilds (cross-player, persisted) ─────────────────────────────
function handleGuild(c, m) {
  const op = m.op;
  if (op === 'create') {
    const tag = String(m.tag || '').toUpperCase().slice(0, 5);
    const name = String(m.name || '').slice(0, 24);
    if (!tag || !name || !c.wallet) { send(c.ws, { t: 'guildErr', msg: 'Connect Phantom to found a guild' }); return; }
    qGuildUpsert.run({ tag, name, owner: c.wallet, public: m.public ? 1 : 0, logo: m.logo || null,
      color: m.color | 0, xp: 0, season: m.season | 0, members: JSON.stringify([c.wallet]), created_at: Date.now() });
  } else if (op === 'join') {
    const g = db.prepare('SELECT * FROM guilds WHERE tag = ?').get(String(m.tag || '').toUpperCase());
    if (!g || !c.wallet) return;
    if (!g.public) { send(c.ws, { t: 'guildErr', msg: 'That guild is invite-only' }); return; }
    const members = JSON.parse(g.members || '[]');
    if (members.length >= 100) { send(c.ws, { t: 'guildErr', msg: 'Guild is full (100/100)' }); return; }
    if (!members.includes(c.wallet)) members.push(c.wallet);
    db.prepare('UPDATE guilds SET members = ? WHERE tag = ?').run(JSON.stringify(members), g.tag);
  } else if (op === 'leave') {
    const g = db.prepare('SELECT * FROM guilds WHERE tag = ?').get(String(m.tag || '').toUpperCase());
    if (!g || !c.wallet) return;
    const members = JSON.parse(g.members || '[]').filter(w => w !== c.wallet);
    db.prepare('UPDATE guilds SET members = ? WHERE tag = ?').run(JSON.stringify(members), g.tag);
  } else if (op === 'addxp') {
    const g = db.prepare('SELECT * FROM guilds WHERE tag = ?').get(String(m.tag || '').toUpperCase());
    if (g) db.prepare('UPDATE guilds SET xp = xp + ? WHERE tag = ?').run(Math.max(0, m.xp | 0), g.tag);
  }
  broadcast({ t: 'guilds', guilds: allGuilds() }, null);
}

// Heartbeat / latency probe (every 5s): stamp each socket, ping it (the pong
// updates _lastPing), and re-broadcast the roster so the player list shows
// everyone with fresh pings — this also guarantees the list never gets stuck
// "Connecting…" if a join-time roster was missed.
setInterval(() => {
  const now = Date.now();
  for (const [, c] of clients) { try { c.ws._pingSentAt = now; c.ws.ping(); } catch (_) {} }
  if (clients.size) broadcast({ t: 'roster', list: rosterFull() }, null);
}, 5000);

// ── Shared spiders ───────────────────────────────────────────────
// The server spawns/moves spiders and broadcasts them so every player
// sees the exact same ones. Clients render them and route their kills
// back via {t:'spiderHit'}. Spiders only exist while players are online.
function nearestPlayerOnIsland(x, z) {
  let best = null, bd = 1e9;
  for (const [, c] of clients) {
    if (c.hidden) continue;                                      // sleeping / on a boat → not a target
    if (Math.hypot(c.x, c.z) > SPIDER_ISLAND_R + 12) continue;   // chase only main-island players
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function spawnSpider() {
  const onIsland = [...clients.values()].filter(c => Math.hypot(c.x, c.z) < SPIDER_ISLAND_R);
  const anchor = onIsland.length ? onIsland[Math.floor(Math.random() * onIsland.length)] : { x: 0, z: 0 };
  const a = Math.random() * Math.PI * 2;
  const r = 30 + Math.random() * 18;
  let x = anchor.x + Math.cos(a) * r, z = anchor.z + Math.sin(a) * r;
  const rr = Math.hypot(x, z);
  if (rr > SPIDER_ISLAND_R - 6) { x = x / rr * (SPIDER_ISLAND_R - 6); z = z / rr * (SPIDER_ISLAND_R - 6); }
  spiders.set('s' + (nextSpider++), { x, z, yaw: 0 });
}
const SPIDER_DT = 0.16;
setInterval(() => {
  if (clients.size === 0) { if (spiders.size) spiders.clear(); return; }
  // Maintain population (one every ~5s up to the cap).
  spiderSpawnAcc += SPIDER_DT;
  if (spiders.size < SPIDER_MAX && spiderSpawnAcc > 5) { spiderSpawnAcc = 0; spawnSpider(); }
  // Move each spider toward the nearest on-island player.
  for (const [, s] of spiders) {
    const tgt = nearestPlayerOnIsland(s.x, s.z);
    if (tgt) {
      const mx = tgt.x - s.x, mz = tgt.z - s.z;
      const md = Math.hypot(mx, mz) || 1;
      if (md > 1.0) {
        s.x += (mx / md) * SPIDER_SPEED * SPIDER_DT;
        s.z += (mz / md) * SPIDER_SPEED * SPIDER_DT;
        s.yaw = Math.atan2(mx, mz);
      }
    } else {
      // No valid target (e.g. the only nearby player is sleeping) — amble off
      // in a slowly-drifting random direction so spiders turn away and leave.
      if (s.wAng == null || Math.random() < 0.02) s.wAng = Math.random() * Math.PI * 2;
      s.x += Math.cos(s.wAng) * SPIDER_SPEED * 0.5 * SPIDER_DT;
      s.z += Math.sin(s.wAng) * SPIDER_SPEED * 0.5 * SPIDER_DT;
      s.yaw = Math.atan2(Math.cos(s.wAng), Math.sin(s.wAng));
    }
    const rr = Math.hypot(s.x, s.z);
    if (rr > SPIDER_ISLAND_R) { s.x = s.x / rr * SPIDER_ISLAND_R; s.z = s.z / rr * SPIDER_ISLAND_R; s.wAng = Math.random() * Math.PI * 2; }
  }
  // Broadcast the snapshot.
  const list = [];
  for (const [id, s] of spiders) list.push({ id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(2) });
  broadcast({ t: 'spiders', list }, null);
}, 160);

// ── Base lease expiry + bot economy ──────────────────────────────
function randFreeBaseIdx() {
  const free = [];
  const now = Date.now();
  for (let i = 0; i < BASE_COUNT; i++) { const b = bases.get(i); if (!b || !b.owner || b.until <= now) free.push(i); }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}
function randBrainrot() { return BASE_BRAINROTS[Math.floor(Math.random() * BASE_BRAINROTS.length)]; }
setInterval(() => {
  let changed = false;
  const now = Date.now();
  // Expire finished leases.
  for (const [idx, b] of bases) { if (b.owner && b.until && b.until < now) { freeBase(idx); changed = true; } }
  // Expire finished plot rentals.
  let plotsChanged = false;
  for (const [pid, p] of plots) { if (p.owner && p.rentedUntil && p.rentedUntil < now) { plots.delete(pid); plotSaveRow(pid); plotsChanged = true; } }
  if (plotsChanged) broadcastPlots();
  // Bots rent/fill/raid real shared bases — but only while players are online.
  if (clients.size > 0) {
    for (const botName of BOT_OWNERS) {
      const botId = 'bot:' + botName;
      const owns = baseOwnedBy(botId);
      if (owns == null) {
        if (Math.random() < 0.5) {
          const idx = randFreeBaseIdx();
          if (idx != null) {
            rentBaseFor(idx, botId, botName);
            const b = bases.get(idx);
            const n = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) b.toilets[i] = randBrainrot();
            baseSave(idx); changed = true;
          }
        }
      } else if (Math.random() < 0.15) {
        // Occasionally raid a toilet from someone else's base.
        for (const [idx, b] of bases) {
          if (b.owner && b.owner !== botId) {
            const slot = b.toilets.findIndex(Boolean);
            if (slot >= 0) { b.toilets[slot] = null; baseSave(idx); changed = true; break; }
          }
        }
      }
    }
  }
  if (changed) broadcastBases();
}, 20000);

server.listen(PORT, () => {
  console.log('[fartprint-server] listening on :' + PORT + ' · cap ' + MAX_SLOTS + ' (' + BOT_COUNT + ' bots reserved → ' + HUMAN_CAP + ' human slots) · db ' + DB_PATH);
});
