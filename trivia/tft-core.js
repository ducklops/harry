/* =========================================================================
   Tree-Frog Trivia — shared core
   Used by the game (trivia/index.html), the console (console.html) and the
   GitHub Action (.github/scripts/trivia-build.mjs).
     • encoding so answers can't be read at a glance in the repository
     • forgiving answer matching (typos, alternative names, "Henry the Eighth")
     • rarity scores (0 = the most obvious answer, 100 = the deepest cut)
     • the weekly rotation and the day builder (same day = same game for all)
     • quality checks, and the Wikidata / Wikipedia-pageview fetchers
   ========================================================================= */
(function (root, factory) {
  const T = factory();
  if (typeof module === 'object' && module.exports) module.exports = T; else root.TFT = T;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = 1;

  /* ---------------- small helpers ---------------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shuffle(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- days (London time) ---------------- */
  const londonDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  const weekday = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = Sunday
  const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T12:00:00Z'));
  const prettyDay = (iso, long) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  /* ---------------- the weekly rotation ---------------- */
  //            Sun       Mon      Tue       Wed     Thu      Fri       Sat
  const ROTA = ['summit', 'chase', 'ladder', 'wall', 'chase', 'ladder', 'wall'];
  const styleOf = (iso) => ROTA[weekday(iso)];
  const STYLES = {
    chase: { name: 'Canopy Chase', icon: '🐍', short: 'Chase', blurb: 'Name rare answers for a head start, then out-climb the emerald tree boa.' },
    ladder: { name: 'Vine Ladder', icon: '🪜', short: 'Ladder', blurb: 'Twelve rungs from the forest floor to the emergent layer. Three lifelines. Walk away any time.' },
    wall: { name: 'Tangled Wall', icon: '🌿', short: 'Wall', blurb: 'Untangle sixteen vines into four hidden groups, then name each connection.' },
    summit: { name: 'Summit Sunday', icon: '⛰️', short: 'Summit', blurb: 'A little of everything: a mini wall, a short ladder and a quick chase.' }
  };

  /* ---------------- rules shared by the game, console and builder ---------------- */
  const RULES = {
    timer: 20,                     // seconds for every question
    wallTimer: 150, miniWallTimer: 75, finaleTimer: 30,
    chase: { rungs: 8, qs: 7, head: [50, 120, 200], prompts: 3, finale: 10, d: [2, 2, 2, 3, 3, 3, 4], boa: [4, 5, 5, 5, 6], boaStart: -1 },
    miniChase: { rungs: 6, qs: 4, head: [40, 75], prompts: 1, finale: 8, d: [2, 2, 3, 3], boa: [2, 3, 3], boaStart: -1 },
    ladder: { d: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4], spare: [2, 3], safe: [3, 9], points: [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000] },
    miniLadder: { d: [1, 2, 3, 3, 4], spare: [3], safe: [2], points: [100, 200, 400, 700, 1000] },
    layers: ['Forest floor', 'Understory', 'Canopy', 'Emergent']
  };
  /** which rainforest layer a rung belongs to (rung 1..n of n) */
  const layerOf = (rung, n) => RULES.layers[Math.min(3, Math.max(0, Math.floor(((rung - 1) / Math.max(1, n)) * 4)))];

  /* =========================================================================
     ENCODING — "TFT1:" + base64 of the JSON XOR'd with a fixed key stream.
     Not secret, just not readable at a glance or by search engines.
     ========================================================================= */
  const MAGIC = 'TFT1:', KEY = 'tree-frog-trivia/harryh.xyz';
  const hasBuf = typeof Buffer !== 'undefined' && typeof window === 'undefined';
  function xor(bytes) { const R = rng(hash(KEY)), out = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ ((R() * 256) | 0); return out; }
  function toB64(bytes) { if (hasBuf) return Buffer.from(bytes).toString('base64'); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function fromB64(b64) { b64 = b64.replace(/\s+/g, ''); if (hasBuf) return new Uint8Array(Buffer.from(b64, 'base64')); const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  function encode(obj) { const b = xor(new TextEncoder().encode(JSON.stringify(obj))), s = toB64(b); return MAGIC + '\n' + s.replace(/(.{100})/g, '$1\n') + '\n'; }
  function decode(str) {
    str = String(str || '').trim();
    if (str[0] === '{') return JSON.parse(str);   // a plain file still works
    if (!str.startsWith(MAGIC)) throw new Error('Not a Tree-Frog Trivia file');
    return JSON.parse(new TextDecoder().decode(xor(fromB64(str.slice(MAGIC.length)))));
  }

  /* =========================================================================
     FORGIVING ANSWERS
     ========================================================================= */
  const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20 };
  const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
  const ROMAN_SET = new Set(ROMAN.slice(1));
  const SWAP = { st: 'saint', ste: 'saint', mt: 'mount', mr: 'mister', dr: 'doctor', '&': 'and', vs: 'v', versus: 'v', centre: 'center', grey: 'gray', colour: 'color', theatre: 'theater', favourite: 'favorite', jewellery: 'jewelry' };
  /** lower-case, no accents or punctuation, "the" dropped, St → Saint, "Henry the 8th" → "henry viii" */
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ł/g, 'l');
    s = s.replace(/&/g, ' and ').replace(/['’‘`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const t = s.split(' ').filter(Boolean).map((w) => SWAP[w] || w), out = [];
    for (let i = 0; i < t.length; i++) {
      const w = t[i];
      if (w === 'the' && (i === 0 ? t.length > 1 : (ORD[t[i + 1]] || /^\d{1,2}(st|nd|rd|th)$/.test(t[i + 1] || '')))) continue;
      let n = ORD[w] || +((/^(\d{1,2})(st|nd|rd|th)$/.exec(w) || [])[1] || 0);
      if (!n && /^\d{1,2}$/.test(w) && out.length && /^[a-z]+$/.test(out[out.length - 1]) && !ROMAN_SET.has(out[out.length - 1])) n = +w;
      out.push(n >= 1 && n <= 20 && out.length ? ROMAN[n] : w);
    }
    return out.join(' ');
  }
  const keyOf = (s) => norm(s).replace(/ /g, '');
  /** how many slips we allow for an answer of this length (numbers must be exact) */
  function tol(k) { if (/\d/.test(k)) return 0; const n = k.length; return n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : 3; }
  /** optimal-string-alignment distance (typos incl. swapped letters), bails out above `max` */
  function osa(a, b, max = 99) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length, n = b.length; let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i]; let low = i;
      for (let j = 1; j <= n; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < low) low = v;
      }
      if (low > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[n];
  }
  const formsOf = (it) => [it.n].concat(it.a || []);
  /**
   * match a typed answer.
   * valid / decoys: [{ n: name, a: [alternative names] }]
   * → { ok, item, corrected, decoy, empty }
   *   ok: counts · corrected: we fixed a typo or it was an alternative name · decoy: it's a real thing that doesn't fit
   */
  function matchAnswer(input, valid, decoys) {
    const q = keyOf(input); if (!q) return { ok: false, empty: true };
    let best = null;
    const consider = (list, kind) => {
      for (const it of list || []) for (const f of formsOf(it)) {
        const k = keyOf(f); if (!k) continue;
        let d;
        if (k === q) d = 0;
        else {
          if (q.length < 3) continue;
          const t = tol(k);
          d = Math.abs(k.length - q.length) > t ? t + 1 : osa(q, k, t);
          // a clear start of a long name counts too ("czech rep" → Czech Republic)
          if (d > t && q.length >= 5 && q.length >= k.length * 0.6 && k.startsWith(q)) d = Math.max(1, t);
          if (d > t) continue;
        }
        // lower distance wins; on a tie a decoy beats a fuzzy valid match (so "Austrlia" isn't turned into Austria), but an exact valid match always counts
        if (!best || d < best.d || (d === best.d && kind === 'decoy' && best.kind === 'valid' && d > 0)) best = { it, kind, d, exactForm: k === keyOf(it.n) };
      }
    };
    consider(valid, 'valid'); consider(decoys, 'decoy');
    if (!best) return { ok: false };
    return { ok: best.kind === 'valid', item: best.it, decoy: best.kind === 'decoy', corrected: best.d > 0 || !best.exactForm };
  }
  /** does a typed connection name the link? keys: ['rivers', 'river'] — matches as words anywhere, with typo tolerance */
  function matchLink(input, keys) {
    const q = norm(input); if (!q) return false;
    const qw = q.split(' ');
    for (const raw of keys || []) {
      const k = norm(raw); if (!k) continue;
      if ((' ' + q + ' ').includes(' ' + k + ' ')) return true;
      const kw = k.split(' '), ks = k.replace(/ /g, ''), t = tol(ks);
      for (let i = 0; i + kw.length <= qw.length; i++) {
        const win = qw.slice(i, i + kw.length).join('');
        if (osa(win, ks, t) <= t) return true;
        // allow a plural / singular slip on the last word
        if (osa(win.replace(/e?s$/, ''), ks.replace(/e?s$/, ''), t) <= t) return true;
      }
      if (osa(q.replace(/ /g, ''), ks, t) <= t) return true;
    }
    return false;
  }

  /* =========================================================================
     RARITY — within a prompt's valid answers, 0 = the most viewed/known,
     100 = the least. Ties share the same score.
     ========================================================================= */
  function rarity(items, scoreOf) {
    const s = items.map((it, i) => ({ i, v: scoreOf(it) })).sort((a, b) => b.v - a.v), n = s.length, out = new Array(n);
    for (let i = 0; i < n;) {
      let j = i; while (j + 1 < n && s[j + 1].v === s[i].v) j++;
      const r = n < 2 ? 50 : Math.round((100 * (i + j) / 2) / (n - 1));
      for (let k = i; k <= j; k++) out[s[k].i] = r;
      i = j + 1;
    }
    return out;
  }
  /** fame 1–5 (hand estimate), with a tiny deterministic nudge so ties spread out a little */
  const fameScore = (it) => (it.f || 3) * 1000 + (hash(it.n) % 997) / 10;
  function applyRarity(P, views) {
    const useViews = views && P.ans.every((x) => views[x.w || x.n] != null);
    const r = rarity(P.ans, useViews ? (x) => views[x.w || x.n] + (x.f || 3) / 10 : fameScore);
    P.ans.forEach((x, i) => { x.r = r[i]; });
    P.rs = useViews ? 'views' : 'fame';
    return P;
  }

  /* =========================================================================
     PROMPTS — "Name a…" templates expand from the bank's master lists
     ========================================================================= */
  const CONT = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania' };
  function passes(e, w) {
    if (!w) return true;
    if (w.c && !(e.c || []).includes(w.c)) return false;
    if (w.flag && !(e.fl || '').includes(w.flag)) return false;
    if (w.letter && keyOf(e.n)[0] !== w.letter.toLowerCase()) return false;
    if (w.tag && !(e.t || []).includes(w.tag)) return false;
    if (w.not && (e.t || []).includes(w.not)) return false;
    return true;
  }
  /** → { valid: [{n,a,w,f}], decoys: [{n,a}] } */
  function expandPrompt(bank, p) {
    const pick = (e) => ({ n: e.n, a: (e.a || []).slice(), w: e.w || e.n, f: e.f || 3 });
    let valid, decoys;
    if (p.items) { valid = p.items.map(pick); decoys = (p.decoys || []).map((d) => ({ n: d.n || d, a: d.a || [] })); }
    else {
      const list = (bank.lists || {})[p.list] || [];
      if (p.cap) {
        // capitals of the countries that pass the filter
        const caps = (e) => (e.cap || []).map((c) => ({ n: c.n, a: (c.a || []).slice(), w: c.w || c.n, f: c.f || e.f || 3 }));
        valid = []; decoys = [];
        list.forEach((e) => (passes(e, p.where) ? valid : decoys).push(...caps(e)));
        decoys = decoys.concat((bank.lists.notCapitals || []).map((d) => ({ n: d.n, a: d.a || [] })));
      } else {
        valid = list.filter((e) => passes(e, p.where)).map(pick);
        decoys = p.decoy === false ? [] : list.filter((e) => !passes(e, p.where)).map((e) => ({ n: e.n, a: e.a || [] }));
      }
      if (p.extraDecoys) decoys = decoys.concat(p.extraDecoys.map((d) => ({ n: d.n || d, a: d.a || [] })));
    }
    // a name that is valid never doubles as a decoy
    const vk = new Set(valid.flatMap((v) => formsOf(v).map(keyOf)));
    decoys = decoys.map((d) => ({ n: d.n, a: (d.a || []).filter((x) => !vk.has(keyOf(x))) })).filter((d) => !vk.has(keyOf(d.n)));
    return { valid, decoys };
  }
  function promptForDay(bank, p, views) {
    const { valid, decoys } = expandPrompt(bank, p);
    const P = { id: p.id, q: p.q, hint: p.hint || '', ans: valid, dec: decoys };
    if (p.views === false) { P.fixed = 1; applyRarity(P, null); P.rs = 'hand'; return P; }   // no sensible Wikipedia pages: hand estimates by design
    return applyRarity(P, views);
  }

  /* =========================================================================
     THE DAY BUILDER
     state = { used: { mcq: Set, links: Set, walls: Set, half: Set }, plast: { promptId: iso } }
     ========================================================================= */
  class BankEmpty extends Error { constructor(what) { super('The question bank has run out of ' + what); this.what = what; } }
  const NO_REPEAT = 730;   // days before anything may be used again
  /** used: { mcq: { id: iso }, links: {…}, walls: {…}, half: {…}, prompts: {…} } — older manifests stored plain id lists */
  function newState(manifest) {
    const u = (manifest && manifest.used) || {}, asMap = (x, d) => (Array.isArray(x) ? Object.fromEntries(x.map((id) => [id, d || '2000-01-01'])) : Object.assign({}, x || {}));
    return { used: { mcq: asMap(u.mcq), links: asMap(u.links), walls: asMap(u.walls), half: asMap(u.half) }, plast: asMap(u.prompts), iso: null };
  }
  function stateToUsed(st) { const s = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])); return { mcq: s(st.used.mcq), links: s(st.used.links), walls: s(st.used.walls), half: s(st.used.half), prompts: s(st.plast) }; }
  /** free to use on `iso`? never used, or last used at least NO_REPEAT days before */
  const free = (map, id, iso) => !map[id] || (iso && dayDiff(map[id], iso) >= NO_REPEAT);
  function pickMCQ(bank, st, R, d, avoid) {
    for (const dd of [d, d + 1, d - 1, d + 2, d - 2]) {
      if (dd < 1 || dd > 4) continue;
      const pool = bank.mcq.filter((q) => q.d === dd && free(st.used.mcq, q.id, st.iso) && !avoid.has(q.id) && !q.off);
      if (pool.length) { const q = pool[Math.floor(R() * pool.length)]; st.used.mcq[q.id] = st.iso; avoid.add(q.id); return clone(q); }
    }
    throw new BankEmpty('multiple-choice questions');
  }
  function pickFrom(arr, used, R, what, iso) {
    const pool = arr.filter((x) => free(used, x.id, iso) && !x.off);
    if (!pool.length) throw new BankEmpty(what);
    const x = pool[Math.floor(R() * pool.length)]; used[x.id] = iso; return clone(x);
  }
  function pickPrompts(bank, st, R, iso, n, views) {
    const out = [], groups = new Set();
    const pool = shuffle(bank.prompts.filter((p) => !p.off && free(st.plast, p.id, iso)), R);
    if (pool.length < n) throw new BankEmpty('“Name a…” prompts');
    // spread the subjects: one prompt per master list per day where possible
    for (const p of pool) { if (out.length >= n) break; const g = p.grp || p.list || p.id; if (groups.has(g)) continue; groups.add(g); out.push(p); }
    for (const p of pool) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
    out.forEach((p) => { st.plast[p.id] = iso; });
    return out.map((p) => promptForDay(bank, p, views));
  }
  function pollFor(R, d) {
    let a = [0, 74, 60, 46, 36][d] + Math.round((R() - 0.5) * 18);
    const fooled = d >= 3 && R() < 0.14;
    const w = [R() + 0.2, R() + 0.2, R() + 0.2];
    if (fooled) { w[0] += 2.2; a = Math.max(18, a - 18); }
    const rest = 100 - a, sw = w.reduce((x, y) => x + y, 0);
    const wp = w.map((x) => Math.round((x / sw) * rest)); wp[2] = rest - wp[0] - wp[1];
    return { a, w: wp };
  }
  function boaPattern(R, n, counts) {
    const k = counts[Math.floor(R() * counts.length)], idx = shuffle([...Array(n).keys()], R).slice(0, k), out = Array(n).fill(0);
    idx.forEach((i) => { out[i] = 1; }); return out;
  }
  function finaleItems(bank, st, R, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const L = pickFrom(bank.links, st.used.links, R, 'finale connections', st.iso);
      const others = shuffle(bank.links.filter((x) => x.id !== L.id && keyOf(x.l) !== keyOf(L.l)), R).slice(0, 2).map((x) => x.l);
      out.push({ id: L.id, v: shuffle(L.v, R).slice(0, 3), a: L.l, w: others });
    }
    return out;
  }
  function chaseFor(bank, st, R, iso, rules, views) {
    const avoid = new Set();
    const qs = rules.d.map((d) => { const q = pickMCQ(bank, st, R, d, avoid); q.w = shuffle(q.w, R).slice(0, 2); return q; });
    return { prompts: pickPrompts(bank, st, R, iso, rules.prompts, views), qs, boa: boaPattern(R, rules.qs, rules.boa), fin: finaleItems(bank, st, R, rules.finale) };
  }
  function ladderFor(bank, st, R, rules) {
    const avoid = new Set();
    const qs = rules.d.map((d) => pickMCQ(bank, st, R, d, avoid));
    const spare = rules.spare.map((d) => pickMCQ(bank, st, R, d, avoid));
    const poll = {}; qs.concat(spare).forEach((q) => { poll[q.id] = pollFor(R, q.d); });
    return { qs, spare, poll };
  }
  function wallFor(arr, used, R, what, iso) { const w = pickFrom(arr, used, R, what, iso); return { id: w.id, g: w.g, order: shuffle([...Array(w.g.length * 4).keys()], R) }; }
  /** builds one day. Mutates `st` (marks what was used). */
  function buildDay(iso, bank, st, opts = {}) {
    const style = opts.style || styleOf(iso), R = rng(hash('tft:' + iso + ':' + (opts.salt || ''))), views = opts.views || null;
    const day = { v: 1, iso, style, made: new Date().toISOString().slice(0, 10) };
    st.iso = iso;
    if (style === 'chase') day.chase = chaseFor(bank, st, R, iso, RULES.chase, views);
    if (style === 'ladder') day.ladder = ladderFor(bank, st, R, RULES.ladder);
    if (style === 'wall') day.wall = wallFor(bank.walls, st.used.walls, R, 'walls', iso);
    if (style === 'summit') day.summit = { wall: wallFor(bank.half, st.used.half, R, 'mini walls', iso), ladder: ladderFor(bank, st, R, RULES.miniLadder), chase: chaseFor(bank, st, R, iso, RULES.miniChase, views) };
    day.rs = rsOf(day);
    return day;
  }
  const rsOf = (day) => (allPrompts(day).every((p) => p.fixed || p.rs === 'views') ? 'views' : 'fame');
  const allPrompts = (day) => (day.chase ? day.chase.prompts : day.summit ? day.summit.chase.prompts : []) || [];
  /** how many more days the bank can cover, style by style, from `fromISO` */
  function bankRunway(bank, manifest, fromISO, max = 400) {
    const st = newState(manifest); let n = 0;
    try { for (; n < max; n++) buildDay(addDays(fromISO, n), bank, st); } catch (e) { if (!(e instanceof BankEmpty)) throw e; }
    return n;
  }
  /** what's still unused (or free again) on `iso` */
  function bankCounts(bank, manifest, iso) {
    const st = newState(manifest), c = { mcq: {}, links: 0, walls: 0, half: 0, prompts: 0 };
    [1, 2, 3, 4].forEach((d) => { c.mcq[d] = bank.mcq.filter((q) => q.d === d && free(st.used.mcq, q.id, iso) && !q.off).length; });
    c.links = bank.links.filter((x) => free(st.used.links, x.id, iso) && !x.off).length;
    c.walls = bank.walls.filter((x) => free(st.used.walls, x.id, iso) && !x.off).length;
    c.half = bank.half.filter((x) => free(st.used.half, x.id, iso) && !x.off).length;
    c.prompts = (bank.prompts || []).filter((p) => free(st.plast, p.id, iso) && !p.off).length;
    return c;
  }

  /* =========================================================================
     QUALITY CHECKS — warnings the console shows for a day
     ========================================================================= */
  function check(day) {
    const W = [], k = keyOf;
    const mcq = (q, where) => {
      if (!q || !q.q || !q.a) { W.push(where + ': question or answer is empty'); return; }
      if ((q.w || []).some((x) => !String(x).trim())) W.push(where + ': an empty wrong option');
      const all = [q.a].concat(q.w || []).map(k); if (new Set(all).size !== all.length) W.push(where + ': two options are the same');
      if (/\b(currently|this year|latest|reigning|current)\b/i.test(q.q)) W.push(where + ': may go out of date ("' + q.q.slice(0, 40) + '…")');
    };
    const prompt = (p, where) => {
      if (!p.ans || p.ans.length < 5) W.push(where + ': fewer than 5 valid answers');
      const seen = new Map();
      (p.ans || []).forEach((a) => formsOf(a).forEach((f) => { const kk = k(f); if (seen.has(kk) && seen.get(kk) !== a.n) W.push(where + `: “${f}” matches both ${seen.get(kk)} and ${a.n}`); seen.set(kk, a.n); }));
      if (p.rs !== 'views' && !p.fixed) W.push(where + ': rarity is still the hand estimate (run the Action, or Refresh rarity)');
    };
    const wall = (w, where) => {
      const items = (w.g || []).flatMap((g) => g.v || []).map(k);
      if (new Set(items).size !== items.length) W.push(where + ': the same vine appears twice');
      (w.g || []).forEach((g, i) => { if ((g.v || []).length !== 4) W.push(where + ` group ${i + 1}: needs exactly 4 vines`); if (!(g.k || []).length) W.push(where + ` group ${i + 1}: no answer keywords`); });
    };
    const chase = (c, tag) => {
      (c.prompts || []).forEach((p, i) => prompt(p, `${tag} prompt ${i + 1}`));
      (c.qs || []).forEach((q, i) => mcq(q, `${tag} question ${i + 1}`));
      (c.fin || []).forEach((f, i) => { if (!f.a || (f.v || []).length < 3) W.push(`${tag} finale ${i + 1}: incomplete`); });
    };
    const ladder = (l, tag) => { (l.qs || []).forEach((q, i) => mcq(q, `${tag} rung ${i + 1}`)); (l.spare || []).forEach((q, i) => mcq(q, `${tag} spare ${i + 1}`)); };
    if (day.chase) chase(day.chase, 'Chase');
    if (day.ladder) ladder(day.ladder, 'Ladder');
    if (day.wall) wall(day.wall, 'Wall');
    if (day.summit) { wall(day.summit.wall, 'Mini wall'); ladder(day.summit.ladder, 'Mini ladder'); chase(day.summit.chase, 'Mini chase'); }
    if (day.flag) W.unshift('Flagged: ' + day.flag);
    return W;
  }

  /* =========================================================================
     WIKIPEDIA PAGEVIEWS + WIKIDATA (used by the Action and the console)
     fetchFn defaults to the global fetch; headers are only sent from Node.
     ========================================================================= */
  const UA = 'TreeFrogTrivia/1.0 (https://harryh.xyz/trivia; github.com/ducklops/harry)';
  const inNode = typeof window === 'undefined';
  const hdr = (extra) => Object.assign(inNode ? { 'User-Agent': UA } : {}, extra || {});
  async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
  /** resolves redirects so pageviews are counted on the real article: { asked → canonical } */
  async function canonicalTitles(titles, fetchFn = fetch) {
    const map = {}, uniq = [...new Set(titles)];
    for (let i = 0; i < uniq.length; i += 50) {
      const chunk = uniq.slice(i, i + 50);
      const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&origin=*&titles=' + encodeURIComponent(chunk.join('|'));
      try {
        const j = await (await fetchFn(url, { headers: hdr() })).json(), q = j.query || {};
        const step = {}; (q.normalized || []).forEach((x) => { step[x.from] = x.to; }); (q.redirects || []).forEach((x) => { step[x.from] = x.to; });
        chunk.forEach((t) => { let c = t, guard = 0; while (step[c] && guard++ < 4) c = step[c]; map[t] = c; });
      } catch (e) { chunk.forEach((t) => { map[t] = t; }); }
    }
    return map;
  }
  /** total English Wikipedia views over the last 12 full months, per title. Missing pages are left out (so the prompt keeps its hand estimate). */
  async function fetchViews(titles, fetchFn = fetch, log = () => {}) {
    const now = new Date(), end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)), start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 1));
    const f = (d) => d.toISOString().slice(0, 10).replace(/-/g, '') + '00';
    const canon = await canonicalTitles(titles, fetchFn), out = {};
    await pool([...new Set(titles)], 6, async (t) => {
      const c = canon[t] || t, url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(c.replace(/ /g, '_'))}/monthly/${f(start)}/${f(end)}`;
      try {
        const r = await fetchFn(url, { headers: hdr() });
        if (r.status === 404) { log('No Wikipedia page for “' + t + '” — fix its title in the bank; this prompt keeps the hand estimate'); return; }
        if (!r.ok) throw new Error(r.status);
        out[t] = ((await r.json()).items || []).reduce((s, x) => s + (x.views || 0), 0);
      } catch (e) { log('Pageviews failed for “' + t + '”: ' + e.message); }
    });
    return out;
  }
  /** runs a template's Wikidata query; returns rows { label, alts[], title } */
  async function fetchWikidata(body, fetchFn = fetch) {
    const q = `SELECT ?item ?label ?title (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE { ${body}
      ?item rdfs:label ?label FILTER(LANG(?label) = "en")
      OPTIONAL { ?item skos:altLabel ?alt FILTER(LANG(?alt) = "en") }
      OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title }
    } GROUP BY ?item ?label ?title`;
    const r = await fetchFn('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: hdr({ Accept: 'application/sparql-results+json' }) });
    if (!r.ok) throw new Error('Wikidata ' + r.status);
    const j = await r.json();
    return j.results.bindings.map((b) => ({ label: b.label.value, title: b.title ? b.title.value : '', alts: b.alts && b.alts.value ? b.alts.value.split('|') : [] }));
  }
  /**
   * merges a Wikidata result into a template's answer list: adds alternative names, and (when the
   * template allows it and the counts agree) answers our hand list was missing. Returns a report line.
   */
  function mergeWikidata(valid, decoys, rows, allowAdd) {
    const byKey = new Map(); valid.forEach((v) => formsOf(v).concat([v.w || '']).forEach((f) => { const kk = keyOf(f); if (kk) byKey.set(kk, v); }));
    const decoyKeys = new Set(decoys.flatMap((d) => formsOf(d).map(keyOf)));
    const okAlt = (s) => s && s.length >= 3 && s.length <= 40 && !/^[A-Z0-9]{2,4}$/.test(s) && !/[()]/.test(s) && !decoyKeys.has(keyOf(s));
    let matched = 0, added = 0, alts = 0; const unmatched = [];
    for (const row of rows) {
      const hit = [row.label, row.title].concat(row.alts).map(keyOf).map((kk) => byKey.get(kk)).find(Boolean);
      if (hit) {
        matched++;
        row.alts.concat([row.label]).filter(okAlt).forEach((a) => { if (!formsOf(hit).map(keyOf).includes(keyOf(a))) { hit.a.push(a); alts++; } });
      } else unmatched.push(row);
    }
    const coverage = valid.length ? matched / valid.length : 0;
    if (allowAdd && coverage >= 0.9 && unmatched.length <= Math.max(2, valid.length * 0.15)) {
      unmatched.filter((r) => okAlt(r.label) && !decoyKeys.has(keyOf(r.label))).forEach((r) => { valid.push({ n: r.label, a: r.alts.filter(okAlt), w: r.title || r.label, f: 1 }); added++; });
    }
    return { matched, coverage: Math.round(coverage * 100), alts, added, unmatched: unmatched.length };
  }
  /**
   * brings a day's prompts up to date: Wikidata names (if the template has a query) and pageview rarity.
   * cache: { title: { v: views, t: 'YYYY-MM-DD' } } is updated in place.
   */
  async function refreshDay(day, bank, cache, opts = {}) {
    const fetchFn = opts.fetch || fetch, log = opts.log || (() => {}), today = opts.today || londonDay();
    const prompts = allPrompts(day); if (!prompts.length) return day;
    for (const P of prompts) {
      const tpl = (bank.prompts || []).find((p) => p.id === P.id);
      if (tpl && tpl.wd && !P.wd) {
        try { const rep = mergeWikidata(P.ans, P.dec, await fetchWikidata(tpl.wd, fetchFn), !!tpl.wdAdd); P.wd = 1; log(`${day.iso} · ${P.q}: Wikidata matched ${rep.coverage}% of our list, added ${rep.alts} alternative names${rep.added ? ' and ' + rep.added + ' answers' : ''}`); }
        catch (e) { log(`${day.iso} · ${P.q}: Wikidata didn't answer (${e.message}), kept our list`); }
      }
      if (P.fixed) continue;
      const need = P.ans.map((a) => a.w || a.n).filter((t) => !cache[t] || dayDiff(cache[t].t, today) > 60);
      if (need.length) { const v = await fetchViews(need, fetchFn, log); Object.entries(v).forEach(([t, n]) => { cache[t] = { v: n, t: today }; }); }
      const views = {}; P.ans.forEach((a) => { const c = cache[a.w || a.n]; if (c) views[a.w || a.n] = c.v; });
      applyRarity(P, views);
    }
    day.rs = rsOf(day);
    return day;
  }

  /* =========================================================================
     PLAIN-TEXT QUESTION FORMAT — used for the source files, the console's
     top-up pack download, and importing new questions back in.
       ## questions   2|Question?|Answer{other accepted answer;another}|Wrong|Wrong|Wrong
       ## finale      What links them|Member;Member;Member;Member
       ## walls       4 lines per wall, blank line between: Link|keywords;keywords|Vine;Vine;Vine;Vine
       ## mini walls  the same with 2 lines per wall
       ## prompts     Name a …|Answer{alias}^fame;Answer^fame;…|Wrong answer;Wrong answer
     ========================================================================= */
  /** "Name{alias;alias}@Wiki title^4 #tag,tag" → { n, a, w, f, t } */
  function parseEntry(s) {
    const m = String(s).trim().match(/^(.*?)(?:\{([^}]*)\})?(?:@([^^#]*?))?(?:\^(\d))?(?:\s+#([\w,]+))?$/);
    if (!m) return { n: String(s).trim() };
    const e = { n: m[1].trim() };
    if (m[2]) e.a = m[2].split(';').map((x) => x.trim()).filter(Boolean);
    if (m[3] && m[3].trim()) e.w = m[3].trim();
    if (m[4]) e.f = +m[4];
    if (m[5]) e.t = m[5].split(',').filter(Boolean);
    return e;
  }
  const entryText = (e) => e.n + (e.a && e.a.length ? '{' + e.a.join(';') + '}' : '') + (e.w && e.w !== e.n ? '@' + e.w : '') + (e.f ? '^' + e.f : '');
  /** a multiple-choice line: "d|q|answer{alts}|w|w|w" */
  function parseMCQ(line, d0) {
    let parts = line.split('|').map((x) => x.trim());
    let d = d0;
    if (/^[1-4]$/.test(parts[0])) { d = +parts[0]; parts = parts.slice(1); }
    if (parts.length < 5 || !d) return null;
    const a = parseEntry(parts[1]);
    const q = { d, q: parts[0], a: a.n, w: parts.slice(2, 5) };
    if (a.a) q.alt = a.a;
    return q;
  }
  const mcqText = (q) => `${q.d}|${q.q}|${q.a}${q.alt && q.alt.length ? '{' + q.alt.join(';') + '}' : ''}|${q.w.join('|')}`;
  function parseLink(line) { const p = line.split('|').map((x) => x.trim()); if (p.length < 2) return null; const v = p[p.length - 1].split(';').map((x) => x.trim()).filter(Boolean); return v.length >= 3 ? { l: p[0], v } : null; }
  function parseGroup(line) { const p = line.split('|').map((x) => x.trim()); if (p.length < 3) return null; return { l: p[0], k: p[1].split(';').map((x) => x.trim()).filter(Boolean), v: p[2].split(';').map((x) => x.trim()).filter(Boolean) }; }
  const groupText = (g) => `${g.l}|${(g.k || []).join(';')}|${g.v.join(';')}`;
  function parsePrompt(line) {
    const p = line.split('|').map((x) => x.trim()); if (p.length < 2) return null;
    const items = p[1].split(';').map((x) => x.trim()).filter(Boolean).map(parseEntry);
    const decoys = (p[2] || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const e = parseEntry(x); return { n: e.n, a: e.a || [] }; });
    return items.length >= 5 ? { q: p[0], items, decoys } : null;
  }
  /** reads any mix of the sections above. Lines starting with "#", "-" or ">" are notes and are skipped. */
  function parseQuestionText(text) {
    const out = { mcq: [], links: [], walls: [], half: [], prompts: [], errors: [] };
    let sec = null, block = [];
    const flush = () => {
      if (!block.length) return;
      const groups = block.map(parseGroup);
      if (groups.some((g) => !g)) out.errors.push('A wall line is missing a part: ' + block.join(' / '));
      else if (sec === 'walls' && groups.length === 4) out.walls.push({ g: groups });
      else if (sec === 'mini' && groups.length === 2) out.half.push({ g: groups });
      else out.errors.push(`A ${sec === 'mini' ? 'mini wall needs 2' : 'wall needs 4'} lines, found ${groups.length}: ${block[0]}…`);
      block = [];
    };
    String(text || '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      const h = line.match(/^##\s*(.+)$/);
      if (h) {
        flush(); const t = h[1].toLowerCase();
        sec = /mini/.test(t) ? 'mini' : /wall/.test(t) ? 'walls' : /final|link|connect/.test(t) ? 'links' : /prompt|name a/.test(t) ? 'prompts' : /question|mcq|multiple/.test(t) ? 'mcq' : null;
        return;
      }
      if (!line) { flush(); return; }
      if (/^[#>\-*]/.test(line) || !sec) return;
      if (sec === 'walls' || sec === 'mini') { block.push(line); return; }
      const r = sec === 'mcq' ? parseMCQ(line) : sec === 'links' ? parseLink(line) : parsePrompt(line);
      if (r) out[sec].push(r); else out.errors.push(`Line ${i + 1} doesn't match the ${sec} format: ${line.slice(0, 80)}`);
    });
    flush();
    return out;
  }
  /** adds parsed questions to the bank with fresh ids, skipping anything already there. → { added, skipped } */
  function addToBank(bank, parsed) {
    const next = (arr, pre) => { let n = arr.reduce((m, x) => Math.max(m, +(String(x.id).replace(/\D/g, '')) || 0), 0); return () => pre + String(++n).padStart(4, '0'); };
    const seenQ = new Set(bank.mcq.map((q) => keyOf(q.q))), seenL = new Set(bank.links.map((x) => keyOf(x.l) + ':' + x.v.map(keyOf).sort().join(',')));
    const seenW = new Set(bank.walls.concat(bank.half).map((w) => w.g.flatMap((g) => g.v.map(keyOf)).sort().join(',')));
    const seenP = new Set((bank.prompts || []).map((p) => keyOf(p.q)));
    const r = { added: { mcq: 0, links: 0, walls: 0, half: 0, prompts: 0 }, skipped: [] };
    const nm = next(bank.mcq, 'm'), nl = next(bank.links, 'l'), nw = next(bank.walls, 'w'), nh = next(bank.half, 'h'), np = next(bank.prompts || [], 'p');
    parsed.mcq.forEach((q) => { const k = keyOf(q.q); if (seenQ.has(k)) { r.skipped.push('Already in the bank: ' + q.q); return; } seenQ.add(k); bank.mcq.push(Object.assign({ id: nm() }, q)); r.added.mcq++; });
    parsed.links.forEach((x) => { const k = keyOf(x.l) + ':' + x.v.map(keyOf).sort().join(','); if (seenL.has(k)) { r.skipped.push('Already in the bank: ' + x.l); return; } seenL.add(k); bank.links.push(Object.assign({ id: nl() }, x)); r.added.links++; });
    const wall = (w, arr, nid, key) => { const k = w.g.flatMap((g) => g.v.map(keyOf)).sort().join(','); if (seenW.has(k)) { r.skipped.push('Already in the bank: wall starting ' + w.g[0].l); return; } seenW.add(k); arr.push(Object.assign({ id: nid() }, w)); r.added[key]++; };
    parsed.walls.forEach((w) => wall(w, bank.walls, nw, 'walls'));
    parsed.half.forEach((w) => wall(w, bank.half, nh, 'half'));
    bank.prompts = bank.prompts || [];
    parsed.prompts.forEach((p) => { const k = keyOf(p.q); if (seenP.has(k)) { r.skipped.push('Already in the bank: ' + p.q); return; } seenP.add(k); bank.prompts.push(Object.assign({ id: np(), views: false }, p)); r.added.prompts++; });
    return r;
  }
  /**
   * the console's "top-up pack": every question with when it was used, what's running low, and a
   * ready-to-paste request for Claude to write more in exactly this format.
   */
  function packText(bank, manifest, iso) {
    const st = newState(manifest), today = iso || londonDay();
    const usedOn = (map, id) => (map[id] ? 'used ' + map[id] : 'not used yet');
    const runway = bankRunway(bank, manifest, addDays(Object.keys((manifest && manifest.days) || {}).sort().pop() || today, 1));
    const c = bankCounts(bank, manifest, today);
    // what a 12-week top-up needs (24 chases, 24 ladders, 24 walls, 12 summits)
    const need = { 1: 84, 2: 204, 3: 228, 4: 108 };
    const L = [];
    L.push('# Tree-Frog Trivia — question bank top-up pack');
    L.push(`# Made ${today}. Built days run to ${Object.keys((manifest && manifest.days) || {}).sort().pop() || 'none yet'}; the unused bank covers about ${runway} more days.`);
    L.push('#');
    L.push('# HOW TO USE');
    L.push('#  1. Paste this whole file into a chat with Claude (or any AI) and send it.');
    L.push('#  2. Copy the reply (just the new ## sections) into the console: Trivia desk → Import questions.');
    L.push('#  3. The console checks the format, skips anything already in the bank, and saves the rest.');
    L.push('#');
    L.push('# ─────────────────────────────── REQUEST FOR CLAUDE ───────────────────────────────');
    L.push('> Please write NEW questions for Tree-Frog Trivia, a daily UK general-knowledge quiz.');
    L.push('> Audience: UK adults and teenagers, pub-quiz range, British slant (geography, history, science, nature,');
    L.push('> sport, music, film/TV, literature, food, language). Every fact must be checkable and not go out of date:');
    L.push('> avoid "current", "latest", record holders that may change, or anything after your knowledge cutoff.');
    L.push('> Do NOT repeat or closely rephrase anything listed below in "ALREADY IN THE BANK" — not the same question,');
    L.push('> not the same fact asked another way. Keep wrong answers plausible and the same type as the answer.');
    L.push('> Reply with ONLY these sections, in exactly this format (no numbering, no commentary):');
    L.push('>   ## questions     d|Question?|Answer{other accepted spellings;nicknames}|Wrong|Wrong|Wrong');
    L.push('>                    d = difficulty: 1 forest floor (easy) · 2 understory · 3 canopy · 4 emergent (hard)');
    L.push('>   ## finale        Connection|Member;Member;Member;Member   (any 3 members must give the link away)');
    L.push('>   ## walls         4 lines then a blank line:  Connection|keywords that count as naming it;more|Vine;Vine;Vine;Vine');
    L.push('>                    Put in red herrings: vines that seem to fit another group on the same wall. All 16 vines different.');
    L.push('>   ## mini walls    the same, 2 lines per wall');
    L.push('>   ## prompts       Name a …|Answer{alias}^fame;Answer^fame;…|Tempting wrong answer;Another');
    L.push('>                    Every valid answer must be listed. fame 1 (obscure) to 5 (everyone says it).');
    const want = (d) => Math.max(0, need[d] - c.mcq[d]);
    L.push(`> Please write: ${[1, 2, 3, 4].map((d) => want(d) + ' difficulty-' + d).join(', ')} questions; ${Math.max(0, 336 - c.links)} finale connections; ${Math.max(0, 24 - c.walls)} walls; ${Math.max(0, 12 - c.half)} mini walls; ${Math.max(0, 84 - c.prompts)} prompts.`);
    L.push('> (If that is too many for one reply, do as many as you can and I will ask for the rest.)');
    L.push('#');
    L.push(`# WHAT'S LEFT (unused, or free again after ${NO_REPEAT} days): questions ${[1, 2, 3, 4].map((d) => 'd' + d + ' ' + c.mcq[d]).join(' · ')} · finale ${c.links} · walls ${c.walls} · mini walls ${c.half} · prompts ${c.prompts}`);
    L.push('#');
    L.push('# ──────────────────────────── ALREADY IN THE BANK (don\'t repeat) ────────────────────────────');
    L.push('# Each line shows when it was used. Nothing is reused within ' + NO_REPEAT + ' days.');
    L.push('#');
    L.push('# Questions');
    bank.mcq.slice().sort((a, b) => a.d - b.d).forEach((q) => L.push(`- ${mcqText(q)}   (${usedOn(st.used.mcq, q.id)})`));
    L.push('#');
    L.push('# Finale connections');
    bank.links.forEach((x) => L.push(`- ${x.l}|${x.v.join(';')}   (${usedOn(st.used.links, x.id)})`));
    L.push('#');
    L.push('# Walls');
    bank.walls.forEach((w) => L.push(`- ${w.g.map(groupText).join('  /  ')}   (${usedOn(st.used.walls, w.id)})`));
    L.push('#');
    L.push('# Mini walls');
    bank.half.forEach((w) => L.push(`- ${w.g.map(groupText).join('  /  ')}   (${usedOn(st.used.half, w.id)})`));
    L.push('#');
    L.push('# "Name a…" prompts');
    (bank.prompts || []).forEach((p) => L.push(`- ${p.q}   (${usedOn(st.plast, p.id)})`));
    L.push('#');
    L.push('# ─────────────────────────── NEW QUESTIONS GO BELOW THIS LINE ───────────────────────────');
    L.push('## questions');
    L.push('');
    L.push('## finale');
    L.push('');
    L.push('## walls');
    L.push('');
    L.push('## mini walls');
    L.push('');
    L.push('## prompts');
    L.push('');
    return L.join('\n');
  }

  /* ---------------- results, sharing ---------------- */
  const b64url = (s) => toB64(new TextEncoder().encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = (s) => new TextDecoder().decode(fromB64(s.replace(/-/g, '+').replace(/_/g, '/')));
  function packResult(r) { return b64url(JSON.stringify(r)); }
  function unpackResult(s) { const r = JSON.parse(unb64url(s)); if (!r || !isISO(r.iso)) throw new Error('bad'); return r; }

  return {
    VERSION, rng, hash, shuffle, clone, londonDay, addDays, dayDiff, weekday, isISO, prettyDay, styleOf, ROTA, STYLES, RULES, layerOf,
    encode, decode, norm, keyOf, osa, matchAnswer, matchLink, rarity, applyRarity, expandPrompt, promptForDay, CONT,
    BankEmpty, NO_REPEAT, newState, stateToUsed, buildDay, allPrompts, bankRunway, bankCounts, check,
    canonicalTitles, fetchViews, fetchWikidata, mergeWikidata, refreshDay, packResult, unpackResult,
    parseEntry, entryText, parseMCQ, mcqText, parseLink, parseGroup, groupText, parsePrompt, parseQuestionText, addToBank, packText
  };
});
