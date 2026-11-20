// Tree-Frog Trivia: keeps days built ahead and scores "Name a…" rarity from Wikipedia page views.
// Run by .github/workflows/trivia.yml (every Monday, or Actions → Tree-Frog Trivia → Run workflow).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const T = require(path.join(ROOT, 'trivia/tft-core.js'));
const DIR = path.join(ROOT, 'trivia/data'), DAYS = path.join(DIR, 'days');
const AHEAD = +(process.env.DAYS_AHEAD || 35);
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const log = (m) => console.log('  ' + m);
const warn = (m) => console.log('::warning::' + m);

const bank = T.decode(read('bank.tft'));
const man = JSON.parse(read('index.json'));
const views = fs.existsSync(path.join(DIR, 'views.tft')) ? T.decode(read('views.tft')) : {};
man.days = man.days || {};
const today = T.londonDay();
let changed = 0;

// 1 · future days still using hand-estimated rarity → Wikipedia views (never today or earlier: people may have played them)
const future = Object.keys(man.days).sort().filter((d) => d > today && man.days[d].rs !== 'views' && /chase|summit/.test(man.days[d].s));
console.log(`Refreshing rarity for ${future.length} future day(s)…`);
for (const iso of future) {
  try {
    const f = path.join(DAYS, iso + '.tft'), day = T.decode(fs.readFileSync(f, 'utf8'));
    await T.refreshDay(day, bank, views, { log, today });
    fs.writeFileSync(f, T.encode(day)); man.days[iso].rs = day.rs; changed++;
    console.log(`${iso}: rarity from ${day.rs === 'views' ? 'Wikipedia views' : 'hand estimates (some pages were missing, see above)'}`);
  } catch (e) { warn(`${iso}: couldn't refresh rarity (${e.message})`); }
}

// 2 · build days until we're AHEAD days ahead
const st = T.newState(man), target = T.addDays(today, AHEAD);
let iso = T.addDays(Object.keys(man.days).sort().pop() || T.addDays(today, -1), 1);
if (iso < today) iso = today;
const vmap = () => Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.v]));
console.log(`Building from ${iso} to ${target}…`);
try {
  for (; iso <= target; iso = T.addDays(iso, 1)) {
    const day = T.buildDay(iso, bank, st, { views: vmap() });
    try { await T.refreshDay(day, bank, views, { log, today }); } catch (e) { warn(`${iso}: rarity refresh failed (${e.message}); hand estimates kept`); }
    fs.writeFileSync(path.join(DAYS, iso + '.tft'), T.encode(day));
    man.days[iso] = { s: day.style, rs: day.rs }; changed++;
    console.log(`${iso}: built (${day.style})`);
  }
} catch (e) {
  if (!(e instanceof T.BankEmpty)) throw e;
  warn(`Stopped at ${iso}: ${e.message}. Top up the bank in the console (Trivia desk → Download top-up pack → Import questions).`);
}
man.used = T.stateToUsed(st);

const last = Object.keys(man.days).sort().pop();
const runway = T.bankRunway(bank, man, T.addDays(last, 1));
if (T.dayDiff(today, last) < 21 || runway < 21) warn(`Built to ${last}; the unused bank covers about ${runway} more days. Time to top up.`);
man.last = last; man.updated = today;
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(man, null, 1) + '\n');
fs.writeFileSync(path.join(DIR, 'views.tft'), T.encode(views));
console.log(`Done: ${changed} day file(s) written. Built to ${last}. Bank runway after that: ${runway} days.`);
