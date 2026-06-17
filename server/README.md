# Fartprint Game Server — Phase 1

Authoritative single-world server. Players connect directly over WebSocket (no
host/join). Capacity is **100 slots, bots included** (`MAX_SLOTS` − `BOT_COUNT`
human slots). Player data is persisted in **SQLite, keyed by Phantom wallet**;
guests can play but are not saved.

## What it stores
- `accounts` (one row per wallet): `username` + the player's whole **State** JSON
  blob — silver, gold, cash, $FARTPRINT-linked balances, inventory, level/XP,
  prestige, rank, profile, gold↔$FARTPRINT listings, etc.
- `guilds` (cross-player): tag, name, owner, public/invite-only, logo, color,
  season XP, member list.

## Deploy on the VPS (Ubuntu)
```bash
# 1. Node 20+ and build tools (better-sqlite3 compiles a native module)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3

# 2. Get the server folder onto the box (e.g. it lives in your repo under /server)
cd /var/www/fartprint/server
npm install

# 3. Run it (test)
PORT=8080 node server.js
# → [fartprint-server] listening on :8080 · cap 100 (2 bots reserved → 98 human slots)

# 4. Keep it alive with pm2
sudo npm install -g pm2
PORT=8080 pm2 start server.js --name fartprint
pm2 save && pm2 startup     # run the command it prints so it survives reboots
```

## Put it behind HTTPS/WSS (required — the site is https, so the socket must be wss)
Add to your nginx site (the same server block that serves the game), so
`wss://fartprint.art/ws` proxies to the Node process:
```nginx
location /ws {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```
`nginx -t && systemctl reload nginx`. If you proxy through Cloudflare, enable
WebSockets (on by default on the free plan) and keep SSL/TLS = Full (strict).

The client connects to: `wss://fartprint.art/ws`

## Config (env vars)
| var | default | meaning |
|-----|---------|---------|
| `PORT` | 8080 | port the Node server listens on |
| `DB_PATH` | ./fartprint.db | SQLite file location |
| `MAX_SLOTS` | 100 | total world capacity |
| `BOT_COUNT` | 2 | bot slots reserved out of MAX_SLOTS |

## WebSocket protocol (so the client can speak it)
**Client → server**
- `{t:'auth', wallet, name}` — first message. `wallet` = Phantom pubkey (omit/blank = guest).
- `{t:'pos', x,y,z,yaw,walking}` — ~10 Hz position.
- `{t:'chat', text}`
- `{t:'save', state, username}` — full State blob (persisted for wallets, throttled 5 s).
- `{t:'guild', op:'create'|'join'|'leave'|'addxp', ...}`
- `{t:'ping'}`

**Server → client**
- `{t:'welcome', you:{id,name,wallet,guest}, state, roster:[…], guilds:[…], slots:{used,max,bots}}`
  — `state:null` means a brand-new player (client keeps its defaults).
- `{t:'full', max, used}` then the socket closes — server at capacity.
- `{t:'peer', id,name,x,y,z,yaw,walking}` · `{t:'join',id,name}` · `{t:'leave',id}`
- `{t:'chat', id,name,text}`
- `{t:'guilds', guilds:[…]}` · `{t:'guildErr', msg}`
- `{t:'pong'}`

## Client (done — in fartworld.html)
The game client now connects directly to this server instead of the old
host/join lobby:
- `enterLobby()` skips the host/join/solo picker and calls `fwConnectServer()`.
- It opens `wss://<same-host>/ws` (override with `localStorage.fwServerUrl` for
  local testing, e.g. `ws://localhost:8080`), sends `auth` with the Phantom
  wallet (or guest), and applies the saved State from `welcome`.
- Peers render through the existing printer/name-tag system from
  `peer/join/leave`; position streams at ~10 Hz; full State is saved every 8 s
  and on tab close. Chat relays through the server.
- Guild membership persists per-player inside the State blob today; the cross-
  player guild *table* is wired on the server (`window.fwServerGuild(op,data)`
  + `window.fwApplyServerGuilds(list)`) and just needs guild.js to call them.

## Next phase (not in this build)
- guild.js → call `window.fwServerGuild('create'|'join'|'leave'|'addxp', …)` and
  implement `window.fwApplyServerGuilds(guilds)` to use the server's shared table.
- Server-authoritative validation (anti-cheat) of balances/inventory.
- On-chain gold↔$FARTPRINT settlement (wallet signing + payment verification + treasury).
- Auth hardening: verify wallet ownership with a signed nonce (right now the
  client just asserts its wallet — fine for launch, tighten before real value moves).
