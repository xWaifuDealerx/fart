// =================================================================
// ops.js — "ONGOING OPERATIONS" panel (left side, below the chat).
//   Live list of everything currently working for you:
//     • Brainrot Base — slots filled / silver ready / rental time left
//       (replaces the old #brBase pill)
//     • Data Center jobs — operation name / time left / payout
//     • Farming plots — crop time left / plot rental time left
//   Styled to match the Chat + Daily Quests panels.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.State || !document.body){ setTimeout(whenReady, 400); return; }
    init();
  }
  whenReady();

  function init(){
    const State = window.State;

    const css = document.createElement('style');
    css.textContent = `
/* hide the old standalone base pill — it lives in this panel now */
#brBase{display:none !important;}
.ops-panel{position:fixed;left:14px;width:280px;max-width:calc(100vw - 28px);z-index:24;
  background:rgba(8,18,11,0.65);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  border:1px solid rgba(46,224,107,0.20);border-radius:14px;overflow:hidden;
  font-family:'Outfit','Inter',sans-serif;color:#eafff1;pointer-events:auto;
  box-shadow:0 10px 26px rgba(0,0,0,.4)}
.ops-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 14px;
  border-bottom:1px solid rgba(46,224,107,0.12);cursor:pointer;
  font-family:'Orbitron',sans-serif;font-weight:800;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;
  color:#5ff09c;text-shadow:0 0 8px rgba(95,240,156,0.45)}
.ops-head .cnt{background:rgba(95,240,156,.16);border:1px solid rgba(95,240,156,.4);color:#5ff09c;
  border-radius:100px;font-size:10px;padding:1px 8px;letter-spacing:.5px}
.ops-panel.collapsed .ops-body{display:none}
.ops-body{padding:8px 10px;display:flex;flex-direction:column;gap:7px;max-height:42vh;overflow:auto}
.ops-row{background:rgba(255,255,255,.04);border:1px solid rgba(95,240,156,.14);border-radius:10px;padding:8px 10px}
.ops-row .top{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700}
.ops-row .top .ic{font-size:14px}
.ops-row .top .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ops-row .top .tag{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#9fe0b6}
.ops-row .meta{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:5px;font-size:11px;color:rgba(230,255,238,.72)}
.ops-row .meta b{color:#fff1c2}
.ops-row .meta .rdy{color:#5ff09c;font-weight:800}
.ops-row.brainrot{border-color:rgba(255,206,74,.25)}
.ops-row.data{border-color:rgba(124,170,255,.25)}
.ops-row.farm{border-color:rgba(124,224,120,.28)}
.ops-row.invest{border-color:rgba(255,206,74,.3)}
.ops-empty{font-size:11.5px;color:rgba(230,255,238,.5);text-align:center;padding:8px 4px;font-style:italic}
/* shorter screens: cap the panel so it doesn't collide with chat/quests */
@media (max-height:860px){.ops-body{max-height:22vh}}
@media (max-height:760px){.ops-body{max-height:18vh}}
`;
    document.head.appendChild(css);

    const panel = document.createElement('div');
    panel.className = 'ops-panel';
    panel.innerHTML =
      '<div class="ops-head" id="opsHead"><span>⚙ Ongoing Operations</span><span class="cnt" id="opsCnt">0</span></div>' +
      '<div class="ops-body" id="opsBody"></div>';
    document.body.appendChild(panel);
    const body = panel.querySelector('#opsBody');
    panel.querySelector('#opsHead').addEventListener('click', () => panel.classList.toggle('collapsed'));

    // ── helpers ──
    function fmtMs(ms){
      ms = Math.max(0, ms | 0);
      const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      if(h > 0) return h + 'h ' + m + 'm';
      if(m > 0) return m + 'm ' + String(ss).padStart(2, '0') + 's';
      return ss + 's';
    }
    function full(n){ return Math.max(0, Math.floor(n)).toLocaleString('en-US'); }
    function growMsFor(crop){
      try {
        const I = window.ITEMS || {};
        for(const id in I){ if(I[id] && I[id].harvest === crop && I[id].growMs) return I[id].growMs; }
      } catch(_){}
      return 10 * 60 * 1000;
    }
    const myName = () => State.username || (window.Net && window.Net.handle) || null;

    function collect(){
      const now = Date.now();
      const rows = [];
      const brRows = [];   // brainrot base is appended LAST so it sits at the bottom

      // ── Brainrot base (collected here, shown at the bottom) ──
      try {
        const BR = window.fwBrainrots;
        const me = BR && BR.meId ? BR.meId() : null;
        const base = (BR && Array.isArray(BR.Bases)) ? BR.Bases.find(b => b.owner === me) : null;
        if(base){
          const occ = base.toilets.filter(Boolean).length;
          const ready = Math.floor(base.pending || 0);
          const left = (base.until || 0) - now;
          const terr = (typeof window.fwGuildTerritoryBonus === 'function') ? window.fwGuildTerritoryBonus() : 0;
          brRows.push({ cls: 'brainrot', ic: '🚽', nm: 'Brainrot Base', tag: occ + '/6',
            meta: [
              (ready > 0 ? '<span class="rdy">' + full(ready) + ' 🥈 ready</span>' : '<b>0 🥈</b> ready'),
              'rent <b>' + fmtMs(left) + '</b> left',
              (terr > 0 ? '⚑ guild <b>+' + Math.round(terr * 100) + '%</b>' : ''),
            ].filter(Boolean) });
        }
      } catch(_){}

      // ── Data center jobs ──
      try {
        const jobs = State.dcJobs || {};
        const acts = window.fwDataActivities || [];
        for(const id in jobs){
          const j = jobs[id]; if(!j || j.done) continue;
          const end = (j.startTs || 0) + (j.duration || 0);
          const rem = end - now;
          const act = acts.find(a => a.id === id) || {};
          const pay = (typeof j.payout === 'number') ? j.payout : null;
          rows.push({ cls: 'data', ic: act.emoji || '🖥️', nm: act.title || ('Data job: ' + id), tag: 'DATA',
            meta: [
              (rem > 0 ? 'finishes in <b>' + fmtMs(rem) + '</b>'
                       : (pay != null ? '<span class="rdy">' + full(pay) + ' 🥈 ready</span>' : '<span class="rdy">DONE — claim it</span>')),
              (rem > 0 ? (pay != null ? 'payout <b>' + full(pay) + ' 🥈</b>' : (act.max ? 'up to <b>' + full(act.max) + ' 🥈</b>' : '')) : ''),
            ].filter(Boolean) });
        }
        const rackLeft = (State.dcRentedUntil || 0) - now;
        if(rackLeft > 0 && !Object.values(jobs).some(j => j && !j.done)){
          rows.push({ cls: 'data', ic: '🖥️', nm: 'Data Center rack', tag: 'IDLE',
            meta: ['rented <b>' + fmtMs(rackLeft) + '</b> left', 'no job running'] });
        }
      } catch(_){}

      // ── Farming plots ──
      try {
        const plots = Array.isArray(window.Plots) ? window.Plots : [];
        const nm = myName();
        for(const p of plots){
          if(!p) continue;
          const mine = (p.ownerName && nm && p.ownerName === nm);
          if(!mine) continue;
          const rentLeft = (p.rentedUntil || 0) - now;
          if(rentLeft <= 0 && !p.crop) continue;
          const meta = [];
          if(p.crop && p.plantedAt){
            const ready = p.plantedAt + growMsFor(p.crop);
            const cl = ready - now;
            meta.push(cl > 0 ? p.crop + ' in <b>' + fmtMs(cl) + '</b>' : '<span class="rdy">' + p.crop + ' READY</span>');
          } else meta.push('empty plot');
          if(rentLeft > 0) meta.push('rent <b>' + fmtMs(rentLeft) + '</b> left');
          rows.push({ cls: 'farm', ic: '🌱', nm: 'Farm Plot', tag: 'FARM', meta });
        }
      } catch(_){}

      // ── Investments (Church + Moo Kratha) ──
      function invRow(getter, ic, nm, tag, cls) {
        try {
          if (typeof getter !== 'function') return;
          const inf = getter();
          if (!inf || (inf.shares || 0) <= 0) return;
          const ready = Math.floor(inf.pending || 0);
          const claimable = (inf.claimWaitMs || 0) <= 0;
          rows.push({ cls, ic, nm, tag,
            meta: [
              (ready > 0 && claimable ? '<span class="rdy">' + full(ready) + ' 🥈 ready</span>'
                : '<b>' + full(ready) + ' 🥈</b>' + ((inf.claimWaitMs || 0) > 0 ? ' · in ' + fmtMs(inf.claimWaitMs) : '')),
              'you own <b>' + (inf.pct || 0).toFixed(2) + '%</b>',
            ] });
        } catch (_) {}
      }
      invRow(window.fwChurchInfo, '⛪', 'Fartology Church', 'INVEST', 'invest');
      invRow(window.fwMooKrathaInfo, '🥩', 'Moo Kratha Shop', 'INVEST', 'invest');

      // brainrot base goes at the very bottom
      return rows.concat(brRows);
    }

    function render(){
      const rows = collect();
      panel.querySelector('#opsCnt').textContent = rows.length;
      if(!rows.length){
        body.innerHTML = '<div class="ops-empty">No ongoing operations.<br>Rent a base, start a data job, or plant a crop.</div>';
        return;
      }
      body.innerHTML = rows.map(r =>
        '<div class="ops-row ' + r.cls + '"><div class="top"><span class="ic">' + r.ic + '</span>' +
        '<span class="nm">' + r.nm + '</span><span class="tag">' + r.tag + '</span></div>' +
        '<div class="meta">' + r.meta.map(m => '<span>' + m + '</span>').join('') + '</div></div>'
      ).join('');
    }

    // ── dock below the chat panel (fall back to a fixed top) ──
    function dock(){
      const chat = document.getElementById('chatPanel');
      let top = 80, left = 14, width = 280;
      if(chat && chat.style.display !== 'none'){
        const r = chat.getBoundingClientRect();
        if(r.width > 20){ top = r.bottom + 10; left = r.left; width = r.width; }
      }
      panel.style.top = top + 'px';
      panel.style.left = left + 'px';
      panel.style.width = width + 'px';
    }

    setInterval(() => { dock(); render(); }, 1000);
    dock(); render();

    console.log('[ops] Ongoing Operations panel ready');
  }
})();
