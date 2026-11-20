/* =========================================================================
   Tree-Frog Trivia — the console's Trivia desk
   • the full archive: every built day, past and future, decoded and editable
   • quality checks, play-tests, swapping questions for unused ones from the bank
   • build more days, refresh rarity from Wikipedia, top-up pack in and out
   Uses the console's own GitHub sign-in through window.HarryConsole.
   ========================================================================= */
(function () {
  'use strict';
  const K = JungleKit, T = TFT, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)], E = K.esc;
  const HC = () => window.HarryConsole;
  const TODAY = T.londonDay();
  let BANK = null, MAN = null, VIEWS = null, DAYS = {}, DIRTY = { days: new Set(), bank: false, man: false, views: false }, CUR = null, ED = null, MONTH = null;
  const D = (p) => 'trivia/data/' + p;
  const say = (t, k = '') => { const m = $('#tdMsg'); m.textContent = t; m.className = 'msg ' + k; };
  const dirty = () => DIRTY.days.size || DIRTY.bank || DIRTY.man || DIRTY.views;
  function markDirty() {
    const bar = $('#tdBar'), n = DIRTY.days.size;
    bar.classList.toggle('dirty', !!dirty());
    $('#tdUnsaved').textContent = dirty() ? `Not saved yet: ${[n ? n + ' day' + (n > 1 ? 's' : '') : '', DIRTY.bank ? 'question bank' : '', DIRTY.man ? 'schedule' : ''].filter(Boolean).join(', ')}` : 'Everything is saved';
  }
  addEventListener('beforeunload', (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- loading ---------- */
  async function loadAll() {
    say('Loading the trivia files…');
    const [b, m, v] = await Promise.all([HC().readFile(D('bank.tft')), HC().readFile(D('index.json')), HC().readFile(D('views.tft'))]);
    if (!b || !m) throw new Error('The trivia files aren\'t in this repository yet. Upload the trivia folder first.');
    BANK = T.decode(b); MAN = JSON.parse(m); VIEWS = v ? T.decode(v) : {};
    MAN.days = MAN.days || {}; MAN.used = MAN.used || {};
    say('');
  }
  async function getDay(iso) {
    if (DAYS[iso]) return DAYS[iso];
    const txt = await HC().readFile(D('days/' + iso + '.tft'));
    if (!txt) throw new Error('No file for ' + iso);
    DAYS[iso] = T.decode(txt); return DAYS[iso];
  }
  const viewsMap = () => Object.fromEntries(Object.entries(VIEWS || {}).map(([k, v]) => [k, v.v]));
  const builtDays = () => Object.keys(MAN.days).sort();
  const lastBuilt = () => builtDays().pop() || T.addDays(TODAY, -1);

  /* ---------- overview ---------- */
  function overview() {
    const last = lastBuilt(), ahead = Math.max(0, T.dayDiff(TODAY, last)), runway = T.bankRunway(BANK, MAN, T.addDays(last, 1)), c = T.bankCounts(BANK, MAN, T.addDays(last, 1));
    const warn = ahead < 21 || runway < 21;
    $('#tdStatus').innerHTML = `
      <div class="td-stats">
        <div><b>${ahead}</b><span>days built ahead<br>(to ${E(T.prettyDay(last, true))})</span></div>
        <div><b>${runway}</b><span>more days the<br>unused bank covers</span></div>
        <div><b>${c.mcq[1] + c.mcq[2] + c.mcq[3] + c.mcq[4]}</b><span>questions left<br>${[1, 2, 3, 4].map((d) => 'd' + d + ' ' + c.mcq[d]).join(' · ')}</span></div>
        <div><b>${c.prompts}</b><span>“Name a…” prompts<br>finale ${c.links} · walls ${c.walls} · mini ${c.half}</span></div>
      </div>
      ${warn ? `<p class="msg err">${ahead < 21 ? `Only ${ahead} days are built ahead. ` : ''}${runway < 21 ? `The unused bank only covers about ${runway} more days. Download the top-up pack, get new questions written, then Import them.` : 'Press Build more days.'}</p>` : ''}
      <p class="hint">Nothing repeats within ${T.NO_REPEAT} days: once a question, clue, wall or prompt is used it's retired for two years.</p>`;
  }
  /* ---------- the archive calendar ---------- */
  function calendar() {
    const days = builtDays(); if (!days.length) { $('#tdCal').innerHTML = '<div class="empty">No days built yet.</div>'; return; }
    const months = [...new Set(days.map((d) => d.slice(0, 7)))];
    if (!MONTH || !months.includes(MONTH)) MONTH = months.includes(TODAY.slice(0, 7)) ? TODAY.slice(0, 7) : months[0];
    const mi = months.indexOf(MONTH), first = MONTH + '-01', lead = (T.weekday(first) + 6) % 7;
    const dim = new Date(Date.UTC(+MONTH.slice(0, 4), +MONTH.slice(5, 7), 0)).getUTCDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= dim; d++) {
      const iso = MONTH + '-' + String(d).padStart(2, '0'), info = MAN.days[iso], st = T.STYLES[T.styleOf(iso)];
      if (!info) { cells += `<span class="td-day off">${d}</span>`; continue; }
      const cls = ['td-day', iso === TODAY ? 'today' : '', iso < TODAY ? 'past' : '', iso === CUR ? 'on' : '', info.flag ? 'flag' : '', DIRTY.days.has(iso) ? 'edited' : '', info.w ? 'warn' : ''].join(' ');
      cells += `<button class="${cls}" data-iso="${iso}" title="${E(T.prettyDay(iso, true) + ' · ' + st.name + (info.flag ? ' · flagged' : '') + (info.w ? ' · ' + info.w + ' warnings' : ''))}">${d}<i>${st.icon}</i></button>`;
    }
    $('#tdCal').innerHTML = `<div class="td-cal-head"><button class="btn sm" id="tdPrev" ${mi <= 0 ? 'disabled' : ''}>◂</button><b>${new Date(first + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b><button class="btn sm" id="tdNext" ${mi >= months.length - 1 ? 'disabled' : ''}>▸</button></div>
      <div class="td-cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<span class="td-dow">${x}</span>`).join('')}${cells}</div>
      <p class="hint">🐍 Canopy Chase · 🪜 Vine Ladder · 🌿 Tangled Wall · ⛰️ Summit. Yellow corner: flagged · red corner: warnings · dot: edited, not saved.</p>`;
    $('#tdPrev').addEventListener('click', () => { MONTH = months[mi - 1]; calendar(); });
    $('#tdNext').addEventListener('click', () => { MONTH = months[mi + 1]; calendar(); });
    $$('.td-day[data-iso]').forEach((b) => b.addEventListener('click', () => openDay(b.dataset.iso)));
  }

  /* ---------- the day editor ---------- */
  const getP = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  function setP(o, p, v) { const ks = p.split('.'), last = ks.pop(), t = ks.reduce((x, k) => x[k], o); t[last] = v; }
  const ansLines = (P) => P.ans.slice().sort((a, b) => b.r - a.r).map((a) => `${T.entryText({ n: a.n, a: a.a })} = ${a.r}`).join('\n');
  function parseAns(text, old) {
    const byName = new Map((old || []).map((a) => [a.n, a]));
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.*?)\s*=\s*(\d{1,3})\s*$/), e = T.parseEntry(m ? m[1] : l), prev = byName.get(e.n) || {};
      return { n: e.n, a: e.a || [], w: prev.w || e.n, f: prev.f || 3, r: m ? Math.min(100, +m[2]) : (prev.r != null ? prev.r : 50) };
    });
  }
  const decoyLines = (P) => P.dec.map((d) => T.entryText({ n: d.n, a: d.a })).join('\n');
  const parseDecoys = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const e = T.parseEntry(l); return { n: e.n, a: e.a || [] }; });
  const finLines = (F) => F.map((f) => `${f.a} | ${f.v.join('; ')} | ${f.w.join('; ')}`).join('\n');
  const parseFin = (text, old) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => { const p = l.split('|').map((x) => x.trim()); return { id: (old[i] || {}).id || 'x' + i, a: p[0] || '', v: (p[1] || '').split(';').map((x) => x.trim()).filter(Boolean), w: (p[2] || '').split(';').map((x) => x.trim()).filter(Boolean) }; });
  const wallLines = (W) => W.g.map(T.groupText).join('\n');
  const parseWall = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).map(T.parseGroup).filter(Boolean);

  function mcqForm(path, q, nWrong, label) {
    return `<div class="td-q" data-q="${path}">
      <div class="td-qh"><b>${E(label)}</b><span>difficulty ${q.d} · ${E(q.id)}</span><button class="btn sm" data-swap="${path}">Swap for an unused question</button></div>
      <input type="text" data-p="${path}.q" value="${E(q.q)}" aria-label="Question">
      <div class="td-grid"><label>Answer<input type="text" data-p="${path}.a" value="${E(q.a)}"></label><label>Also accept (; between)<input type="text" data-p="${path}.alt" data-k="list" value="${E((q.alt || []).join('; '))}"></label></div>
      <div class="td-grid">${q.w.slice(0, nWrong).map((w, i) => `<label>Wrong ${i + 1}<input type="text" data-p="${path}.w.${i}" value="${E(w)}"></label>`).join('')}</div>
    </div>`;
  }
  function promptForm(path, P, i) {
    return `<div class="td-q" data-q="${path}">
      <div class="td-qh"><b>Deep cut ${i + 1}</b><span>${E(P.id)} · rarity from ${P.fixed ? 'hand estimates (by design)' : P.rs === 'views' ? 'Wikipedia views' : 'hand estimates'}</span><button class="btn sm" data-pswap="${path}">Swap for an unused prompt</button></div>
      <input type="text" data-p="${path}.q" value="${E(P.q)}" aria-label="Prompt">
      <label>Hint under the prompt<input type="text" data-p="${path}.hint" value="${E(P.hint || '')}"></label>
      <div class="td-grid"><label>Valid answers: Name{other names} = rarity 0–100<textarea rows="8" data-p="${path}.ans" data-k="ans">${E(ansLines(P))}</textarea></label>
      <label>Real things that don't count (wrong on purpose)<textarea rows="8" data-p="${path}.dec" data-k="dec">${E(decoyLines(P))}</textarea></label></div>
    </div>`;
  }
  function chaseForm(path, C, title) {
    return `<h3>${E(title)}</h3>${C.prompts.map((P, i) => promptForm(`${path}.prompts.${i}`, P, i)).join('')}
      <div class="td-q"><div class="td-qh"><b>The boa's answers</b><span>ticked = it gets that question right (same for every player)</span></div>
      <div class="td-boa">${C.boa.map((b, i) => `<label><input type="checkbox" data-p="${path}.boa.${i}" data-k="bit" ${b ? 'checked' : ''}> Q${i + 1}</label>`).join('')}</div></div>
      ${C.qs.map((q, i) => mcqForm(`${path}.qs.${i}`, q, 2, 'Question ' + (i + 1))).join('')}
      <div class="td-q"><div class="td-qh"><b>Final pushback clues</b><span>one per line: Link | clue; clue; clue | wrong option; wrong option</span></div>
      <textarea rows="${C.fin.length + 1}" data-p="${path}.fin" data-k="fin">${E(finLines(C.fin))}</textarea></div>`;
  }
  function ladderForm(path, L, title) {
    return `<h3>${E(title)}</h3>${L.qs.map((q, i) => mcqForm(`${path}.qs.${i}`, q, 3, 'Rung ' + (i + 1))).join('')}${L.spare.map((q, i) => mcqForm(`${path}.spare.${i}`, q, 3, 'Spare for Swap the vine ' + (i + 1))).join('')}`;
  }
  function wallForm(path, W, title) {
    return `<h3>${E(title)}</h3><div class="td-q"><div class="td-qh"><b>Groups</b><span>${E(W.id)} · one per line: Link | keywords that count; more | vine; vine; vine; vine</span><button class="btn sm" data-wswap="${path}">Swap for an unused wall</button></div>
      <textarea rows="${W.g.length + 1}" data-p="${path}" data-k="wall">${E(wallLines(W))}</textarea></div>`;
  }
  async function openDay(iso) {
    if (!DAYS[iso]) { try { say('Opening ' + iso + '…'); await getDay(iso); say(''); } catch (e) { say(e.message, 'err'); return; } }
    CUR = iso; ED = DAYS[iso]; calendar();
    const st = T.STYLES[ED.style], past = iso < TODAY, today = iso === TODAY;
    let body = '';
    if (ED.chase) body += chaseForm('chase', ED.chase, 'Canopy Chase');
    if (ED.ladder) body += ladderForm('ladder', ED.ladder, 'Vine Ladder');
    if (ED.wall) body += wallForm('wall', ED.wall, 'Tangled Wall');
    if (ED.summit) body += wallForm('summit.wall', ED.summit.wall, 'Mini wall') + ladderForm('summit.ladder', ED.summit.ladder, 'Mini ladder') + chaseForm('summit.chase', ED.summit.chase, 'Quick chase');
    $('#tdDay').innerHTML = `<div class="td-dayhead"><h2 style="margin:0;padding:0;border:0">${st.icon} ${E(T.prettyDay(iso, true))} · ${E(st.name)}</h2>
        <div class="acts"><button class="btn sm" id="tdTest">▶ Play-test</button><button class="btn sm" id="tdRare">↻ Refresh rarity</button><button class="btn sm" id="tdClose">Close</button></div></div>
      ${past || today ? `<p class="msg warn">${today ? 'This is today\'s climb' : 'This day has already been played'}: people may have played it as it stood. Fix real mistakes only.</p>` : ''}
      <label class="lbl">Flag (a note for yourself, shown as a warning)<input type="text" id="tdFlag" value="${E(ED.flag || '')}" placeholder="e.g. Q3 answer looks wrong"></label>
      <div class="td-warn" id="tdWarn"></div>${body}`;
    $('#tdDay').hidden = false;
    wireDay(); runChecks();
    $('#tdDay').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function runChecks() {
    const w = T.check(ED); $('#tdWarn').innerHTML = w.length ? '<ul>' + w.map((x) => `<li>${E(x)}</li>`).join('') + '</ul>' : '<p class="hint">No problems found.</p>';
    const info = MAN.days[CUR]; const n = w.filter((x) => !/^Flagged/.test(x) && !/hand estimate/.test(x)).length;
    if ((info.w || 0) !== n || !!info.flag !== !!ED.flag) { info.w = n || undefined; info.flag = ED.flag ? 1 : undefined; }
  }
  function touch() { DIRTY.days.add(CUR); DIRTY.man = true; markDirty(); clearTimeout(touch.t); touch.t = setTimeout(() => { runChecks(); calendar(); }, 400); }
  function wireDay() {
    $('#tdFlag').addEventListener('input', (e) => { ED.flag = e.target.value.trim() || undefined; touch(); });
    $$('[data-p]', $('#tdDay')).forEach((el) => {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
        const p = el.dataset.p, k = el.dataset.k;
        if (k === 'list') setP(ED, p, el.value.split(';').map((x) => x.trim()).filter(Boolean));
        else if (k === 'bit') setP(ED, p, el.checked ? 1 : 0);
        else if (k === 'ans') { const P = getP(ED, p.replace(/\.ans$/, '')); P.ans = parseAns(el.value, P.ans); }
        else if (k === 'dec') getP(ED, p.replace(/\.dec$/, '')).dec = parseDecoys(el.value);
        else if (k === 'fin') setP(ED, p, parseFin(el.value, getP(ED, p)));
        else if (k === 'wall') { const W = getP(ED, p); W.g = parseWall(el.value); W.order = W.order && W.order.length === W.g.length * 4 ? W.order : T.shuffle([...Array(W.g.length * 4).keys()], T.rng(T.hash(CUR + 'w'))); }
        else setP(ED, p, el.value);
        touch();
      });
    });
    $$('[data-swap]', $('#tdDay')).forEach((b) => b.addEventListener('click', () => swapQ(b.dataset.swap)));
    $$('[data-pswap]', $('#tdDay')).forEach((b) => b.addEventListener('click', () => swapPrompt(b.dataset.pswap)));
    $$('[data-wswap]', $('#tdDay')).forEach((b) => b.addEventListener('click', () => swapWall(b.dataset.wswap)));
    $('#tdClose').addEventListener('click', () => { $('#tdDay').hidden = true; CUR = null; ED = null; calendar(); });
    $('#tdTest').addEventListener('click', () => {
      try { localStorage.setItem('harry-trivia-qc', JSON.stringify({ iso: CUR, day: ED })); } catch (e) { say('Couldn\'t store the draft for the play-test (storage is off).', 'err'); return; }
      window.open(new URL('trivia/?qc=' + CUR, location.href).href, '_blank');
    });
    $('#tdRare').addEventListener('click', async () => {
      $('#tdRare').disabled = true; say('Asking Wikipedia for page views…');
      try { await T.refreshDay(ED, BANK, VIEWS, { log: (m) => console.log(m) }); DIRTY.views = true; MAN.days[CUR].rs = ED.rs; touch(); say(ED.rs === 'views' ? 'Rarity now comes from Wikipedia views.' : 'Some answers had no Wikipedia page, so a prompt kept its hand estimate. Details are in the browser console.', ED.rs === 'views' ? 'ok' : 'err'); openDay(CUR); }
      catch (e) { say('Couldn\'t reach Wikipedia: ' + e.message, 'err'); }
      $('#tdRare').disabled = false;
    });
  }
  /* ---------- swapping in unused material ---------- */
  const free = (map, id) => !map[id] || T.dayDiff(map[id], CUR) >= T.NO_REPEAT;
  function freeAfter(map, oldId) { if (CUR > TODAY && map[oldId] === CUR) delete map[oldId]; }   // a future day's old pick goes back in the bank
  function inDay(ids) { const s = JSON.stringify(ED); return (id) => ids.has(id) || s.includes('"id":"' + id + '"'); }
  function retireAsk(what) { return confirm(`Retire the old ${what} for good? Choose OK if it was wrong or badly worded, Cancel to just swap it.`); }
  function swapQ(path) {
    const old = getP(ED, path), used = MAN.used.mcq = MAN.used.mcq || {}, here = inDay(new Set());
    const pool = BANK.mcq.filter((q) => q.d === old.d && !q.off && free(used, q.id) && !here(q.id));
    if (!pool.length) { say('No unused questions of that difficulty left. Import some more first.', 'err'); return; }
    if (retireAsk('question')) { const b = BANK.mcq.find((q) => q.id === old.id); if (b) { b.off = 1; DIRTY.bank = true; } }
    const q = T.clone(pool[Math.floor(Math.random() * pool.length)]);
    if (/chase/.test(path)) q.w = T.shuffle(q.w, Math.random).slice(0, 2);
    freeAfter(used, old.id); used[q.id] = CUR; setP(ED, path, q);
    const L = path.split('.').slice(0, -2).join('.'), lad = L && getP(ED, L);
    if (lad && lad.poll) { delete lad.poll[old.id]; lad.poll[q.id] = { a: [0, 74, 60, 46, 36][q.d], w: [12, 8, 6].map((x) => x + [0, 0, 6, 10, 12][q.d]) }; const p = lad.poll[q.id]; p.w[2] = 100 - p.a - p.w[0] - p.w[1]; }
    touch(); openDay(CUR); say('Swapped in ' + q.id + '.', 'ok');
  }
  function swapPrompt(path) {
    const old = getP(ED, path), used = MAN.used.prompts = MAN.used.prompts || {}, here = new Set(T.allPrompts(ED).map((p) => p.id));
    const pool = BANK.prompts.filter((p) => !p.off && free(used, p.id) && !here.has(p.id));
    if (!pool.length) { say('No unused prompts left. Import some more first.', 'err'); return; }
    if (retireAsk('prompt')) { const b = BANK.prompts.find((p) => p.id === old.id); if (b) { b.off = 1; DIRTY.bank = true; } }
    const p = pool[Math.floor(Math.random() * pool.length)];
    freeAfter(used, old.id); used[p.id] = CUR; setP(ED, path, T.promptForDay(BANK, p, viewsMap()));
    ED.rs = T.allPrompts(ED).every((x) => x.fixed || x.rs === 'views') ? 'views' : 'fame'; MAN.days[CUR].rs = ED.rs;
    touch(); openDay(CUR); say('Swapped in “' + p.q + '”.', 'ok');
  }
  function swapWall(path) {
    const old = getP(ED, path), mini = /summit/.test(path), key = mini ? 'half' : 'walls', used = MAN.used[key] = MAN.used[key] || {};
    const pool = BANK[key].filter((w) => !w.off && free(used, w.id) && w.id !== old.id);
    if (!pool.length) { say('No unused walls left. Import some more first.', 'err'); return; }
    if (retireAsk('wall')) { const b = BANK[key].find((w) => w.id === old.id); if (b) { b.off = 1; DIRTY.bank = true; } }
    const w = T.clone(pool[Math.floor(Math.random() * pool.length)]);
    freeAfter(used, old.id); used[w.id] = CUR; setP(ED, path, { id: w.id, g: w.g, order: T.shuffle([...Array(w.g.length * 4).keys()], Math.random) });
    touch(); openDay(CUR); say('Swapped in wall ' + w.id + '.', 'ok');
  }

  /* ---------- building more days ---------- */
  async function build(n, net) {
    const st = T.newState(MAN); let iso = T.addDays(lastBuilt(), 1), made = 0;
    if (iso < TODAY) iso = TODAY;
    const btn = $('#tdBuild'); btn.disabled = true;
    try {
      for (let i = 0; i < n; i++, iso = T.addDays(iso, 1)) {
        say(`Building ${T.prettyDay(iso)}…`);
        const day = T.buildDay(iso, BANK, st, { views: viewsMap() });
        if (net) { try { await T.refreshDay(day, BANK, VIEWS, { log: (m) => console.log(m) }); DIRTY.views = true; } catch (e) { console.warn(e); } }
        DAYS[iso] = day; DIRTY.days.add(iso); MAN.days[iso] = { s: day.style, rs: day.rs }; made++;
      }
    } catch (e) { if (!(e instanceof T.BankEmpty)) { say(e.message, 'err'); btn.disabled = false; return; } say(`Built ${made} day${made === 1 ? '' : 's'}, then ${e.message.toLowerCase()}. Import more questions to keep going.`, 'err'); }
    MAN.used = T.stateToUsed(st); MAN.last = lastBuilt(); DIRTY.man = true; markDirty(); overview(); calendar();
    if (made === n) say(`Built ${made} more day${made === 1 ? '' : 's'}. Press Save to publish them.`, 'ok');
    btn.disabled = false;
  }
  async function refreshFuture() {
    const list = builtDays().filter((d) => d > TODAY && (MAN.days[d].rs !== 'views') && /chase|summit/.test(MAN.days[d].s));
    if (!list.length) { say('Every future day already has rarity from Wikipedia views.', 'ok'); return; }
    let ok = 0;
    for (const iso of list) {
      say(`Refreshing rarity for ${T.prettyDay(iso)} (${ok + 1} of ${list.length})…`);
      try { const d = await getDay(iso); await T.refreshDay(d, BANK, VIEWS, { log: (m) => console.log(m) }); MAN.days[iso].rs = d.rs; DIRTY.days.add(iso); DIRTY.views = true; DIRTY.man = true; ok++; } catch (e) { say('Stopped: ' + e.message, 'err'); break; }
    }
    markDirty(); calendar(); say(`Refreshed ${ok} day${ok === 1 ? '' : 's'}. Press Save to publish.`, 'ok');
  }
  async function checkAll() {
    const list = builtDays(); let n = 0, bad = 0;
    for (const iso of list) { n++; if (n % 5 === 0) say(`Checking ${n} of ${list.length}…`); try { const d = await getDay(iso), w = T.check(d).filter((x) => !/^Flagged/.test(x) && !/hand estimate/.test(x)); MAN.days[iso].w = w.length || undefined; MAN.days[iso].flag = d.flag ? 1 : undefined; if (w.length) bad++; } catch (e) { /* missing file */ } }
    calendar(); say(bad ? `${bad} day${bad === 1 ? ' has' : 's have'} warnings (red corners).` : 'Every day passed the checks.', bad ? 'err' : 'ok');
  }

  /* ---------- top-up pack out, questions in ---------- */
  function downloadPack() {
    const text = T.packText(BANK, MAN, TODAY), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); a.download = `tree-frog-trivia-top-up-${TODAY}.txt`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    say('Downloaded. Paste it into a chat with Claude, then bring the reply back through Import questions.', 'ok');
  }
  function importPreview() {
    const p = T.parseQuestionText($('#tdImportText').value);
    const n = p.mcq.length + p.links.length + p.walls.length + p.half.length + p.prompts.length;
    $('#tdImportInfo').innerHTML = `${n ? `Found <b>${p.mcq.length}</b> questions (${[1, 2, 3, 4].map((d) => 'd' + d + ' ' + p.mcq.filter((q) => q.d === d).length).join(' · ')}), <b>${p.links.length}</b> finale clues, <b>${p.walls.length}</b> walls, <b>${p.half.length}</b> mini walls, <b>${p.prompts.length}</b> prompts.` : 'Nothing found yet. Paste text that has ## questions, ## finale, ## walls, ## mini walls or ## prompts sections.'}
      ${p.errors.length ? `<ul class="td-err">${p.errors.slice(0, 12).map((x) => `<li>${E(x)}</li>`).join('')}${p.errors.length > 12 ? `<li>…and ${p.errors.length - 12} more</li>` : ''}</ul>` : ''}`;
    $('#tdImportGo').disabled = !n;
    return p;
  }
  function importGo() {
    const p = importPreview(), r = T.addToBank(BANK, p);
    DIRTY.bank = true; markDirty(); overview(); $('#tdImport').close();
    const a = r.added;
    say(`Added ${a.mcq} questions, ${a.links} finale clues, ${a.walls} walls, ${a.half} mini walls and ${a.prompts} prompts.${r.skipped.length ? ' Skipped ' + r.skipped.length + ' already in the bank.' : ''} Press Save, then Build more days.`, 'ok');
  }

  /* ---------- saving ---------- */
  async function saveAll() {
    if (!dirty()) return;
    const btn = $('#tdSave'); btn.disabled = true; say('Saving to GitHub…');
    try {
      const files = [];
      for (const iso of DIRTY.days) files.push({ path: D('days/' + iso + '.tft'), b64: HC().b64utf8(T.encode(DAYS[iso])) });
      if (DIRTY.bank) files.push({ path: D('bank.tft'), b64: HC().b64utf8(T.encode(BANK)) });
      if (DIRTY.views) files.push({ path: D('views.tft'), b64: HC().b64utf8(T.encode(VIEWS)) });
      MAN.updated = TODAY; MAN.last = lastBuilt();
      files.push({ path: D('index.json'), b64: HC().b64utf8(JSON.stringify(MAN, null, 1) + '\n') });
      await HC().commit(files, [], 'Tree-Frog Trivia: update from the console');
      DIRTY = { days: new Set(), bank: false, man: false, views: false }; markDirty(); calendar();
      say('Saved! Changes go live in about a minute.', 'ok');
    } catch (e) { say('Couldn\'t save: ' + e.message, 'err'); }
    btn.disabled = false;
  }

  /* ---------- open / close ---------- */
  async function open() {
    $('#editor').hidden = true; $('#triviaEd').hidden = false; $('.wrap').classList.add('pe-wide');
    if (!BANK) { try { await loadAll(); } catch (e) { say(e.message, 'err'); return; } }
    overview(); calendar(); markDirty();
  }
  function close() {
    if (dirty() && !confirm('Your trivia changes aren\'t saved. Leave the desk anyway? (They stay here until you reload.)')) return;
    $('#triviaEd').hidden = true; $('#editor').hidden = false; $('.wrap').classList.remove('pe-wide');
  }
  function init() {
    if (!$('#triviaEd')) return;
    $('#openTrivia').addEventListener('click', open);
    $('#tdBack').addEventListener('click', close);
    $('#tdSave').addEventListener('click', saveAll);
    $('#tdPack').addEventListener('click', () => { if (BANK) downloadPack(); });
    $('#tdBuild').addEventListener('click', () => { if (BANK) build(Math.max(1, Math.min(120, +$('#tdN').value || 28)), $('#tdNet').checked); });
    $('#tdRefresh').addEventListener('click', () => { if (BANK) refreshFuture(); });
    $('#tdCheck').addEventListener('click', () => { if (BANK) checkAll(); });
    $('#tdImportOpen').addEventListener('click', () => { if (!BANK) return; $('#tdImportText').value = ''; importPreview(); $('#tdImport').showModal(); });
    $('#tdImportClose').addEventListener('click', () => $('#tdImport').close());
    $('#tdImportText').addEventListener('input', () => { clearTimeout(importPreview.t); importPreview.t = setTimeout(importPreview, 250); });
    $('#tdImportFile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) { $('#tdImportText').value = await f.text(); importPreview(); } });
    $('#tdImportGo').addEventListener('click', importGo);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
