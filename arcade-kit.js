/* =========================================================================
   ARCADE — the shared frame for the endless games (Vine Swing, Canopy Stack,
   Tongue Snap): the menu, missions, ranks, shop (characters + upgrades),
   game-over screen, sounds, toasts and share card. Each game supplies its
   own gameplay and calls into this. Needs jungle-kit.js first.
   Saved data lives under the game's own key (harry-swing, harry-stack,
   harry-snap) and only reaches the device once cookies are accepted.
   ========================================================================= */
(function () {
  'use strict';
  const K = window.JungleKit;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = K.esc;
  const fmt = (n) => Math.round(n).toLocaleString('en-GB');
  const QS = new URLSearchParams(location.search);

  /* ---------- sky + colour grade by time of day, as on the home page ---------- */
  const PHASES = ['dawn', 'day', 'golden', 'dusk', 'night'];
  function gradeFor(phase, wx) {
    const P = { day: [1, 1, 1], golden: [1.07, 0.96, 0.82], dawn: [0.9, 0.82, 0.92], dusk: [0.8, 0.64, 0.76], night: [0.36, 0.44, 0.68] }[phase] || [1, 1, 1];
    const W = { clear: [1, 1], cloudy: [0.95, 0.92], overcast: [0.86, 0.72], fog: [0.95, 0.65], drizzle: [0.84, 0.7], rain: [0.78, 0.62], heavy: [0.7, 0.55], storm: [0.64, 0.5], snow: [1.02, 0.6] }[wx] || [1, 1];
    return { mul: P.map((v) => v * W[0]), sat: W[1] };
  }
  function skyStops(phase, wx) {
    const dull = /overcast|fog|drizzle|rain|heavy|snow|storm/.test(wx);
    if (phase === 'night') return [[0, '#070e16'], [0.6, '#0f1f2e'], [1, '#1e4152']];
    if (phase === 'dusk') return dull ? [[0, '#13293a'], [1, '#96a8c4']] : [[0, '#13293a'], [0.35, '#4a2a6a'], [0.7, '#e0503e'], [1, '#f6aa3e']];
    if (phase === 'dawn') return dull ? [[0, '#25505e'], [1, '#d6dbe6']] : [[0, '#25505e'], [0.45, '#e0a8f0'], [1, '#fff09a']];
    if (dull) return [[0, '#62789c'], [0.5, '#8ca4bf'], [1, '#cad8e4']];
    if (phase === 'golden') return [[0, '#4a8cc0'], [0.5, '#c6e4ec'], [1, '#f6aa3e']];
    return [[0, '#4a8cc0'], [0.4, '#82bede'], [0.75, '#c6e4ec'], [1, '#e2f0e6']];
  }
  /** a graded copy of a hex colour, for things drawn straight onto the canvas */
  function gradeHex(h, g) {
    let [r, gg, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    [r, gg, b] = [r, gg, b].map((v) => l + (v - l) * g.sat);
    return `rgb(${Math.min(255, Math.round(r * g.mul[0]))},${Math.min(255, Math.round(gg * g.mul[1]))},${Math.min(255, Math.round(b * g.mul[2]))})`;
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return { cv: c, c: c.getContext('2d', { willReadFrequently: true }) }; }
  /** tiny pixel picture from rows of characters; pal maps a character to a colour ('.' = empty) */
  function pix(rows, pal) {
    const k = mk(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { k.c.fillStyle = pal[ch]; k.c.fillRect(x, y, 1, 1); } }));
    return k.cv;
  }
  function scaled(cv, s) { const k = mk(cv.width * s, cv.height * s); k.c.imageSmoothingEnabled = false; k.c.drawImage(cv, 0, 0, cv.width * s, cv.height * s); return k.cv; }

  /* ---------- little sounds, made on the fly ---------- */
  let AC = null, NOISE = null;
  function audioOn() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
    const n = AC.sampleRate; NOISE = AC.createBuffer(1, n, n); const d = NOISE.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(type, f0, f1, dur, vol, when = 0) {
    const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filt, freq, when = 0) {
    const t = AC.currentTime + when, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NOISE; f.type = filt; f.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(AC.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  const SOUNDS = {
    grab: () => { tone('triangle', 260, 520, 0.08, 0.08); noise(0.05, 0.04, 'highpass', 3000); },
    fling: () => noise(0.16, 0.05, 'bandpass', 900),
    coin: () => { tone('square', 1319, 1319, 0.05, 0.035); tone('square', 1760, 1760, 0.08, 0.035, 0.05); },
    big: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone('square', f, f, 0.07, 0.035, i * 0.05)),
    splash: () => { noise(0.5, 0.14, 'lowpass', 900); tone('sine', 300, 80, 0.3, 0.08); },
    chomp: () => { tone('square', 150, 70, 0.12, 0.1); tone('square', 130, 60, 0.12, 0.1, 0.16); },
    bounce: () => tone('sine', 180, 620, 0.16, 0.12),
    thud: () => { tone('sine', 140, 55, 0.14, 0.16); noise(0.06, 0.06, 'lowpass', 600); },
    chop: () => { noise(0.07, 0.08, 'highpass', 1800); tone('square', 420, 260, 0.06, 0.04); },
    perfect: () => [880, 1175, 1568].forEach((f, i) => tone('square', f, f, 0.08, 0.04, i * 0.06)),
    snap: () => tone('triangle', 1100, 220, 0.08, 0.08),
    gulp: () => { tone('sine', 520, 220, 0.08, 0.1); tone('square', 1568, 1568, 0.05, 0.025, 0.05); },
    miss: () => tone('triangle', 330, 180, 0.12, 0.06),
    sting: () => { tone('sawtooth', 240, 90, 0.3, 0.09); noise(0.15, 0.05, 'bandpass', 2200); },
    crack: () => { noise(0.06, 0.1, 'highpass', 2500); noise(0.12, 0.06, 'bandpass', 700, 0.04); },
    mission: () => [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, i === 3 ? 0.22 : 0.08, 0.045, i * 0.08)),
    buy: () => { tone('square', 988, 988, 0.06, 0.04); tone('square', 1319, 1319, 0.14, 0.04, 0.07); },
    over: () => [523, 440, 349].forEach((f, i) => tone('triangle', f, f * 0.98, 0.18, 0.07, i * 0.14)),
    tick: () => tone('square', 660, 660, 0.03, 0.02)
  };

  /* ---------- page furniture ---------- */
  function toast(html, gold) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div'); t.className = 'toast' + (gold ? ' gold' : ''); t.innerHTML = html; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  const RANKS = ['Seedling', 'Sprout', 'Sapling', 'Climber', 'Branch runner', 'Canopy regular', 'Treetop pro', 'Emergent elite', 'Jungle legend', 'Mythic'];

  /* =======================================================================
     init(cfg) — builds the screens and returns the game's handle (A)
     ======================================================================= */
  function init(cfg) {
    K.noDoubleTapZoom();
    document.querySelectorAll('.yr').forEach((y) => { y.textContent = new Date().getFullYear(); });
    const curIcon = scaled(cfg.cur.icon, 2).toDataURL();
    const CI = `<img alt="" src="${curIcon}">`;

    /* ---------- saved data ---------- */
    const DEF = { best: 0, bank: 0, skin: cfg.skins[0].id, owned: [cfg.skins[0].id], up: {}, mt: {}, active: [], done: 0, totals: {}, runs: 0, mute: false, x: {} };
    let D = JSON.parse(JSON.stringify(DEF));
    try { D = Object.assign(D, JSON.parse(K.store.get(cfg.key) || '{}')); } catch (e) { /* fresh */ }
    const save = () => K.store.set(cfg.key, JSON.stringify(D));
    K.Consent.onChange(() => { save(); renderAll(); });

    /* ---------- missions ---------- */
    const TM = Object.fromEntries(cfg.missions.map((m) => [m.id, m]));
    const target = (m, tier) => (typeof m.targets === 'function' ? m.targets(tier) : m.targets[Math.min(tier, m.targets.length - 1)] * (tier >= m.targets.length ? (tier - m.targets.length + 2) : 1));
    const reward = (m, tier) => Math.round((m.reward || cfg.reward || 20) * (1 + tier * 0.6));
    const unlocked = (m) => !m.when || m.when(D);
    function refill() {
      D.active = D.active.filter((id) => TM[id]);
      while (D.active.length < 3) {
        const pool = cfg.missions.filter((m) => !D.active.includes(m.id) && unlocked(m));
        if (!pool.length) break;
        pool.sort((a, b) => (D.mt[a.id] || 0) - (D.mt[b.id] || 0) || cfg.missions.indexOf(a) - cfg.missions.indexOf(b));
        D.active.push(pool[0].id);
      }
    }
    refill();
    let LAST = {};   // the finished run's numbers, for the result screen
    function value(m) { if (!RUN) return m.total ? (D.totals[m.stat] || 0) : (LAST[m.stat] || 0); const r = RUN.stats[m.stat] || 0; return m.total ? (D.totals[m.stat] || 0) + r : r; }
    function check() {
      if (!RUN) return;
      for (let i = 0; i < D.active.length; i++) {
        const m = TM[D.active[i]], tier = D.mt[m.id] || 0, tg = target(m, tier);
        if (value(m) < tg) continue;
        const r = reward(m, tier), oldRank = rankOf();
        D.mt[m.id] = tier + 1; D.done++; D.bank += r; RUN.bonus += r;
        RUN.fresh.push({ text: m.text(tg), r });
        D.active.splice(i, 1); refill(); i = -1;
        sfx('mission'); toast(`✓ ${esc(m.text(tg))} · +${fmt(r)} ${CI}`, true);
        if (rankOf() > oldRank) setTimeout(() => { toast(`Rank up · ${esc(rankName())}`, true); }, 1400);
        save();
      }
    }
    const rankOf = () => Math.floor(D.done / 3) + 1;
    const rankName = () => RANKS[Math.min(RANKS.length - 1, rankOf() - 1)] + (rankOf() > RANKS.length ? ' ' + (rankOf() - RANKS.length + 1) : '');
    function missionsHTML(fresh) {
      let h = '';
      if (fresh && fresh.length > 4) { const more = fresh.length - 3; fresh = fresh.slice(0, 3).concat([{ text: `…and ${more} more missions done`, r: 0 }]); }
      if (fresh && fresh.length) h += fresh.map((f) => `<div class="mi done fresh"><span class="box">✓</span><span class="t">${esc(f.text)}</span><span class="rw">${f.r ? `+${fmt(f.r)}${CI}` : ''}</span></div>`).join('');
      h += D.active.map((id) => {
        const m = TM[id], tier = D.mt[id] || 0, tg = target(m, tier), v = Math.min(tg, value(m));
        return `<div class="mi"><span class="box"></span><span class="t">${esc(m.text(tg))}<span class="pg"><i style="width:${Math.round(v / tg * 100)}%"></i></span></span><span class="rw">+${fmt(reward(m, tier))}${CI}</span></div>`;
      }).join('');
      return `<div class="missions">${h}</div>`;
    }

    /* ---------- screens ---------- */
    const host = document.createElement('div');
    host.innerHTML = `
<div class="score" id="score" hidden>0</div>
<div class="hud" id="hud" hidden></div>
<div class="hint" id="hint" hidden>${esc(cfg.hint)}</div>
<section class="panel" id="menu"><div class="card">
  <div class="eyebrow">harryh.xyz</div>
  <h1>${esc(cfg.name)}</h1>
  <p class="sub">${cfg.how}</p>
  <div class="rank" id="mRank"></div>
  <div class="mhead">Missions</div><div id="mMissions"></div>
  <div class="row"><button class="btn go" data-play>Play</button><button class="btn" data-shop>${esc(cfg.shopLabel || 'Shop')}</button></div>
  <p class="note" id="mNote" hidden></p>
</div></section>
<section class="panel" id="shop" hidden><div class="card">
  <h2>Shop</h2>
  <div class="rank" id="sBank"></div>
  <div class="tabs" role="tablist"><button class="btn" role="tab" data-tab="skins">${esc(cfg.skinsLabel || 'Characters')}</button><button class="btn" role="tab" data-tab="up">Upgrades</button></div>
  <div class="items" id="sItems"></div>
  <div class="row"><button class="btn" data-back>Back</button><button class="btn go" data-play>Play</button></div>
</div></section>
<section class="panel" id="over" hidden><div class="card">
  <div class="eyebrow" id="oName">${esc(cfg.name)}</div>
  <div class="big" id="oScore">0</div>
  <p class="cause" id="oCause"></p>
  <div id="oBest" hidden><span class="newbest">New best</span></div>
  <div class="stats" style="margin-top:14px"><div><b id="oBestV">0</b>Best</div><div><b id="oCur">0</b>${esc(cfg.cur.many)}</div><div><b id="oBank">0</b>Saved</div></div>
  <div class="mhead">Missions</div><div id="oMissions"></div>
  <div class="row"><button class="btn go" data-play>Play again</button><button class="btn" data-shop>${esc(cfg.shopLabel || 'Shop')}</button></div>
  <div class="row" style="margin-top:10px"><button class="btn" data-share>Share</button><button class="btn" data-save>Save image</button><button class="btn" data-menu>Menu</button></div>
  <p class="note" id="oNote" hidden></p>
</div></section>
<section class="panel" id="paused" hidden><div class="card">
  <h2>Paused</h2><p class="sub">Take a breather. Your run is waiting.</p>
  <div class="row"><button class="btn go" data-resume>Carry on</button><button class="btn" data-quit>End run</button></div>
</div></section>`;
    while (host.firstChild) document.body.insertBefore(host.firstChild, $('.copy'));
    const P = { menu: $('#menu'), shop: $('#shop'), over: $('#over'), paused: $('#paused') };
    let state = 'menu', tab = 'skins', backTo = 'menu', RUN = null;
    const show = (name) => { Object.entries(P).forEach(([k, el]) => { el.hidden = k !== name; }); document.body.classList.toggle('nocopy', name === 'shop' || name === 'over'); const b = name && P[name] && P[name].querySelector('.btn.go'); if (b) b.focus({ preventScroll: true }); };

    const consentNote = () => (K.Consent.allowed() ? '' : `Your progress is kept for this visit only. <a href="../cookies" data-consent-open>Allow storage</a> to keep it on this device.`);
    function renderMenu() {
      $('#mRank').innerHTML = `<span>Rank ${rankOf()} · <b>${esc(rankName())}</b></span><span>${CI}${fmt(D.bank)}</span>${D.best ? `<span>Best ${fmt(D.best)} ${esc(cfg.unit)}</span>` : ''}`;
      $('#mMissions').innerHTML = missionsHTML(null);
      const n = consentNote(); $('#mNote').innerHTML = n; $('#mNote').hidden = !n || !D.runs;
    }
    function renderShop() {
      $('#sBank').innerHTML = `<span>${CI}<b>${fmt(D.bank)}</b> ${esc(cfg.cur.many)} to spend</span>`;
      document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      let h = '';
      if (tab === 'skins') h = cfg.skins.map((s) => {
        const own = D.owned.includes(s.id), sel = D.skin === s.id;
        const btn = sel ? `<button class="btn" disabled>Playing</button>` : own ? `<button class="btn" data-pick="${s.id}">Choose</button>` : `<button class="btn" data-buy="${s.id}" ${D.bank < s.price ? 'disabled' : ''}>${CI}${fmt(s.price)}</button>`;
        return `<div class="it${sel ? ' sel' : ''}"><div class="pic"><img alt="" class="${own ? '' : 'locked'}" src="${cfg.skinIcon ? cfg.skinIcon(s) : K.animalIconURL(s.kind, 30)}"></div><b>${esc(s.name)}</b><p>${esc(s.note || '')}</p>${btn}</div>`;
      }).join('');
      else h = cfg.upgrades.map((u) => {
        const lv = D.up[u.id] || 0, max = u.costs.length, cost = u.costs[lv];
        const btn = lv >= max ? `<button class="btn" disabled>Maxed</button>` : `<button class="btn" data-up="${u.id}" ${D.bank < cost ? 'disabled' : ''}>${CI}${fmt(cost)}</button>`;
        return `<div class="it"><b>${esc(u.name)}</b><p>${esc(typeof u.desc === 'function' ? u.desc(lv) : u.desc)}</p><div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>${btn}</div>`;
      }).join('');
      $('#sItems').innerHTML = h;
    }
    function renderAll() { renderMenu(); if (!P.shop.hidden) renderShop(); }

    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.closest('[data-consent-open]')) { e.preventDefault(); K.Consent.banner('../cookies', true); return; }
      audioOn();
      if (t.hasAttribute('data-play')) { cfg.start(); return; }
      if (t.hasAttribute('data-shop')) { backTo = state === 'over' ? 'over' : 'menu'; state = 'shop'; renderShop(); show('shop'); return; }
      if (t.hasAttribute('data-back')) { state = backTo; if (state === 'menu') renderMenu(); show(state); return; }
      if (t.hasAttribute('data-menu')) { state = 'menu'; renderMenu(); show('menu'); return; }
      if (t.dataset.tab) { tab = t.dataset.tab; renderShop(); return; }
      if (t.dataset.pick) { D.skin = t.dataset.pick; save(); renderShop(); cfg.onSkin && cfg.onSkin(); sfx('tick'); return; }
      if (t.dataset.buy) { const s = cfg.skins.find((x) => x.id === t.dataset.buy); if (s && D.bank >= s.price) { D.bank -= s.price; D.owned.push(s.id); D.skin = s.id; save(); sfx('buy'); toast(`${esc(s.name)} unlocked`); renderShop(); cfg.onSkin && cfg.onSkin(); } return; }
      if (t.dataset.up) { const u = cfg.upgrades.find((x) => x.id === t.dataset.up), lv = D.up[u.id] || 0; if (u && lv < u.costs.length && D.bank >= u.costs[lv]) { D.bank -= u.costs[lv]; D.up[u.id] = lv + 1; save(); sfx('buy'); toast(`${esc(u.name)} · level ${lv + 1}`); renderShop(); } return; }
      if (t.hasAttribute('data-resume')) { A.resume(); return; }
      if (t.hasAttribute('data-quit')) { A.paused = false; cfg.quit ? cfg.quit() : null; return; }
      if (t.hasAttribute('data-share')) { share(); return; }
      if (t.hasAttribute('data-save')) { saveImage(); return; }
      if (t.id === 'mute') { D.mute = !D.mute; save(); syncMute(); return; }
      if (t.id === 'pause') { A.pause(); }
    });
    addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && state === 'play') { e.preventDefault(); A.paused ? A.resume() : A.pause(); }
      if (e.code === 'Enter' && (state === 'menu' || state === 'over') && !e.target.closest('button, a')) { e.preventDefault(); audioOn(); cfg.start(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !A.paused) A.pause(); });

    const muteBtn = $('#mute');
    const syncMute = () => { if (!muteBtn) return; muteBtn.textContent = D.mute ? 'Sound off' : 'Sound on'; muteBtn.setAttribute('aria-pressed', String(!D.mute)); };
    syncMute();
    function sfx(name) { if (!AC || D.mute || !SOUNDS[name]) return; try { SOUNDS[name](); } catch (e) { /* sound is optional */ } }

    /* ---------- share + score card ---------- */
    const SHARE_URL = new URL(cfg.slug, new URL('../', location.href)).href, SHARE_TEXT_URL = SHARE_URL.replace(/^https?:\/\//, '');
    const shareText = () => cfg.shareText(D.best, SHARE_TEXT_URL);
    async function share() {
      const text = shareText();
      if (navigator.share) {
        try {
          const blob = await card(), file = new File([blob], cfg.slug + '-best.png', { type: 'image/png' });
          await navigator.share(navigator.canShare && navigator.canShare({ files: [file] }) ? { title: cfg.name, text, files: [file] } : { title: cfg.name, text, url: SHARE_URL }); return;
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(text); toast('Copied · paste it anywhere'); } catch (e) { toast(esc(text)); }
    }
    async function saveImage() {
      const blob = await card(), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = cfg.slug + '-best.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Image saved');
    }
    async function card() {
      try { await Promise.all([document.fonts.load('80px "Climate Crisis"'), document.fonts.load('600 40px "Pixelify Sans"')]); } catch (e) { /* fallback fonts */ }
      const T = K.TONES, lo = mk(216, 270), Pn = new K.Painter(lo.c, 77), ph = A.phase;
      K.setGrade(gradeFor(ph, 'clear'));
      Pn.vgrad(0, 0, 216, 270, skyStops(ph, 'clear'));
      if (ph !== 'night') Pn.rgrad(150, 20, 160, [[0, 'rgba(255,251,230,.9)'], [1, 'rgba(255,251,230,0)']]);
      for (let i = 0; i < 4; i++) Pn.cloud(30 + i * 55, 30 + Pn.r() * 30, 14);
      for (let i = 0; i < 20; i++) Pn.clump(Pn.r() * 216, 170 + Pn.r() * 50, 12 + Pn.r() * 10, T.leafTeal, [0, -1]);
      [[18, 9], [198, 9]].forEach(([x, w]) => Pn.trunk(x, -4, 274, w, w * 1.3, T.bark));
      for (let i = 0; i < 16; i++) { Pn.clump(Pn.r() * 60, Pn.r() * 60, 12 + Pn.r() * 8, T.leafA, [0.5, 1]); Pn.clump(216 - Pn.r() * 60, Pn.r() * 60, 12 + Pn.r() * 8, T.leafA, [-0.5, 1]); }
      for (let i = 0; i < 12; i++) Pn.frond(Pn.r() * 216, 274, 30 + Pn.r() * 20, -Math.PI / 2 + (Pn.r() - 0.5) * 1.6, T.leafB, { leaf: 6 });
      K.finalize(lo.c, 216, 270, { dither: 20 });
      cfg.regrade && cfg.regrade();
      const c = mk(1080, 1350), x = c.c; x.imageSmoothingEnabled = false; x.drawImage(lo.cv, 0, 0, 1080, 1350);
      x.fillStyle = 'rgba(7,14,22,.84)'; x.fillRect(120, 270, 840, 830);
      x.fillStyle = 'rgba(238,246,216,.3)'; [[120, 270, 840, 12], [120, 1088, 840, 12], [120, 270, 12, 830], [948, 270, 12, 830]].forEach((r) => x.fillRect(...r));
      x.textAlign = 'center';
      x.font = '400 96px "Climate Crisis", "Arial Black", sans-serif';
      cfg.cardTitle.forEach((ln, i) => { x.fillStyle = '#070e16'; x.fillText(ln, 540, 160 + i * 100); x.fillStyle = '#eef6d8'; x.fillText(ln, 540, 152 + i * 100); });
      const skin = A.skin(), sp = new K.Sprite(cfg.cardKind || skin.kind, 30, { pad: 1, grade: 0 }); sp.render(cfg.cardPose || {});
      const sc = Math.max(1, Math.floor(Math.min(250 / sp.canvas.height, 420 / sp.canvas.width)));
      x.drawImage(sp.canvas, 540 - sp.canvas.width * sc / 2, 330, sp.canvas.width * sc, sp.canvas.height * sc);
      x.fillStyle = '#c2ea6a'; x.font = '600 44px "Pixelify Sans", monospace'; x.fillText(cfg.cardLabel.toUpperCase(), 540, 680);
      x.fillStyle = '#eef6d8'; x.font = `400 ${String(fmt(D.best)).length > 5 ? 160 : 210}px "Climate Crisis", "Arial Black", sans-serif`; x.fillText(fmt(D.best), 540, 900);
      x.fillStyle = 'rgba(238,246,216,.75)'; x.font = '600 34px "Pixelify Sans", monospace';
      x.fillText((cfg.unitLong || cfg.unit).toUpperCase() + ' · ' + skin.name.toUpperCase() + ' · RANK ' + rankOf(), 540, 1000);
      x.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(), 540, 1050);
      x.fillStyle = '#070e16'; x.fillRect(250, 1180, 580, 92); x.fillStyle = '#c2ea6a'; x.font = '600 44px "Pixelify Sans", monospace'; x.fillText(SHARE_TEXT_URL, 540, 1240);
      return new Promise((res) => c.cv.toBlob(res, 'image/png'));
    }

    /* ---------- the handle each game uses ---------- */
    const scoreEl = $('#score'), hudEl = $('#hud'), hintEl = $('#hint'), pauseBtn = $('#pause');
    const A = {
      data: D, save, sfx, toast, fmt, CI, curIcon, paused: false,
      phase: QS.get('time') || K.Env.phase(), wx: QS.get('weather') || 'clear',
      get state() { return state; },
      skin: () => cfg.skins.find((s) => s.id === D.skin) || cfg.skins[0],
      lvl: (id) => D.up[id] || 0,
      audio: audioOn,
      /** a run starts: hide the screens, show the score */
      begin() {
        RUN = { stats: {}, earned: 0, bonus: 0, fresh: [] }; state = 'play'; A.paused = false;
        show(null); scoreEl.hidden = false; hudEl.hidden = false; hintEl.hidden = !cfg.hint; document.body.classList.add('playing');
        if (pauseBtn) pauseBtn.hidden = false;
      },
      hideHint() { hintEl.hidden = true; },
      showHint(t) { if (t) hintEl.textContent = t; hintEl.hidden = false; },
      score(html) { scoreEl.innerHTML = html; },
      hud(html) { hudEl.innerHTML = html; },
      popHud(sel) { const el = hudEl.querySelector(sel); if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } },
      stat(name, v) { if (!RUN || state !== 'play') return; if (v > (RUN.stats[name] || 0)) { RUN.stats[name] = v; check(); } },
      inc(name, n = 1) { if (!RUN || state !== 'play') return; RUN.stats[name] = (RUN.stats[name] || 0) + n; check(); },
      earn(n) { if (!RUN || state !== 'play') return; RUN.earned += n; A.inc('cur', n); },
      get earned() { return RUN ? RUN.earned : 0; },
      /** a run ends: bank everything, show the result after a short beat */
      end(o) {
        if (!RUN || state !== 'play') return;
        state = 'ending'; A.paused = false; if (pauseBtn) pauseBtn.hidden = true;
        Object.entries(RUN.stats).forEach(([k, v]) => { D.totals[k] = (D.totals[k] || 0) + v; });
        const isBest = o.score > D.best; D.best = Math.max(D.best, Math.round(o.score)); D.bank += RUN.earned; D.runs++; save();
        sfx('over');
        setTimeout(() => {
          state = 'over'; scoreEl.hidden = true; hudEl.hidden = true; hintEl.hidden = true; document.body.classList.remove('playing');
          $('#oScore').innerHTML = `${fmt(o.score)}<small>${esc(cfg.unit)}</small>`; $('#oCause').textContent = o.cause || '';
          $('#oBest').hidden = !(isBest && o.score > 0);
          $('#oBestV').textContent = fmt(D.best); $('#oCur').textContent = '+' + fmt(RUN.earned + RUN.bonus); $('#oBank').textContent = fmt(D.bank);
          LAST = RUN.stats; const fresh = RUN.fresh; RUN = null;
          $('#oMissions').innerHTML = missionsHTML(fresh);
          const n = consentNote(); $('#oNote').innerHTML = n; $('#oNote').hidden = !n;
          LAST = {}; renderMenu(); show('over');
        }, o.delay == null ? 900 : o.delay);
      },
      pause() { if (state !== 'play') return; A.paused = true; show('paused'); cfg.onPause && cfg.onPause(true); },
      resume() { A.paused = false; show(null); cfg.onPause && cfg.onPause(false); },
      toMenu() { state = 'menu'; RUN = null; scoreEl.hidden = true; hudEl.hidden = true; hintEl.hidden = true; document.body.classList.remove('playing'); if (pauseBtn) pauseBtn.hidden = true; renderMenu(); show('menu'); }
    };
    renderMenu();
    K.Consent.banner('../cookies');
    if (!QS.get('weather')) K.Env.weather().then((wx) => { if (wx.kind !== A.wx) { A.wx = wx.kind; cfg.onEnv && cfg.onEnv(); } }).catch(() => { /* stay clear */ });
    setInterval(() => { const ph = QS.get('time') || K.Env.phase(); if (ph !== A.phase) { A.phase = ph; cfg.onEnv && cfg.onEnv(); } }, 60000);
    return A;
  }

  /* =======================================================================
     Floats — short words that rise and fade over the game (Skip!, +5 …) and
     pinned labels (BEST). Positions are in the game canvas's own pixels;
     call update(toCanvas) every frame with a function that turns a game
     position into canvas pixels.
     ======================================================================= */
  function Floats(cv) {
    const box = document.createElement('div'); box.className = 'floats'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box);
    let list = []; const pins = new Map();
    function place(el, x, y, map, rise) {
      const r = cv.getBoundingClientRect(), sx = r.width / cv.width, sy = r.height / cv.height, q = map(x, y);
      el.style.transform = `translate(${Math.round(r.left + q[0] * sx)}px, ${Math.round(r.top + q[1] * sy - rise)}px) translate(-50%, -100%)`;
    }
    return {
      add(x, y, text, col) {
        const el = document.createElement('div'); el.className = 'fl'; el.textContent = text; if (col) el.style.color = col; box.appendChild(el);
        const stack = list.filter((f) => f.t < 0.5).length;   // words that pop up together stack instead of overlapping
        list.push({ el, x, y, t: 0, lift: stack * 26 }); if (list.length > 14) { list[0].el.remove(); list.shift(); }
      },
      pin(id, x, y, text, col) {
        let p = pins.get(id); if (!p) { const el = document.createElement('div'); el.className = 'fl pin'; box.appendChild(el); p = { el }; pins.set(id, p); }
        if (p.text !== text) { p.el.textContent = text; p.text = text; } if (col) p.el.style.color = col; p.x = x; p.y = y; p.on = true;
      },
      unpin(id) { const p = pins.get(id); if (p) p.on = false; },
      update(dt, map) {
        list = list.filter((f) => { f.t += dt; if (f.t > 1.1) { f.el.remove(); return false; } f.el.style.opacity = String(Math.min(1, 2 - f.t * 1.8)); place(f.el, f.x, f.y, map, f.t * 40 + f.lift); return true; });
        pins.forEach((p) => { p.el.hidden = !p.on; if (p.on) place(p.el, p.x, p.y, map, 0); });
      },
      clear() { list.forEach((f) => f.el.remove()); list = []; pins.forEach((p) => { p.on = false; p.el.hidden = true; }); }
    };
  }

  window.Arcade = { Floats, init, PHASES, gradeFor, skyStops, gradeHex, mk, pix, scaled, fmt };
})();
