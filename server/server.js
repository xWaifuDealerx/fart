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

const PORT       = parseInt(process.env.PORT || '8080', 10);
const DB_PATH    = process.env.DB_PATH || './fartprint.db';
const MAX_SLOTS  = parseInt(process.env.MAX_SLOTS || '100', 10);
const BOT_COUNT  = parseInt(process.env.BOT_COUNT || '2', 10);   // server-reserved bot slots
const HUMAN_CAP  = Math.max(1, MAX_SLOTS - BOT_COUNT);

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
`);

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

// ── Live world ───────────────────────────────────────────────────
// id → { ws, wallet, guest, name, x, y, z, yaw, walking, lastSave }
const clients = new Map();
let nextGuest = 1;

function humanCount() { return clients.size; }
function totalSlots() { return clients.size + BOT_COUNT; }

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (_) {} }
function broadcast(obj, exceptId) {
  const s = JSON.stringify(obj);
  for (const [id, c] of clients) { if (id !== exceptId) { try { c.ws.send(s); } catch (_) {} } }
}
function roster() {
  const list = [];
  for (const [id, c] of clients) list.push({ id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw });
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
      const c = { ws, wallet, guest, name, x: 0, y: 0, z: 0, yaw: 0, walking: false, lastSave: 0 };
      clients.set(id, c);
      authed = true;
      send(ws, {
        t: 'welcome',
        you: { id, name, wallet, guest },
        state: acct ? acct.state : null,          // null = brand-new player, client uses defaults
        roster: roster().filter(r => r.id !== id),
        guilds: allGuilds(),
        slots: { used: totalSlots(), max: MAX_SLOTS, bots: BOT_COUNT },
      });
      broadcast({ t: 'join', id, name }, id);
      console.log('[join]', id, '(' + humanCount() + '/' + HUMAN_CAP + ' humans, ' + totalSlots() + '/' + MAX_SLOTS + ' slots)');
      return;
    }
    if (!authed) return;
    const c = clients.get(id); if (!c) return;

    switch (m.t) {
      case 'pos': {
        c.x = +m.x || 0; c.y = +m.y || 0; c.z = +m.z || 0; c.yaw = +m.yaw || 0; c.walking = !!m.walking;
        broadcast({ t: 'peer', id, name: c.name, x: c.x, y: c.y, z: c.z, yaw: c.yaw, walking: c.walking }, id);
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
      case 'ping': send(ws, { t: 'pong' }); break;
    }
  });

  ws.on('close', () => {
    if (id && clients.has(id)) {
      const c = clients.get(id);
      // Final save on disconnect (wallets only).
      if (c.wallet && c.lastState) saveAccount(c.wallet, c.name, c.lastState);
      clients.delete(id);
      broadcast({ t: 'leave', id }, id);
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

// Heartbeat — drop dead sockets.
setInterval(() => {
  for (const [, c] of clients) { try { c.ws.ping(); } catch (_) {} }
}, 30000);

server.listen(PORT, () => {
  console.log('[fartprint-server] listening on :' + PORT + ' · cap ' + MAX_SLOTS + ' (' + BOT_COUNT + ' bots reserved → ' + HUMAN_CAP + ' human slots) · db ' + DB_PATH);
});
