/* =========================================================================
   JungleKit v2 — pixel-art jungle engine
   • vector animal models rendered as pixel sprites (tiny SVG→canvas renderer)
   • procedural pixel painter for foliage / trunks / cliffs + ordered dithering
   • one stop-motion clock: every animal pose updates at FPS (6) frames/sec
   Shared by index.html, console.html and the starter pages in /pages.
   ========================================================================= */
(function (global) {
  'use strict';
  const KIT_SRC = (document.currentScript && document.currentScript.src) || '';
  const SITE_ROOT = KIT_SRC ? KIT_SRC.replace(/jungle-kit\.js(\?.*)?$/, '') : new URL('./', location.href).href;

  /* ---------------- helpers ---------------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const O = (x, y) => `style="transform-origin:${x}px ${y}px"`;
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  function slugify(s) { return String(s || 'page').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'page'; }

  /* =======================================================================
     ANIMAL MODELS (vector; parts named p-* are posed by the motion clock)
     ======================================================================= */
  const A = {};
  A.monkey = (o = {}) => {
    const fur = o.fur || '#4a3022', dk = o.dark || '#33201a', face = o.face || '#c79a72', belly = o.belly || '#7a5236';
    return svg('0 0 120 170', `
      <g class="p-tail" ${O(46, 108)}><path d="M45 108 C18 118 10 146 28 158 C40 166 50 152 40 146" stroke="${dk}" stroke-width="6" stroke-linecap="round" fill="none"/></g>
      <path d="M53 4 C51 22 52 36 54 52" stroke="${dk}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M50 110 C42 128 44 142 50 152" stroke="${dk}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M74 110 C84 126 82 140 76 150" stroke="${dk}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <ellipse cx="62" cy="88" rx="23" ry="30" fill="${fur}"/>
      <ellipse cx="62" cy="94" rx="13" ry="19" fill="${belly}"/>
      <g class="p-arm" ${O(80, 76)}><path d="M80 74 C96 88 98 104 92 118" stroke="${dk}" stroke-width="9" stroke-linecap="round" fill="none"/></g>
      <g class="p-head" ${O(62, 70)}>
        <circle cx="42" cy="54" r="7" fill="${fur}"/><circle cx="82" cy="54" r="7" fill="${fur}"/>
        <circle cx="62" cy="52" r="20" fill="${fur}"/>
        <path d="M48 52 C50 41 74 41 76 52 C78 64 70 70 62 70 C54 70 46 64 48 52Z" fill="${face}"/>
        <rect x="52" y="48" width="6" height="4" fill="#120c08"/><rect x="66" y="48" width="6" height="4" fill="#120c08"/>
        <rect x="59" y="58" width="6" height="3" fill="${dk}"/>
      </g>`);
  };
  A.capuchin = () => A.monkey({ fur: '#2a211c', dark: '#1d1714', face: '#efe2cc', belly: '#e2d2b4' });
  A.orangutan = () => A.monkey({ fur: '#b4521e', dark: '#8c3a12', face: '#5a3a2a', belly: '#c8652a' });

  // the vine-crawling sloth: four gripping limbs, head looking down toward the viewer
  A.sloth = () => {
    const fur = '#8a7a62', fur2 = '#a3927a', dk = '#5e5040', claw = '#2a2018';
    const limb = (cls, sx, sy, hx) => `<g class="${cls}" ${O(sx, sy)}><path d="M${sx} ${sy} C${sx + (hx - sx) * 0.3} ${sy - 18} ${hx} ${30} ${hx} 12" stroke="${fur}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M${hx - 6} 14 q2 -12 9 -8 M${hx - 1} 14 q3 -12 10 -7 M${hx + 4} 15 q3 -11 10 -5" stroke="${claw}" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`;
    return svg('0 0 200 130', `
      ${limb('p-bl', 66, 52, 50)}${limb('p-fl', 128, 50, 120)}
      <ellipse cx="98" cy="62" rx="56" ry="25" fill="${fur}"/>
      <path d="M52 60 q10 7 20 0 M78 72 q10 7 20 0 M104 56 q10 7 20 0 M66 48 q8 5 16 0 M118 70 q8 5 16 0" stroke="${fur2}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M50 74 C70 86 120 88 146 74" stroke="${dk}" stroke-width="4" fill="none" opacity=".6"/>
      ${limb('p-br', 78, 50, 80)}${limb('p-fr', 140, 52, 152)}
      <g class="p-head" ${O(150, 64)}>
        <circle cx="160" cy="74" r="20" fill="${fur2}"/>
        <ellipse cx="161" cy="77" rx="15" ry="12" fill="#e6dcc4"/>
        <ellipse cx="153" cy="75" rx="6.5" ry="3.6" fill="#3e2f22" transform="rotate(20 153 75)"/>
        <ellipse cx="169" cy="75" rx="6.5" ry="3.6" fill="#3e2f22" transform="rotate(-20 169 75)"/>
        <g class="p-eyes"><rect x="151" y="73" width="3.6" height="3.6" fill="#0a0705"/><rect x="167" y="73" width="3.6" height="3.6" fill="#0a0705"/></g>
        <ellipse cx="161" cy="83" rx="3.4" ry="2.4" fill="#2e2218"/>
        <path d="M156 88 q5 3 10 0" stroke="#3e2f22" stroke-width="1.8" fill="none"/>
      </g>`);
  };

  A.toucan = () => svg('0 0 130 130', `
    <g class="p-tail" ${O(48, 94)}><path d="M40 92 L30 128 L46 126 L54 94Z" fill="#0f1012"/></g>
    <ellipse cx="48" cy="66" rx="22" ry="34" fill="#141518" transform="rotate(12 48 66)"/>
    <path d="M44 50 C62 56 66 86 56 100 C46 92 40 70 44 50Z" fill="#23252b"/>
    <path d="M46 96 q7 5 12 0 l-2 7 h-8z" fill="#c8282a"/>
    <path d="M44 100 v9 M54 100 v9" stroke="#4a6ac8" stroke-width="4" stroke-linecap="round"/>
    <g class="p-head" ${O(56, 48)}>
      <circle cx="56" cy="34" r="16" fill="#141518"/>
      <path d="M58 30 C72 34 74 52 62 58 C54 50 54 38 58 30Z" fill="#f2d23a"/>
      <circle cx="60" cy="29" r="6" fill="#7ad04a"/><rect x="58" y="27" width="4" height="4" fill="#0a0a0a"/>
      <path d="M66 22 C90 14 116 20 126 32 C116 42 90 44 68 42 C64 34 64 28 66 22Z" fill="#f08a1c"/>
      <path d="M66 22 C90 14 116 20 126 32 C110 26 88 24 67 29Z" fill="#7cc83e"/>
      <path d="M88 24 C96 24 104 26 108 28 L104 38 C98 38 92 38 86 38Z" fill="#3a8ad8" opacity=".8"/>
      <path d="M118 25 C123 28 126 30 126 32 C122 36 118 38 114 39Z" fill="#c8282a"/>
    </g>`);

  A.macaw = () => svg('0 0 100 190', `
    <g class="p-tail" ${O(46, 92)}><path d="M40 90 L30 186 L44 184 L52 92Z" fill="#c8262a"/><path d="M46 92 L46 182 L56 178 L56 94Z" fill="#2a62c8"/></g>
    <ellipse cx="50" cy="64" rx="20" ry="32" fill="#c8262a"/>
    <path d="M42 100 v8 M52 100 v8" stroke="#3a3a3a" stroke-width="4" stroke-linecap="round"/>
    <g class="p-wing" ${O(44, 46)}>
      <path d="M38 44 C22 60 24 90 40 104 C52 90 54 62 46 46Z" fill="#c8262a"/>
      <path d="M33 56 C29 68 31 80 36 90 L43 86 C39 76 38 66 39 56Z" fill="#f2c62a"/>
      <path d="M31 76 C31 86 35 96 40 104 L45 98 C40 92 37 84 36 76Z" fill="#2a62c8"/>
    </g>
    <g class="p-head" ${O(52, 44)}>
      <circle cx="54" cy="30" r="15" fill="#c8262a"/>
      <ellipse cx="60" cy="31" rx="7" ry="8" fill="#f2efe6"/>
      <rect x="58" y="27" width="4" height="4" fill="#0a0a0a"/>
      <path d="M66 24 C79 24 84 36 77 47 C74 40 70 38 66 38Z" fill="#e8e2d2"/>
      <path d="M66 38 C70 38 72 42 70 46 C68 44 66 42 63 41Z" fill="#1a1a1a"/>
    </g>`);

  A.parrot = () => svg('0 0 100 150', `
    <g class="p-tail" ${O(46, 92)}><path d="M40 92 L36 146 L56 146 L54 92Z" fill="#23883e"/></g>
    <ellipse cx="50" cy="66" rx="20" ry="30" fill="#3aac48"/>
    <g class="p-wing" ${O(42, 48)}><path d="M38 46 C24 62 28 90 42 100 C50 88 52 62 46 48Z" fill="#23883e"/><path d="M32 80 C33 90 37 96 42 100 L45 94 C40 90 37 84 36 78Z" fill="#2a5ec8"/><path d="M36 60 L42 58 L44 66 L38 68Z" fill="#c8262a"/></g>
    <path d="M44 98 v8 M54 98 v8" stroke="#555" stroke-width="4" stroke-linecap="round"/>
    <g class="p-head" ${O(52, 44)}><circle cx="54" cy="32" r="15" fill="#3aac48"/><path d="M46 20 C54 14 62 18 64 24 C58 22 52 22 46 26Z" fill="#f2d22a"/>
      <rect x="58" y="28" width="4" height="4" fill="#0a0a0a"/>
      <path d="M66 28 C76 28 78 40 70 46 C70 40 68 38 64 38Z" fill="#d8c8a8"/></g>`);

  A.hummingbird = () => svg('0 0 90 60', `
    <g class="p-wings" ${O(40, 26)}><path d="M40 26 C30 4 16 0 14 6 C20 16 30 22 40 26Z" fill="#bfeee6"/></g>
    <path d="M18 34 L4 44 L10 34 L2 30Z" fill="#0f6a58"/>
    <ellipse cx="34" cy="32" rx="18" ry="9" fill="#14957a"/>
    <ellipse cx="38" cy="36" rx="10" ry="4" fill="#d8f2e2"/>
    <circle cx="52" cy="26" r="8" fill="#14957a"/>
    <path d="M52 30 C54 36 48 38 46 34Z" fill="#d8285a"/>
    <rect x="53" y="22" width="3.6" height="3.6" fill="#0a0a0a"/>
    <path d="M59 26 L88 22" stroke="#1a1a1a" stroke-width="2.4" stroke-linecap="round"/>`);

  A.bird = () => svg('0 0 40 20', `<g class="p-w" ${O(20, 10)}><path d="M2 11 Q10 2 20 10 Q30 2 38 11" stroke="#14202a" stroke-width="3" fill="none" stroke-linecap="round"/></g>`);

  A.snake = () => svg('0 0 200 120', `
    <path d="M6 36 C40 16 74 18 100 40 C126 62 118 92 98 98 C78 104 74 82 94 76" stroke="#17803a" stroke-width="17" stroke-linecap="round" fill="none"/>
    <path d="M6 36 C40 16 74 18 100 40 C126 62 118 92 98 98 C78 104 74 82 94 76" stroke="#e6f2c8" stroke-width="5" stroke-dasharray="4 14" fill="none"/>
    <g class="p-head" ${O(96, 76)}>
      <ellipse cx="106" cy="72" rx="15" ry="10" fill="#17803a" transform="rotate(-18 106 72)"/>
      <circle cx="108" cy="67" r="3.6" fill="#e8c83a"/><rect x="107" y="64" width="2" height="6" fill="#0a0a0a"/>
      <g class="p-tongue" ${O(119, 69)}><path d="M119 69 l12 -5 m-5 2 l7 3" stroke="#c82a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
    </g>`);

  A.chameleon = () => svg('0 0 170 110', `
    <path d="M0 80 C50 76 110 82 170 76" stroke="#4a3220" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="p-tail" ${O(40, 66)}><path d="M40 66 C24 70 14 84 22 96 C30 106 44 98 40 88 C37 82 30 84 31 90" stroke="#2aa878" stroke-width="7" fill="none" stroke-linecap="round"/></g>
    <path d="M56 72 L50 81 M94 72 L100 81" stroke="#24966a" stroke-width="6" stroke-linecap="round"/>
    <path d="M38 64 C44 40 86 32 108 46 C118 54 116 68 104 72 C86 78 56 78 38 64Z" fill="#2aa878"/>
    <path d="M60 44 C62 56 62 66 60 74 M78 40 C80 54 80 66 78 76 M94 42 C96 54 96 64 94 72" stroke="#e8c83a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M44 64 C70 74 96 74 110 66" stroke="#d8e8a0" stroke-width="3" fill="none"/>
    <path d="M104 44 C118 34 140 40 148 54 C140 66 120 70 106 66Z" fill="#24966a"/>
    <path d="M106 46 C110 28 124 26 128 40Z" fill="#24966a"/>
    <g class="p-tongue" ${O(147, 58)}><path d="M147 58 H200" stroke="#e86a8a" stroke-width="3.4" stroke-linecap="round"/><circle cx="200" cy="58" r="4.4" fill="#e86a8a"/></g>
    <circle cx="126" cy="52" r="8.5" fill="#34c08a"/>
    <g class="p-eye" ${O(126, 52)}><rect x="127" y="50" width="4" height="4" fill="#0a0a0a"/></g>`);

  A.jaguar = () => {
    const r = rng(7); let spots = '';
    for (let i = 0; i < 18; i++) { const x = 50 + r() * 122, y = 42 + r() * 24, s = 2.6 + r() * 2.6; spots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="#b8742a" stroke="#2a1a0e" stroke-width="2"/>`; }
    return svg('0 0 240 120', `
      <g class="p-tail" ${O(32, 64)}><path d="M32 64 C16 74 12 96 20 116" stroke="#d8963a" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M32 64 C16 74 12 96 20 116" stroke="#2a1a0e" stroke-width="9" stroke-dasharray="3 9" fill="none"/></g>
      <path d="M150 68 C152 84 150 96 154 106" stroke="#d8963a" stroke-width="12" stroke-linecap="round"/>
      <path d="M60 68 C58 82 60 92 56 100" stroke="#d8963a" stroke-width="12" stroke-linecap="round"/>
      <path d="M28 60 C40 34 150 30 176 46 C190 54 188 70 170 72 L40 72 C30 72 24 68 28 60Z" fill="#d8963a"/>
      <path d="M50 70 C80 74 140 74 168 70" stroke="#f0d8a8" stroke-width="5" stroke-linecap="round"/>
      ${spots}
      <g class="p-head" ${O(186, 62)}>
        <circle cx="176" cy="26" r="7" fill="#d8963a"/><circle cx="204" cy="24" r="7" fill="#d8963a"/>
        <circle cx="190" cy="44" r="22" fill="#d8963a"/>
        <circle cx="178" cy="30" r="2.4" fill="#2a1a0e"/><circle cx="196" cy="28" r="2" fill="#2a1a0e"/><circle cx="186" cy="26" r="2" fill="#2a1a0e"/>
        <ellipse cx="198" cy="54" rx="11" ry="8" fill="#f0d8a8"/>
        <g class="p-eyes"><rect x="179" y="39" width="7" height="4" fill="#c8d83a"/><rect x="195" y="37" width="7" height="4" fill="#c8d83a"/><rect x="182" y="39" width="2" height="4" fill="#0a0a0a"/><rect x="198" y="37" width="2" height="4" fill="#0a0a0a"/></g>
        <g class="p-lids"><path d="M178 41 h10 M194 39 h10" stroke="#2a1a0e" stroke-width="3"/></g>
        <path d="M194 48 h9 l-4.5 5z" fill="#8a3a32"/>
      </g>`);
  };

  A.tiger = () => svg('0 0 160 130', `
    <g class="p-ears"><circle cx="36" cy="30" r="16" fill="#e0781a"/><circle cx="36" cy="30" r="8" fill="#1f140c"/><circle cx="124" cy="30" r="16" fill="#e0781a"/><circle cx="124" cy="30" r="8" fill="#1f140c"/></g>
    <ellipse cx="80" cy="72" rx="56" ry="50" fill="#e0781a"/>
    <path d="M28 84 C38 122 122 122 132 84 C120 104 100 100 80 102 C60 100 40 104 28 84Z" fill="#f4ecdc"/>
    <ellipse cx="58" cy="54" rx="11" ry="6" fill="#f4ecdc"/><ellipse cx="102" cy="54" rx="11" ry="6" fill="#f4ecdc"/>
    <path d="M80 24 v18 M66 28 l4 14 M94 28 l-4 14 M26 62 l18 5 M24 78 l17 2 M134 62 l-18 5 M136 78 l-17 2 M44 40 l10 8 M116 40 l-10 8" stroke="#1a110a" stroke-width="5" stroke-linecap="round"/>
    <g class="p-eyes"><rect x="52" y="62" width="16" height="8" fill="#e8c83a"/><rect x="92" y="62" width="16" height="8" fill="#e8c83a"/><rect x="58" y="62" width="4" height="8" fill="#0a0a0a"/><rect x="98" y="62" width="4" height="8" fill="#0a0a0a"/></g>
    <ellipse cx="80" cy="92" rx="19" ry="13" fill="#f4ecdc"/>
    <path d="M71 82 h18 l-9 10z" fill="#a8504a"/>
    <g class="p-jaw" ${O(80, 96)}><path d="M80 92 v5 M70 100 q10 6 20 0" stroke="#1f140c" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`);

  A.panther = () => svg('0 0 230 100', `
    <g class="p-tail" ${O(30, 78)}><path d="M30 78 C10 70 8 44 24 34" stroke="#0e1214" stroke-width="8" fill="none" stroke-linecap="round"/></g>
    <path d="M60 80 v14 M90 80 v14 M150 80 v14 M176 78 v16" stroke="#0e1214" stroke-width="10" stroke-linecap="round"/>
    <path d="M24 80 C34 52 84 42 130 46 C156 48 172 40 190 42 C212 44 222 60 216 72 C208 84 192 82 182 82 L34 88 C26 88 22 86 24 80Z" fill="#11171a"/>
    <path d="M60 52 C90 46 130 46 160 48" stroke="#2a3a44" stroke-width="3" fill="none"/>
    <path d="M186 44 l4 -13 l9 11z M202 44 l7 -11 l4 13z" fill="#11171a"/>
    <g class="p-eyes"><rect x="194" y="55" width="8" height="4" fill="#d8f04a"/><rect x="207" y="54" width="7" height="4" fill="#d8f04a"/></g>`);

  A.frog = () => svg('0 0 110 90', `
    <path d="M20 70 C6 60 8 44 24 48 C34 50 36 62 30 72Z" fill="#4cc23a"/>
    <path d="M90 70 C104 60 102 44 86 48 C76 50 74 62 80 72Z" fill="#4cc23a"/>
    <ellipse cx="55" cy="58" rx="32" ry="22" fill="#5ad23e"/>
    <path d="M26 58 C32 74 78 74 84 58 C76 68 34 68 26 58Z" fill="#2a6ad0"/>
    <g class="p-pouch" ${O(55, 64)}><ellipse cx="55" cy="66" rx="17" ry="9" fill="#ece8c8"/></g>
    <g fill="#f07a1c"><circle cx="24" cy="80" r="4.5"/><circle cx="34" cy="83" r="4.5"/><circle cx="76" cy="83" r="4.5"/><circle cx="86" cy="80" r="4.5"/></g>
    <circle cx="38" cy="36" r="13" fill="#5ad23e"/><circle cx="38" cy="36" r="9.5" fill="#e0201e"/>
    <circle cx="72" cy="36" r="13" fill="#5ad23e"/><circle cx="72" cy="36" r="9.5" fill="#e0201e"/>
    <g class="p-lids"><rect x="34" y="34" width="8" height="4" fill="#0a0a0a"/><rect x="68" y="34" width="8" height="4" fill="#0a0a0a"/></g>`);

  A.crocodile = () => {
    let ridges = ''; for (let x = 26; x < 170; x += 11) ridges += `<path d="M${x} 33 l5 -8 l5 8z" fill="#33481c"/>`;
    return svg('0 0 260 60', `
      <path d="M10 42 C30 30 60 28 90 32 L150 34 C170 30 196 26 214 30 C232 32 248 36 256 42 Z" fill="#46622a"/>
      ${ridges}
      <g class="p-jaw"><path d="M214 42 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" stroke="#ece8d0" stroke-width="2" fill="none"/></g>
      <ellipse cx="200" cy="28" rx="8" ry="7" fill="#46622a"/><rect x="197" y="25" width="6" height="4" fill="#d8c03a"/><rect x="199" y="25" width="2" height="4" fill="#0a0a0a"/>
      <ellipse cx="180" cy="30" rx="7" ry="6" fill="#46622a"/><rect x="177" y="27" width="6" height="4" fill="#d8c03a"/>
      <path d="M0 44 H260" stroke="#bfeff8" stroke-width="3" stroke-linecap="round"/>
      <path d="M30 50 h40 M120 52 h50 M200 49 h30" stroke="#eafcff" stroke-width="2" stroke-linecap="round"/>`);
  };

  A.iguana = () => {
    let crest = ''; for (let x = 70; x < 168; x += 7) crest += `<path d="M${x} ${44 - (x > 150 ? 4 : 0)} l3 -9 l4 9z" fill="#2c8628"/>`;
    return svg('0 0 210 92', `
      <g class="p-tail" ${O(60, 62)}><path d="M60 62 C30 64 14 72 4 86" stroke="#4aac3a" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M60 62 C30 64 14 72 4 86" stroke="#24661e" stroke-width="10" stroke-dasharray="4 8" fill="none"/></g>
      <path d="M80 64 l-8 16 M140 64 l8 16" stroke="#4aac3a" stroke-width="7" stroke-linecap="round"/>
      ${crest}
      <path d="M50 58 C70 40 130 38 160 48 C170 52 168 64 156 66 L60 68 C50 68 46 64 50 58Z" fill="#4aac3a"/>
      <path d="M90 50 v12 M110 48 v14 M130 50 v12" stroke="#2c8628" stroke-width="3" stroke-linecap="round"/>
      <g class="p-head" ${O(158, 56)}>
        <g class="p-dewlap" ${O(176, 60)}><path d="M166 58 C168 78 186 80 190 60Z" fill="#8ad04a"/></g>
        <path d="M156 44 C170 34 196 38 208 50 C200 60 180 62 160 60Z" fill="#4aac3a"/>
        <circle cx="172" cy="54" r="5" fill="#c8e0a0"/>
        <rect x="186" y="44" width="4" height="4" fill="#5a2a0a"/>
      </g>`);
  };

  A.turtle = () => svg('0 0 130 84', `
    <ellipse cx="32" cy="64" rx="10" ry="8" fill="#5a4a3a"/><ellipse cx="92" cy="64" rx="10" ry="8" fill="#5a4a3a"/>
    <circle cx="30" cy="66" r="3" fill="#d8402a"/><circle cx="94" cy="66" r="3" fill="#d8402a"/>
    <g class="p-head" ${O(104, 52)}><ellipse cx="114" cy="50" rx="14" ry="10" fill="#5a4a3a"/><circle cx="112" cy="46" r="3" fill="#e8b02a"/><rect x="118" y="46" width="3" height="3" fill="#0a0a0a"/></g>
    <path d="M12 60 C12 20 104 14 108 60 Z" fill="#2e2418"/>
    <g fill="#c8902a"><path d="M52 36 l8 -4 l8 4 v8 l-8 4 l-8 -4z"/><path d="M28 50 l8 -6 l8 2 v8 H30z"/><path d="M74 46 l10 -2 l8 6 l-2 4 H74z"/></g>
    <path d="M8 60 h104" stroke="#1e160e" stroke-width="5" stroke-linecap="round"/>`);

  const fly = (c1, c2, edge) => () => {
    const wing = `<path d="M50 40 C30 4 4 8 8 30 C10 44 30 46 50 40Z" fill="${c1}" stroke="${edge}" stroke-width="3"/><path d="M50 42 C30 50 16 70 30 74 C42 76 48 60 50 42Z" fill="${c2}" stroke="${edge}" stroke-width="3"/>`;
    return svg('0 0 100 80', `<g class="p-wl" ${O(50, 40)}>${wing}</g><g class="p-wr" ${O(50, 40)}><g transform="matrix(-1 0 0 1 100 0)">${wing}</g></g>
      <ellipse cx="50" cy="44" rx="3" ry="14" fill="#141414"/>`);
  };
  A.morpho = fly('#3aa8f0', '#1a6ac8', '#0a1a3a');
  A.julia = fly('#f08a1a', '#e0681a', '#2a1406');
  A.sulphur = fly('#f6e04a', '#e0c83a', '#4a3a0a');

  A.gecko = () => svg('0 0 80 130', `
    <g class="p-tail" ${O(40, 86)}><path d="M40 86 C40 104 30 114 40 126" stroke="#3ac25a" stroke-width="8" stroke-linecap="round" fill="none"/></g>
    <g stroke="#3ac25a" stroke-width="6" stroke-linecap="round" fill="none"><path d="M34 44 L16 34 L10 40"/><path d="M46 44 L64 34 L70 40"/><path d="M34 78 L16 88 L12 82"/><path d="M46 78 L64 88 L68 82"/></g>
    <ellipse cx="40" cy="62" rx="12" ry="28" fill="#3ac25a"/>
    <ellipse cx="40" cy="26" rx="11" ry="13" fill="#3ac25a"/>
    <g fill="#e04a2a"><rect x="34" y="50" width="4" height="4"/><rect x="42" y="60" width="4" height="4"/><rect x="34" y="70" width="4" height="4"/><rect x="38" y="20" width="4" height="8"/></g>
    <rect x="31" y="18" width="4" height="4" fill="#0a0a0a"/><rect x="45" y="18" width="4" height="4" fill="#0a0a0a"/>`);

  A.lemur = () => svg('0 0 110 200', `
    <g class="p-tail" ${O(56, 150)}>
      <path d="M56 150 C92 150 102 112 98 72 C96 42 84 22 72 14" stroke="#1a1a1a" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M56 150 C92 150 102 112 98 72 C96 42 84 22 72 14" stroke="#ececec" stroke-width="12" stroke-dasharray="9 9" fill="none"/></g>
    <ellipse cx="46" cy="132" rx="25" ry="31" fill="#86888c"/>
    <ellipse cx="46" cy="138" rx="14" ry="21" fill="#e2dfd8"/>
    <path d="M30 156 l-4 14 M62 156 l4 14" stroke="#6a6c70" stroke-width="9" stroke-linecap="round"/>
    <g class="p-head" ${O(46, 106)}>
      <path d="M30 80 l-6 -14 l14 8z M62 80 l6 -14 l-14 8z" fill="#86888c"/>
      <circle cx="46" cy="92" r="18" fill="#86888c"/>
      <path d="M32 92 C32 79 60 79 60 92 C60 104 53 113 46 113 C39 113 32 104 32 92Z" fill="#ece9e2"/>
      <path d="M33 86 L45 92 L40 100 L32 96Z M59 86 L47 92 L52 100 L60 96Z" fill="#1a1a1a"/>
      <rect x="37" y="91" width="5" height="4" fill="#f09a1c"/><rect x="50" y="91" width="5" height="4" fill="#f09a1c"/>
      <path d="M43 104 h6 l-3 4z" fill="#1a1a1a"/>
    </g>`);

  A.elephant = () => {
    const skin = '#7a828c', far = '#5e656e', dk = '#4a5058';
    const leg = (cls, x, col) => `<g class="${cls}" ${O(x + 10, 92)}><path d="M${x} 88 h20 v58 q-10 5 -20 0z" fill="${col}"/><path d="M${x + 2} 144 h4 M${x + 8} 145 h4 M${x + 14} 144 h4" stroke="#d8d0c0" stroke-width="2.4"/></g>`;
    return svg('0 0 240 160', `
      <g class="p-tail" ${O(50, 62)}><path d="M50 62 C40 74 38 92 40 104" stroke="${dk}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M37 102 l3 8 l4 -8z" fill="${dk}"/></g>
      ${leg('p-l2', 64, far)}${leg('p-l4', 140, far)}
      <path d="M48 70 C48 34 92 22 130 26 C162 28 182 44 180 72 C178 100 150 108 112 108 C74 108 48 100 48 70Z" fill="${skin}"/>
      <path d="M70 40 q30 -12 70 -6" stroke="#8e96a0" stroke-width="4" fill="none"/>
      <path d="M86 96 q8 4 16 0 M120 98 q8 4 16 0 M60 84 q6 3 12 0" stroke="${dk}" stroke-width="2" fill="none" opacity=".7"/>
      ${leg('p-l1', 76, skin)}${leg('p-l3', 150, skin)}
      <g class="p-head" ${O(176, 60)}>
        <g class="p-ear" ${O(168, 44)}><path d="M168 40 C146 34 140 62 146 80 C152 96 170 94 176 84Z" fill="#6c737c"/><path d="M164 48 C152 50 150 70 156 82" stroke="#8a7478" stroke-width="5" fill="none" opacity=".7"/></g>
        <circle cx="190" cy="58" r="28" fill="${skin}"/>
        <path d="M176 30 q14 -8 28 2" stroke="#8e96a0" stroke-width="3" fill="none"/>
        <rect x="196" y="50" width="5" height="4" fill="#120c08"/>
        <path d="M200 80 C214 84 222 92 224 98" stroke="#efe8d8" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g class="p-trunk" ${O(206, 76)}><path d="M206 66 C222 82 222 112 212 140" stroke="${skin}" stroke-width="15" fill="none" stroke-linecap="round"/>
          <path d="M210 90 h8 M211 102 h8 M210 114 h8 M208 126 h7" stroke="${dk}" stroke-width="1.6"/></g>
      </g>`);
  };

  A.leaf = () => svg('0 0 100 110', `<path d="M50 20 C38 2 4 6 6 38 C8 70 34 94 50 108 C66 94 92 70 94 38 C96 6 62 2 50 20Z" fill="#3a9a38"/><path d="M50 20 C38 2 4 6 6 38 C8 70 34 94 50 108Z" fill="#52b03a"/><path d="M50 22 V104" stroke="#92d644" stroke-width="3"/>`);

  const SPECIES = {
    monkey: ['Spider monkey', 'Ateles geoffroyi'], capuchin: ['White-faced capuchin', 'Cebus imitator'], orangutan: ['Bornean orangutan', 'Pongo pygmaeus'],
    sloth: ['Brown-throated sloth', 'Bradypus variegatus'], toucan: ['Keel-billed toucan', 'Ramphastos sulfuratus'], macaw: ['Scarlet macaw', 'Ara macao'],
    parrot: ['Yellow-crowned amazon', 'Amazona ochrocephala'], hummingbird: ['Rufous-tailed hummingbird', 'Amazilia tzacatl'], snake: ['Emerald tree boa', 'Corallus caninus'],
    chameleon: ['Panther chameleon', 'Furcifer pardalis'], jaguar: ['Jaguar', 'Panthera onca'], tiger: ['Bengal tiger', 'Panthera tigris tigris'],
    panther: ['Black panther', 'Panthera pardus (melanistic)'], frog: ['Red-eyed tree frog', 'Agalychnis callidryas'], crocodile: ['American crocodile', 'Crocodylus acutus'],
    iguana: ['Green iguana', 'Iguana iguana'], turtle: ['Red-footed tortoise', 'Chelonoidis carbonarius'], lemur: ['Ring-tailed lemur', 'Lemur catta'],
    gecko: ['Giant day gecko', 'Phelsuma grandis'], elephant: ['African forest elephant', 'Loxodonta cyclotis'], morpho: ['Blue morpho', 'Morpho peleides'], julia: ['Julia butterfly', 'Dryas iulia'], sulphur: ['Apricot sulphur', 'Phoebis argante'], leaf: ['Monstera', 'Monstera deliciosa']
  };

  /* =======================================================================
     TINY SVG → CANVAS RENDERER  (paths, circles, ellipses, rects, groups,
     inherited fill/stroke, dashes, transforms, p-* part poses)
     ======================================================================= */
  function parseAttrTf(s) {
    const ops = []; s.replace(/(\w+)\(([^)]*)\)/g, (_, f, a) => { ops.push([f, a.split(/[\s,]+/).filter(Boolean).map(Number)]); return ''; });
    return (ctx) => { for (const [f, v] of ops) {
      if (f === 'matrix') ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      else if (f === 'translate') ctx.translate(v[0], v[1] || 0);
      else if (f === 'scale') ctx.scale(v[0], v[1] == null ? v[0] : v[1]);
      else if (f === 'rotate') { const r = v[0] * Math.PI / 180; if (v.length > 2) { ctx.translate(v[1], v[2]); ctx.rotate(r); ctx.translate(-v[1], -v[2]); } else ctx.rotate(r); }
    } };
  }
  function applyCSSTf(ctx, str, ox, oy) {
    ctx.translate(ox, oy);
    str.replace(/(\w+)\(([^)]*)\)/g, (_, f, a) => {
      const v = a.split(/[\s,]+/).filter(Boolean).map(parseFloat);
      if (f === 'rotate') ctx.rotate(v[0] * Math.PI / 180);
      else if (f === 'translate') ctx.translate(v[0], v[1] || 0);
      else if (f === 'translateX') ctx.translate(v[0], 0);
      else if (f === 'translateY') ctx.translate(0, v[0]);
      else if (f === 'scale') ctx.scale(v[0], v[1] == null ? v[0] : v[1]);
      else if (f === 'scaleX') ctx.scale(v[0], 1);
      else if (f === 'scaleY') ctx.scale(1, v[0]);
      return '';
    });
    ctx.translate(-ox, -oy);
  }
  function conv(el) {
    const n = { tag: el.tagName.toLowerCase(), a: {}, kids: [] };
    for (const at of el.attributes) n.a[at.name] = at.value;
    const a = n.a;
    if (n.tag === 'path') n.p = new Path2D(a.d);
    else if (n.tag === 'circle') { n.p = new Path2D(); n.p.arc(+a.cx || 0, +a.cy || 0, +a.r, 0, Math.PI * 2); }
    else if (n.tag === 'ellipse') { n.p = new Path2D(); n.p.ellipse(+a.cx || 0, +a.cy || 0, +a.rx, +a.ry, 0, 0, Math.PI * 2); }
    else if (n.tag === 'rect') { n.p = new Path2D(); n.p.rect(+a.x || 0, +a.y || 0, +a.width, +a.height); }
    else if (n.tag === 'line') { n.p = new Path2D(); n.p.moveTo(+a.x1, +a.y1); n.p.lineTo(+a.x2, +a.y2); }
    const m = (a.class || '').match(/\bp-[\w-]+/); if (m) n.part = '.' + m[0];
    const o = (a.style || '').match(/transform-origin:\s*([\d.-]+)px\s+([\d.-]+)px/); n.origin = o ? [+o[1], +o[2]] : [0, 0];
    if (a.transform) n.tf = parseAttrTf(a.transform);
    for (const k of el.children) n.kids.push(conv(k));
    return n;
  }
  function parseSVG(str) {
    const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
    const root = doc.documentElement;
    return { vb: root.getAttribute('viewBox').split(/[\s,]+/).map(Number), node: conv(root) };
  }
  function drawNode(ctx, n, st, inh, alpha) {
    const a = n.a;
    if (n.tag === 'defs' || n.tag === 'mask') return;
    const s = { fill: a.fill != null ? a.fill : inh.fill, stroke: a.stroke != null ? a.stroke : inh.stroke, sw: a['stroke-width'] != null ? +a['stroke-width'] : inh.sw,
      cap: a['stroke-linecap'] || inh.cap, join: a['stroke-linejoin'] || inh.join, dash: a['stroke-dasharray'] || inh.dash };
    let al = alpha * (a.opacity != null ? +a.opacity : 1);
    if (n.part && st.op && st.op[n.part] != null) al *= st.op[n.part];
    if (al <= 0.02) return;
    ctx.save();
    if (n.tf) n.tf(ctx);
    if (n.part && st.parts && st.parts[n.part]) applyCSSTf(ctx, st.parts[n.part], n.origin[0], n.origin[1]);
    ctx.globalAlpha = al;
    if (n.p) {
      const col = (c) => (c === 'currentColor' ? st.color || '#fff' : c);
      if (s.fill !== 'none') { ctx.fillStyle = col(s.fill || '#000'); ctx.fill(n.p); }
      if (s.stroke && s.stroke !== 'none') {
        ctx.strokeStyle = col(s.stroke); ctx.lineWidth = s.sw || 1; ctx.lineCap = s.cap || 'butt'; ctx.lineJoin = s.join || 'miter';
        ctx.setLineDash(s.dash ? s.dash.split(/[\s,]+/).map(Number) : []); ctx.stroke(n.p);
      }
    }
    for (const k of n.kids) drawNode(ctx, k, st, s, al);
    ctx.restore();
  }

  /* =======================================================================
     PALETTE + ORDERED DITHER (gives everything its pixel-art finish)
     ======================================================================= */
  const PAL_HEX = [
    // sky & light
    '#fffbe6', '#f6f1cf', '#e2f0e6', '#c6e4ec', '#a4d2e6', '#82bede', '#64a6d0', '#4a8cc0',
    // clouds / haze / distant rock
    '#ffffff', '#e8f0f4', '#cad8e4', '#aabed2', '#8ca4bf', '#d6dbe6', '#b6c2d6', '#96a8c4', '#7a90b0', '#62789c',
    // deep shadows (navy → teal)
    '#070e16', '#0b1622', '#0f1f2e', '#13293a', '#183446', '#1e4152', '#25505e', '#2e606a', '#3a7478', '#4c8a88', '#64a29a', '#82bcae',
    // greens
    '#0e2a22', '#123a28', '#164c2e', '#1c6034', '#237438', '#2c883a', '#3a9c3a', '#4cae3a', '#64c03e', '#82d044', '#a2de52', '#c2ea6a', '#ddf494', '#eefac0',
    // trunks / earth
    '#1e120c', '#301c14', '#46281c', '#5e3826', '#764a32', '#8e5e40', '#a87452', '#c28c68', '#d8a888',
    // rock greys
    '#2e3640', '#424c58', '#58646e', '#707c86', '#8a949c', '#a6aeb4', '#c4cacc',
    // water
    '#eafcff', '#bfeff8', '#8ad8ee', '#58b8da', '#3a92c0', '#2a6e9e',
    // accents
    '#5a0e1a', '#8c1a28', '#c02a36', '#e0503e', '#f0803a', '#f6aa3e', '#f6d24a', '#fff09a', '#4a2a6a', '#7a46a8', '#b47ad8', '#e0a8f0'
  ];
  const PAL = PAL_HEX.map(hex);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  /* global colour grade (time of day + weather). mul = per-channel multiplier, sat = saturation */
  let GRADE = { mul: [1, 1, 1], sat: 1 };
  function setGrade(g) { GRADE = Object.assign({ mul: [1, 1, 1], sat: 1 }, g || {}); }
  function grade(d, i, k = 1) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const sat = 1 + (GRADE.sat - 1) * k;
    if (sat !== 1) { const l = 0.3 * r + 0.59 * g + 0.11 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
    d[i] = r * (1 + (GRADE.mul[0] - 1) * k); d[i + 1] = g * (1 + (GRADE.mul[1] - 1) * k); d[i + 2] = b * (1 + (GRADE.mul[2] - 1) * k);
  }
  const nCache = new Map();
  function nearest(r, g, b) {
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = nCache.get(key); if (v !== undefined) return v;
    let best = 0, bd = 1e12;
    for (let i = 0; i < PAL.length; i++) { const p = PAL[i]; const dr = r - p[0], dg = g - p[1], db = b - p[2]; const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } }
    nCache.set(key, best); return best;
  }
  /** pixel-art finish for a painted layer: hard alpha, atmospheric haze, palette snap with Bayer dither */
  function finalize(ctx, w, h, o = {}) {
    const haze = o.haze || 0, hz = o.hazeColor ? hex(o.hazeColor) : [190, 220, 220], dith = o.dither == null ? 30 : o.dither, cut = o.alphaCut || 100, mistLow = o.mistLow == null ? 0.6 : o.mistLow;
    const id = ctx.getImageData(0, 0, w, h), d = id.data, gk = o.grade == null ? 1 : o.grade;
    for (let y = 0; y < h; y++) {
      const hk = haze * (1 - mistLow + mistLow * 1.4 * (y / h));
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < cut) { d[i + 3] = 0; continue; }
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (hk > 0) { const k = Math.min(0.85, hk); r += (hz[0] - r) * k; g += (hz[1] - g) * k; b += (hz[2] - b) * k; }
        if (gk) { d[i] = r; d[i + 1] = g; d[i + 2] = b; grade(d, i, gk); r = d[i]; g = d[i + 1]; b = d[i + 2]; }
        const off = BAYER[((y & 3) << 2) | (x & 3)] * dith;
        const p = PAL[nearest(r + off, g + off, b + off)];
        d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  /* =======================================================================
     SPRITES — an animal model drawn small, then hard-edged and outlined
     ======================================================================= */
  const MODELS = {};
  const model = (kind) => MODELS[kind] || (MODELS[kind] = parseSVG((A[kind] || A.leaf)()));
  function Sprite(kind, wPx, o = {}) {
    this.m = model(kind); const vb = this.m.vb;
    this.w = Math.max(6, Math.round(wPx)); this.h = Math.max(4, Math.round(this.w * vb[3] / vb[2]));
    this.pad = o.pad == null ? 2 : o.pad;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w + this.pad * 2; this.canvas.height = this.h + this.pad * 2;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.outline = o.outline === false ? null : hex(o.outline || '#070e16');
    this.haze = o.haze || 0; this.hz = hex(o.hazeColor || '#9ec8c8');
    this.color = o.color; this.shade = o.shade == null ? 0.18 : o.shade; this.grade = o.grade == null ? 1 : o.grade;
  }
  Sprite.prototype.render = function (st = {}) {
    const c = this.ctx, vb = this.m.vb, W = this.canvas.width, H = this.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    c.translate(this.pad, this.pad); c.scale(this.w / vb[2], this.h / vb[3]); c.translate(-vb[0], -vb[1]);
    if (st.filter) c.filter = st.filter;
    drawNode(c, this.m.node, { parts: st.parts, op: st.op, color: this.color || st.color }, {}, 1);
    c.filter = 'none';
    c.setTransform(1, 0, 0, 1, 0, 0);
    const id = c.getImageData(0, 0, W, H), d = id.data, solid = new Uint8Array(W * H);
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      if (d[i + 3] >= 128) {
        solid[p] = 1; d[i + 3] = 255;
        if (this.haze) { d[i] += (this.hz[0] - d[i]) * this.haze; d[i + 1] += (this.hz[1] - d[i + 1]) * this.haze; d[i + 2] += (this.hz[2] - d[i + 2]) * this.haze; }
        if (this.grade) grade(d, i, this.grade);
      } else d[i + 3] = 0;
    }
    // soft bottom shading: pixels with empty space below get darkened (form shadow)
    if (this.shade) for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (solid[p] && !solid[p + W]) { const i = p * 4; d[i] *= 1 - this.shade; d[i + 1] *= 1 - this.shade; d[i + 2] *= 1 - this.shade; }
    }
    if (this.outline) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (solid[p]) continue;
      if ((x > 0 && solid[p - 1]) || (x < W - 1 && solid[p + 1]) || (y > 0 && solid[p - W]) || (y < H - 1 && solid[p + W])) {
        const i = p * 4; d[i] = this.outline[0]; d[i + 1] = this.outline[1]; d[i + 2] = this.outline[2]; d[i + 3] = 255;
      }
    }
    c.putImageData(id, 0, 0);
    return this.canvas;
  };

  /* ---------------- icons ---------------- */
  const ICON_ANIMALS = ['toucan', 'monkey', 'sloth', 'frog', 'chameleon', 'macaw', 'snake', 'jaguar', 'tiger', 'morpho', 'turtle', 'iguana', 'lemur', 'parrot', 'hummingbird', 'panther', 'capuchin', 'gecko', 'crocodile', 'julia', 'orangutan', 'elephant', 'leaf'];
  const ANIMAL_LABELS = Object.fromEntries(ICON_ANIMALS.map((k) => [k, SPECIES[k][0]]));
  const G = {
    video: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
    camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.6"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13"/><path d="M9 7V5h6v2M3 12h18"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6 9-6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    pin: '<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6"/><rect x="17" y="14" width="4" height="6"/>',
    gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="13.5" r="1" fill="currentColor"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 18z"/>',
    rain: '<path d="M7 14h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    snow: '<path d="M7 13h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 13z"/><path d="M8 17v.5M12 19v.5M16 17v.5M10 21v.5M14 21v.5"/>',
    fog: '<path d="M3 9h18M5 13h14M3 17h18"/>',
    storm: '<path d="M7 13h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 13z"/><path d="M13 13l-3 4h4l-3 5"/>',
    film: '<path d="M3.5 10.5h17v9h-17z"/><path d="M3.5 10.5l-.6-4.6 16.6-2.2.6 4.6z"/><path d="M8.2 5.3l2.4 3.6M13.6 4.6l2.4 3.6"/><path d="M7 15h10" stroke-width="2"/>',
    tv: '<path d="M2.8 8h18.4v12H2.8z"/><path d="M8 3l4 4.6L16 3"/><path d="M6 11.2h8.6v5.6H6z" stroke-width="1.8"/><path d="M18 11.4v.1M18 15.6v.1"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  const PLATFORMS = {
    instagram: ['Instagram', 'camera'], youtube: ['YouTube', 'video'], tiktok: ['TikTok', 'music'], x: ['X / Twitter', 'chat'], threads: ['Threads', 'chat'], bluesky: ['Bluesky', 'chat'],
    facebook: ['Facebook', 'people'], linkedin: ['LinkedIn', 'briefcase'], github: ['GitHub', 'code'], twitch: ['Twitch', 'gamepad'], discord: ['Discord', 'gamepad'],
    spotify: ['Spotify', 'headphones'], soundcloud: ['SoundCloud', 'headphones'], pinterest: ['Pinterest', 'pin'], snapchat: ['Snapchat', 'chat'], email: ['Email', 'mail'],
    letterboxd: ['Letterboxd', 'film'], serializd: ['Serializd', 'tv'],
    blog: ['Blog', 'pen'], website: ['Website', 'globe'], other: ['Other', 'link']
  };
  const glyphSVG = (name) => `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter">${G[name] || G.link}</svg>`;
  const iconCache = new Map();
  /** pixel icon as a data: URL. kind = animal key; px = sprite width in pixels */
  function animalIconURL(kind, px = 26) {
    const key = 'a:' + kind + ':' + px; if (iconCache.has(key)) return iconCache.get(key);
    const s = new Sprite(kind, px, { pad: 1, grade: 0 }); const url = s.render({}).toDataURL(); iconCache.set(key, url); return url;
  }
  function glyphIconURL(name, px = 16, color = '#e8f4c8') {
    const key = 'g:' + name + ':' + px + color; if (iconCache.has(key)) return iconCache.get(key);
    if (!MODELS['g:' + name]) MODELS['g:' + name] = parseSVG(glyphSVG(name));
    const s = Object.create(Sprite.prototype);
    Sprite.call(s, 'leaf', px, { pad: 1, outline: false, shade: 0, color, grade: 0 });
    s.m = MODELS['g:' + name]; s.h = px; s.canvas.height = px + 2;
    const url = s.render({ color }).toDataURL(); iconCache.set(key, url); return url;
  }
  function safeImageSrc(src) {
    if (!src) return null; const s = String(src).trim();
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(s)) return s;
    if (/^https:\/\//i.test(s)) return s;
    if (/^(\.\.\/)?[\w\-/]+(\.[\w-]+)*\.(png|jpe?g|gif|webp|svg)$/i.test(s) && !/(^|\/)\.\.(\/|$)/.test(s.replace(/^\.\.\//, ''))) return s;
    return null;
  }
  function safeHref(u) {
    const s = String(u || '').trim(); if (!s) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '#';
    return s;
  }
  function autoAnimal(item) { return ICON_ANIMALS[hash((item && (item.title || item.id)) || 'x') % (ICON_ANIMALS.length - 1)]; }
  /** <img> for an item's icon. kind = 'page' | 'social'. prefix = path prefix for repo images. px = sprite resolution */
  function iconHTML(item, kind, prefix = '', overrides, px) {
    const ic = (item && item.icon) || 'auto';
    if (ic.startsWith('animal:') && A[ic.slice(7)]) return `<img class="ji px" alt="" src="${animalIconURL(ic.slice(7), px || 26)}">`;
    if (ic !== 'auto' && !ic.startsWith('animal:')) {
      const src = (overrides && overrides[ic]) || safeImageSrc(/^(https:|data:)/i.test(ic) ? ic : prefix + ic);
      if (src) return `<img class="ji up" alt="" loading="lazy" src="${esc(src)}">`;
    }
    if (kind === 'social') { const p = PLATFORMS[item.platform] || PLATFORMS.other; return `<img class="ji px" alt="" src="${glyphIconURL(p[1], px || 14)}">`; }
    return `<img class="ji px" alt="" src="${animalIconURL(autoAnimal(item), px || 26)}">`;
  }

  /* =======================================================================
     PIXEL PAINTER — draws at low resolution; finalize() snaps to palette
     ======================================================================= */
  const TONES = {
    leafA: ['#070e16', '#0e2a22', '#164c2e', '#237438', '#4cae3a'],
    leafB: ['#0b1622', '#123a28', '#1c6034', '#2c883a', '#82d044'],
    leafMid: ['#0f1f2e', '#164c2e', '#237438', '#3a9c3a', '#a2de52'],
    leafTeal: ['#0b1622', '#1e4152', '#2e606a', '#4c8a88', '#82bcae'],
    leafDeep: ['#070e16', '#0f1f2e', '#183446', '#25505e', '#4c8a88'],
    leafLime: ['#0e2a22', '#1c6034', '#3a9c3a', '#82d044', '#c2ea6a'],
    bark: ['#1e120c', '#46281c', '#764a32', '#a87452', '#d8a888'],
    barkCool: ['#0f1f2e', '#301c14', '#5e3826', '#8e5e40', '#c28c68'],
    rock: ['#2e3640', '#58646e', '#8a949c', '#a6aeb4', '#c4cacc'],
    cliff: ['#46281c', '#764a32', '#a87452', '#c28c68', '#d8a888'],
    red: ['#5a0e1a', '#8c1a28', '#c02a36', '#e0503e', '#f0803a']
  };
  function Painter(ctx, seed) { this.c = ctx; this.r = rng(seed || 1); }
  const PP = Painter.prototype;
  PP.circ = function (x, y, r, col) { const c = this.c; c.fillStyle = col; c.beginPath(); c.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2); c.fill(); };
  PP.ell = function (x, y, rx, ry, rot, col) { const c = this.c; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(.6, rx), Math.max(.6, ry), rot || 0, 0, Math.PI * 2); c.fill(); };
  PP.line = function (x1, y1, x2, y2, w, col, cap = 'round') { const c = this.c; c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  /** foliage clump lit from (lx,ly) */
  PP.clump = function (x, y, r, tone, light = [0, -1]) {
    const R = this.r, n = 5 + Math.floor(R() * 4), bl = [];
    for (let i = 0; i < n; i++) bl.push({ x: x + (R() - 0.5) * r * 1.5, y: y + (R() - 0.5) * r * 0.9, r: r * (0.4 + R() * 0.38) });
    const lx = light[0], ly = light[1];
    for (const b of bl) this.circ(b.x - lx * b.r * 0.2, b.y - ly * b.r * 0.22, b.r, tone[0]);
    for (const b of bl) this.circ(b.x, b.y, b.r * 0.9, tone[1]);
    for (const b of bl) this.circ(b.x + lx * b.r * 0.25, b.y + ly * b.r * 0.3, b.r * 0.58, tone[2]);
    for (const b of bl) for (let k = 0; k < 5; k++) {
      const a = Math.atan2(ly, lx) + (R() - 0.5) * 2.2, d = b.r * (0.2 + R() * 0.6);
      const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
      this.c.fillStyle = R() > 0.4 ? tone[3] : tone[4]; this.c.fillRect(Math.round(px), Math.round(py), 1 + (R() > .5), 1);
    }
    // leafy edge pixels
    for (const b of bl) for (let k = 0; k < 8; k++) {
      const a = R() * Math.PI * 2, px = b.x + Math.cos(a) * b.r * 1.0, py = b.y + Math.sin(a) * b.r * 0.95;
      this.c.fillStyle = Math.sin(a) * ly + Math.cos(a) * lx > 0 ? tone[2] : tone[0];
      this.c.fillRect(Math.round(px), Math.round(py), 1 + (R() > .6), 1 + (R() > .6));
    }
  };
  /** fern / palm frond */
  PP.frond = function (x, y, len, ang, tone, o = {}) {
    const R = this.r, c = this.c, droop = o.droop == null ? 0.9 : o.droop, leaf = o.leaf || len * 0.32, steps = Math.max(8, Math.round(len / 2.2));
    let px = x, py = y, a = ang; const pts = [];
    for (let i = 0; i <= steps; i++) { pts.push([px, py, a]); const st = len / steps; px += Math.cos(a) * st; py += Math.sin(a) * st; a += (Math.PI / 2 - a) * 0.025 * droop + (Math.cos(a) > 0 ? 0.012 : -0.012) * droop; }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const [qx, qy, qa] = pts[i], t = i / pts.length, L = leaf * Math.sin(Math.PI * Math.min(1, t * 1.08)) + 1;
        [-1, 1].forEach((s) => {
          const la = qa + s * (1.15 - t * 0.35) + droop * 0.25 * Math.cos(qa) * s * 0 + 0.35 * droop;
          const ex = qx + Math.cos(la) * L, ey = qy + Math.sin(la) * L;
          const col = pass === 0 ? tone[0] : pass === 1 ? (s < 0 ? tone[2] : tone[1]) : tone[3];
          if (pass === 2 && (s > 0 || R() > 0.5)) return;
          const off = pass === 0 ? 1 : 0;
          this.line(qx + off, qy + off, ex + off, ey + off, pass === 2 ? 0.8 : 1.3, col, 'butt');
        });
      }
    }
    c.strokeStyle = tone[1]; c.lineWidth = 1; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
  };
  /** banana / broad leaf */
  PP.banana = function (x, y, len, wid, ang, tone) {
    const c = this.c, R = this.r, n = 22; const L = [], Rt = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, bend = Math.sin(t * Math.PI * 0.5) * 0.5, a = ang + bend * (Math.cos(ang) > 0 ? 1 : -1) * 0.6;
      const cx = x + Math.cos(ang) * len * t + Math.cos(ang + Math.PI / 2) * bend * len * 0.15 * (Math.cos(ang) > 0 ? 1 : -1);
      const cy = y + Math.sin(ang) * len * t + Math.max(0, bend) * len * 0.25;
      const w = wid * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02));
      L.push([cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w, cx, cy]);
      Rt.push([cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w]);
    }
    c.fillStyle = tone[1]; c.beginPath(); L.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let i = Rt.length - 1; i >= 0; i--) c.lineTo(Rt[i][0], Rt[i][1]); c.fill();
    c.fillStyle = tone[2]; c.beginPath(); L.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let i = L.length - 1; i >= 0; i--) c.lineTo(L[i][2], L[i][3]); c.fill();
    for (let i = 2; i < n - 1; i += 2) { const p = L[i]; if (R() > 0.55) this.line(p[2], p[3], p[0], p[1], 1, tone[0]); else this.line(p[2], p[3], (p[0] + p[2]) / 2, (p[1] + p[3]) / 2, 0.8, tone[3]); }
    c.strokeStyle = tone[3]; c.lineWidth = 1; c.beginPath(); L.forEach((p, i) => (i ? c.lineTo(p[2], p[3]) : c.moveTo(p[2], p[3]))); c.stroke();
  };
  /** heart / monstera leaf */
  PP.heart = function (x, y, s, ang, tone) {
    const c = this.c; c.save(); c.translate(x, y); c.rotate(ang); c.scale(s / 100, s / 100);
    const p = new Path2D('M0 -40 C-12 -58 -46 -54 -44 -22 C-42 10 -16 34 0 48 C16 34 42 10 44 -22 C46 -54 12 -58 0 -40Z');
    c.fillStyle = tone[1]; c.fill(p);
    c.fillStyle = tone[2]; c.fill(new Path2D('M0 -40 C-12 -58 -46 -54 -44 -22 C-42 10 -16 34 0 48Z'));
    c.strokeStyle = tone[0]; c.lineWidth = 7; c.beginPath(); [-20, 0, 20].forEach((yy) => { c.moveTo(-6, yy); c.lineTo(-50, yy + 14); c.moveTo(6, yy); c.lineTo(50, yy + 14); }); c.stroke();
    c.strokeStyle = tone[3]; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -38); c.lineTo(0, 46); c.stroke();
    c.restore();
  };
  PP.trunk = function (x, yTop, yBot, w0, w1, tone, o = {}) {
    const c = this.c, R = this.r;
    const poly = (k0, k1, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - w0 / 2 + w0 * k0, yTop); c.lineTo(x - w0 / 2 + w0 * k1, yTop); c.lineTo(x - w1 / 2 + w1 * k1, yBot); c.lineTo(x - w1 / 2 + w1 * k0, yBot); c.fill(); };
    poly(0, 1, tone[1]); poly(0.12, 0.5, tone[2]); poly(0.2, 0.32, tone[3]); poly(0.78, 1, tone[0]);
    // root flare
    c.fillStyle = tone[1]; c.beginPath(); c.moveTo(x - w1 * 0.5, yBot - w1 * 0.8); c.quadraticCurveTo(x - w1 * 0.6, yBot, x - w1 * 1.1, yBot); c.lineTo(x + w1 * 1.1, yBot); c.quadraticCurveTo(x + w1 * 0.6, yBot, x + w1 * 0.5, yBot - w1 * 0.8); c.fill();
    // bark grooves
    const H = yBot - yTop;
    for (let i = 0; i < Math.max(3, w0 / 3); i++) {
      const k = 0.15 + R() * 0.7; let yy = yTop;
      while (yy < yBot) { const seg = 4 + R() * 14, t = (yy - yTop) / H, ww = w0 + (w1 - w0) * t; const xx = x - ww / 2 + ww * k; this.line(xx, yy, xx + (R() - 0.5) * 2, yy + seg, 1, k > 0.6 ? tone[0] : tone[1], 'butt'); yy += seg + 2 + R() * 8; }
    }
    // moss & epiphytes
    if (o.moss !== false) for (let i = 0; i < H / 18; i++) { const t = R(), yy = yTop + t * H, ww = w0 + (w1 - w0) * t; this.clump(x - ww * 0.32, yy, 1.5 + R() * ww * 0.12, o.mossTone || TONES.leafA, [-0.6, -0.8]); }
  };
  PP.branch = function (x1, y1, x2, y2, th, tone, leafTone) {
    this.line(x1, y1 + th * 0.25, x2, y2 + th * 0.25, th, tone[0]);
    this.line(x1, y1, x2, y2, th * 0.8, tone[1]);
    this.line(x1, y1 - th * 0.22, x2, y2 - th * 0.22, Math.max(1, th * 0.25), tone[3]);
    const R = this.r, n = Math.max(3, Math.hypot(x2 - x1, y2 - y1) / 10);
    for (let i = 0; i < n; i++) { const t = R(); const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t - th * 0.5; if (R() > 0.4) this.clump(x, y, th * (0.5 + R() * 0.5), leafTone || TONES.leafA, [-0.4, -1]); }
    this.clump(x2, y2 - th * 0.4, th * 1.6, leafTone || TONES.leafB, [-0.4, -1]);
  };
  /** curving liana; pts = cubic [p0,p1,p2,p3] */
  PP.liana = function (pts, th, tone, o = {}) {
    const R = this.r, c = this.c, N = Math.max(20, Math.round(Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]) / 1.5));
    const P = (t) => { const u = 1 - t; return [u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0], u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1]]; };
    const path = (w, col, dy = 0) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i <= N; i++) { const p = P(i / N); i ? c.lineTo(p[0], p[1] + dy) : c.moveTo(p[0], p[1] + dy); } c.stroke(); };
    path(th, tone[0], th * 0.15); path(th * 0.78, tone[1]); path(Math.max(0.8, th * 0.3), tone[2], -th * 0.22);
    // braided twist marks
    if (th > 2.5) for (let i = 0; i < N; i += Math.max(2, Math.round(th * 0.9))) { const p = P(i / N), q = P(Math.min(1, (i + 1) / N)); const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + 1.0; this.line(p[0] - Math.cos(a) * th * 0.35, p[1] - Math.sin(a) * th * 0.35, p[0] + Math.cos(a) * th * 0.35, p[1] + Math.sin(a) * th * 0.35, Math.max(0.8, th * 0.12), tone[0], 'butt'); }
    if (o.wind) { // a thinner strand spiralling round the main one
      const perp = (t) => { const p = P(t), q = P(Math.min(1, t + 0.002)); const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2; return [Math.cos(a), Math.sin(a)]; };
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N * 2; i++) {
        const t = i / (N * 2), p = P(t), n = perp(t), ph = Math.sin(t * o.wind * Math.PI * 2), front = Math.cos(t * o.wind * Math.PI * 2) > 0;
        if (front !== (pass === 1)) continue;
        const wt = o.windTone || tone; c.fillStyle = front ? (ph < 0 ? wt[3] : wt[2]) : wt[0];
        const r = Math.max(0.6, th * 0.22);
        c.beginPath(); c.arc(p[0] + n[0] * ph * th * 0.55, p[1] + n[1] * ph * th * 0.55, r, 0, Math.PI * 2); c.fill();
      }
    }
    if (o.roots) for (let i = 0; i < o.roots; i++) { // hanging aerial roots / tendrils with leaves
      const rt = R() < 0.5 ? 0.04 + R() * 0.24 : 0.72 + R() * 0.24; const p = P(rt), len = th * (o.rootLen || 1) * (2 + R() * 4); let x = p[0], y = p[1] + th * 0.3;
      c.strokeStyle = tone[1]; c.lineWidth = Math.max(0.8, th * 0.14); c.beginPath(); c.moveTo(x, y);
      const sw = (R() - 0.5) * th; c.quadraticCurveTo(x + sw, y + len * 0.5, x + sw * 0.4, y + len); c.stroke();
      if (R() > 0.35) this.heart(x + sw * 0.4, y + len + th * 0.5, th * (0.7 + R() * 0.6), Math.PI + (R() - 0.5), o.leafTone || TONES.leafB);
    }
    if (o.leaves) for (let i = 0; i < o.leaves; i++) { const t = R(), p = P(t); const lt = o.leafTone || TONES.leafB; if (R() > 0.5) this.heart(p[0], p[1] + th * 0.9, th * (0.9 + R() * 0.9), (R() - 0.5) * 1.6 + Math.PI, lt); else this.clump(p[0], p[1] - th * 0.2, th * (0.5 + R() * 0.6), lt, [-0.3, -1]); }
    if (o.moss) for (let i = 0; i < o.moss; i++) { const p = P(R()); this.clump(p[0], p[1] - th * 0.3, th * (0.4 + R() * 0.4), o.mossTone || TONES.leafLime, [-0.3, -1]); }
    return P;
  };
  PP.cloud = function (x, y, w) {
    const R = this.r, bl = [];
    for (let i = 0; i < 7; i++) bl.push([x + (R() - 0.5) * w, y - R() * w * 0.25, w * (0.16 + R() * 0.16)]);
    bl.forEach(([bx, by, r]) => this.circ(bx + r * 0.1, by + r * 0.25, r, '#aabed2'));
    bl.forEach(([bx, by, r]) => this.circ(bx, by, r * 0.92, '#e8f0f4'));
    bl.forEach(([bx, by, r]) => this.circ(bx - r * 0.2, by - r * 0.25, r * 0.55, '#ffffff'));
  };
  PP.ridge = function (y0, amp, col, hiCol, w, seed) {
    const R = rng(seed), c = this.c; let x = -10, y = y0; c.fillStyle = col; c.beginPath(); c.moveTo(-10, this.c.canvas.height + 10);
    const pts = [];
    while (x < w + 20) { y = y0 - R() * amp; pts.push([x, y]); x += 8 + R() * 26; }
    pts.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(w + 20, this.c.canvas.height + 10); c.fill();
    if (hiCol) for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; if (q[1] > p[1]) { c.fillStyle = hiCol; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(p[0] + (q[0] - p[0]) * 0.3, q[1] + 12); c.fill(); } }
  };
  PP.cliff = function (x0, y0, x1, y1, tone, side = 1) {
    const c = this.c, R = this.r;
    c.fillStyle = tone[1]; c.beginPath(); c.moveTo(x0, y1);
    for (let y = y1; y > y0; y -= 6) c.lineTo(x0 + (R() - 0.5) * 6 + side * Math.sin(y / 30) * 4, y);
    c.lineTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.fill();
    for (let y = y0 + 4; y < y1; y += 5 + R() * 7) { this.line(Math.min(x0, x1) + R() * 3, y, Math.max(x0, x1), y + (R() - 0.5) * 2, 1.2, R() > 0.5 ? tone[0] : tone[2], 'butt'); }
    for (let i = 0; i < (y1 - y0) / 6; i++) { const yy = y0 + R() * (y1 - y0); c.fillStyle = tone[3]; c.fillRect(x0 + side * (2 + R() * 8), yy, 2 + R() * 5, 1); }
    // jungle cap + hanging greenery
    for (let x = Math.min(x0, x1) - 4; x < Math.max(x0, x1) + 4; x += 5) this.clump(x, y0 - 1, 5 + R() * 4, TONES.leafB, [-0.3, -1]);
    for (let i = 0; i < 6; i++) { const xx = x0 + side * (R() * 12); this.line(xx, y0, xx + (R() - 0.5) * 3, y0 + 8 + R() * 30, 1, TONES.leafA[2]); }
  };
  PP.bromeliad = function (x, y, s, tone = TONES.red) {
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.32; this.line(x, y, x + Math.cos(a) * s * (0.7 + (i % 2) * 0.3), y + Math.sin(a) * s * (0.7 + (i % 2) * 0.3), Math.max(1, s * 0.16), tone[i % 3 + 1]); }
    this.circ(x, y - s * 0.1, s * 0.18, tone[4]);
  };
  PP.vgrad = function (x, y, w, h, stops) {
    const g = this.c.createLinearGradient(0, y, 0, y + h); stops.forEach(([o, col]) => g.addColorStop(o, col)); this.c.fillStyle = g; this.c.fillRect(x, y, w, h);
  };
  PP.rgrad = function (x, y, r, stops) {
    const g = this.c.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, col]) => g.addColorStop(o, col)); this.c.fillStyle = g; this.c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* =======================================================================
     STOP-MOTION CLOCK  — FPS frames per second, poses applied to sprites
     ======================================================================= */
  const FPS = 6, S = Math.sin;
  const MOTION = {
    monkey(c, t, p) { const k = p >= 0 ? Math.exp(-p * 1.1) : 0; c.R(`rotate(${(6 + 22 * k) * S(t * 1.7 + c.ph)}deg)`); c.T('.p-tail', `rotate(${14 * S(t * 2.1 + c.ph)}deg)`); c.T('.p-arm', `rotate(${(14 + 30 * k) * S(t * 2.6 + c.ph)}deg)`); c.T('.p-head', `rotate(${6 * S(t * 1.1 + c.ph)}deg)`); },
    toucan(c, t, p) { c.T('.p-head', `rotate(${(p >= 0 && p < 1.4 ? -16 + 8 * S(p * 18) : 0) + 7 * Math.round(S(t * 0.9 + c.ph))}deg)`); c.T('.p-tail', `rotate(${6 * S(t * 2 + c.ph)}deg)`); c.R(`translateY(${p >= 0 && p < 0.8 ? -8 * S(p * Math.PI / 0.8) : 0}%)`); },
    macaw(c, t, p) { c.T('.p-head', `rotate(${10 * Math.round(S(t * 0.8 + c.ph) * 2) / 2}deg)`); c.T('.p-wing', `rotate(${p >= 0 && p < 1.5 ? 40 * Math.abs(S(p * 12)) : 4 * S(t * 2)}deg)`); c.T('.p-tail', `rotate(${5 * S(t * 1.4 + c.ph)}deg)`); },
    snake(c, t, p) { const flick = (p >= 0 && p < 1.5) || (Math.floor(t * 1.3 + c.ph) % 4 === 0); c.T('.p-tongue', `scale(${flick ? 1 : 0.1})`); c.T('.p-head', `rotate(${(p >= 0 ? 14 * S(p * 10) * Math.exp(-p) : 0) + 6 * S(t * 1.2 + c.ph)}deg)`); c.R(`translateY(${2 * S(t * 0.9 + c.ph)}%)`); },
    chameleon(c, t, p) { c.T('.p-tongue', `scaleX(${p >= 0 && p < 0.9 ? S(p * Math.PI / 0.9) : 0.001})`); c.T('.p-eye', `translate(${3 * Math.round(S(t * 0.7 + c.ph) * 2) / 2},${2 * Math.round(S(t * 0.43) * 2) / 2})`); c.T('.p-tail', `rotate(${5 * S(t + c.ph)}deg)`); if (p >= 0 && p < 3) c.F(`hue-rotate(${Math.round(p * 6) * 40}deg)`); },
    jaguar(c, t, p) { c.T('.p-tail', `rotate(${12 * S(t * 1.5 + c.ph) + (p >= 0 ? 20 * S(p * 9) * Math.exp(-p) : 0)}deg)`); const awake = (p >= 0 && p < 3) || Math.floor(t * 0.5 + c.ph) % 5 === 0; c.O('.p-lids', awake ? 0 : 1); c.O('.p-eyes', awake ? 1 : 0); c.T('.p-head', `rotate(${awake ? -6 : 2 * S(t * 0.6)}deg)`); },
    tiger(c, t, p) { const roar = p >= 0 && p < 1.6; c.R(`translateY(${roar ? -12 : 4 + 4 * S(t * 0.6 + c.ph)}%) rotate(${roar ? 3 * S(p * 30) : 2 * S(t * 0.5)}deg)`); c.O('.p-eyes', Math.floor(t * 2 + c.ph) % 13 === 0 ? 0 : 1); c.T('.p-jaw', `scale(1,${roar ? 2.6 : 1})`); c.T('.p-ears', `translate(0,${Math.round(S(t * 1.5)) * 2})`); },
    panther(c, t, p) { c.O('.p-eyes', (p >= 0 && p < 2) ? 1 : (Math.floor(t * 1.5 + c.ph) % 9 === 0 ? 0 : 1)); c.T('.p-tail', `rotate(${10 * S(t * 1.1 + c.ph)}deg)`); c.R(`translateX(${p >= 0 && p < 2 ? -6 * S(p * 1.6) : 0}%)`); },
    frog(c, t, p) { const j = p >= 0 && p < 0.9 ? S(p * Math.PI / 0.9) : 0; c.R(`translateY(${-60 * j}%) rotate(${-10 * j}deg)`); c.T('.p-pouch', `scale(${1 + (p > 0.9 && p < 2.4 ? 0.7 * Math.abs(S(p * 9)) : (Math.floor(t * 1.4 + c.ph) % 6 === 0 ? 0.6 : 0))})`); c.T('.p-lids', Math.floor(t + c.ph) % 7 === 0 ? 'scale(1,.2)' : ''); },
    crocodile(c, t, p) { const sn = p >= 0 && p < 1.4; c.R(`translateY(${sn ? -18 : 6 * S(t * 0.7 + c.ph)}%) translateX(${4 * S(t * 0.2 + c.ph)}%)`); c.T('.p-jaw', `translate(0,${sn ? 6 * Math.abs(S(p * 10)) : 0})`); },
    iguana(c, t, p) { const bob = p >= 0 && p < 2 ? Math.abs(S(p * 9)) : (Math.floor(t * 2 + c.ph) % 9 < 2 ? Math.abs(S(t * 9)) : 0); c.T('.p-head', `rotate(${-10 * bob}deg)`); c.T('.p-dewlap', `scale(${1 + 0.6 * bob})`); c.T('.p-tail', `rotate(${4 * S(t * 0.8 + c.ph)}deg)`); },
    turtle(c, t, p) { const hide = p >= 0 && p < 2.6; c.T('.p-head', `translate(${hide ? -18 : 0},0) scale(${hide ? 0.7 : 1})`); c.R(`translateX(${((t * 0.6 + c.ph * 7) % 30) - 15}%)`); },
    lemur(c, t, p) { c.T('.p-tail', `rotate(${(p >= 0 ? 18 * S(p * 7) * Math.exp(-p * 0.6) : 0) + 8 * S(t * 1.3 + c.ph)}deg)`); c.T('.p-head', `rotate(${10 * Math.round(S(t * 0.6 + c.ph) * 2) / 2}deg)`); },
    gecko(c, t, p) { c.T('.p-tail', `rotate(${14 * S(t * 2 + c.ph)}deg)`); c.R(`translateY(${p >= 0 && p < 1.2 ? -40 * p : 0}%)`); },
    hummingbird(c, t, p) { c.T('.p-wings', `rotate(${c.frame % 2 ? -30 : 25}deg)`); c.R(`translate(${(p >= 0 && p < 1 ? 80 * p : 0) + 10 * S(t * 1.3 + c.ph)}%,${12 * S(t * 2.2 + c.ph)}%)`); },
    butterfly(c) { const sx = [1, 0.3, 0.7][c.frame % 3]; c.T('.p-wl', `scaleX(${sx})`); c.T('.p-wr', `scaleX(${sx})`); },
    bird(c) { c.T('.p-w', `scaleY(${c.frame % 2 ? -0.6 : 1})`); },
    /** the vine sloth: 4-beat hand-over-hand gait; poke = stops and looks at you */
    sloth(c, t, p) {
      const look = p >= 0 && p < 4;
      const ph = c.gait || 0; // advanced by the scene only while moving
      const g = Math.floor(ph) % 4;
      const sw = [[-14, 10], [0, 0], [12, -10], [0, 0]][g];
      c.T('.p-fl', `rotate(${sw[0]}deg)`); c.T('.p-br', `rotate(${sw[0] * 0.8}deg)`);
      c.T('.p-fr', `rotate(${sw[1]}deg)`); c.T('.p-bl', `rotate(${sw[1] * 0.8}deg)`);
      c.T('.p-head', `rotate(${look ? 18 : 4 * S(t * 0.5)}deg) translate(0,${look ? 4 : 0})`);
      c.O('.p-eyes', Math.floor(t * 0.7 + c.ph) % 6 === 0 ? 0 : 1);
    }
  };
  /** elephants: c.walking → 4-beat leg cycle; c.trumpet (0..1) → trunk raised, ears out */
  MOTION.elephant = function (c, t) {
    const g = c.frame % 4, sw = c.walking ? [[14, -14], [0, 0], [-14, 14], [0, 0]][g] : [0, 0];
    c.T('.p-l1', `rotate(${sw[0]}deg)`); c.T('.p-l4', `rotate(${sw[0]}deg)`); c.T('.p-l2', `rotate(${sw[1]}deg)`); c.T('.p-l3', `rotate(${sw[1]}deg)`);
    const tr = c.trumpet || 0;
    c.T('.p-trunk', `rotate(${-150 * tr + (tr ? 6 * Math.sin(t * 14) : 8 * Math.sin(t * 1.3 + c.ph))}deg)`);
    c.T('.p-ear', `rotate(${tr ? -24 - 10 * Math.abs(Math.sin(t * 9)) : 5 * Math.sin(t * 1.7 + c.ph)}deg)`);
    c.T('.p-head', `rotate(${tr ? -10 * tr : (c.walking ? [0, 2, 0, -2][g] : 0)}deg)`);
    c.T('.p-tail', `rotate(${10 * Math.sin(t * 2 + c.ph)}deg)`);
  };
  MOTION.parrot = MOTION.macaw; MOTION.capuchin = MOTION.orangutan = MOTION.monkey;
  ['morpho', 'julia', 'sulphur'].forEach((k) => { MOTION[k] = MOTION.butterfly; });

  const Motion = {
    fps: FPS, list: [], movers: [], hooks: [], t0: performance.now(), running: false, _n: 0,
    reduce: !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches),
    /** el = wrapper, cm = element that gets the root transform, sprite = Sprite, canvasEl = <canvas> shown on screen */
    register(o) {
      const c = Object.assign({ ph: Math.random() * 6.28, pk: -1, frame: 0 }, o);
      c.T = (sel, v) => { c.st.parts[sel] = v; }; c.O = (sel, v) => { c.st.op[sel] = v; }; c.R = (v) => { c.root = v; }; c.F = (v) => { c.st.filter = v; };
      c.draw = () => { const cv = c.sprite.render(c.st); const x = c.canvasEl.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(cv, 0, 0); };
      this.list.push(c); return c;
    },
    mover(el, fn) { this.movers.push({ el, fn }); },
    onFrame(fn) { this.hooks.push(fn); },
    poke(c) { c.pk = 0; },
    clear() { this.list = []; this.movers = []; this.hooks = []; },
    tick() {
      const t = (performance.now() - this.t0) / 1000;
      if (++this._n % 60 === 0) { this.list = this.list.filter((c) => c.el.isConnected); this.movers = this.movers.filter((m) => m.el.isConnected); }
      this.hooks = this.hooks.filter((h) => h(t) !== false);
      for (const c of this.list) {
        if (!c.el.isConnected) continue;
        c.frame++; c.st = { parts: {}, op: {} }; c.root = '';
        const fn = MOTION[c.kind]; if (fn) fn(c, t, c.pk);
        if (c.override) { const r = c.override(c, t); if (r != null) c.root = r; }
        if (c.pk >= 0) { c.pk += 1 / this.fps; if (c.pk > 4) c.pk = -1; }
        c.draw();
        if (c.cm) c.cm.style.transform = c.root;
      }
      for (const m of this.movers) { if (!m.el.isConnected) continue; const r = m.fn(t); m.el.style.transform = `translate(${Math.round(r.x)}px,${Math.round(r.y)}px) rotate(${(r.rot || 0).toFixed(1)}deg) scaleX(${r.flip ? -1 : 1})`; if (r.o != null) m.el.style.opacity = r.o; }
    },
    start() { if (this.running) return; this.running = true; if (this.reduce) { this.tick(); return; } this._iv = setInterval(() => this.tick(), 1000 / this.fps); this.tick(); }
  };

  /** creates a live sprite element: <div class="sp"><div class="cm"><canvas></div></div>; px = on-screen size of one sprite pixel */
  function liveSprite(kind, wPx, px, opts = {}) {
    const sprite = new Sprite(kind, wPx, opts);
    const el = document.createElement('div'); el.className = 'sp';
    const cm = document.createElement('div'); cm.className = 'cm';
    const cv = document.createElement('canvas'); cv.width = sprite.canvas.width; cv.height = sprite.canvas.height;
    cv.style.width = cv.width * px + 'px'; cv.style.height = cv.height * px + 'px'; cv.style.imageRendering = 'pixelated';
    cm.appendChild(cv); el.appendChild(cm);
    const c = Motion.register({ el, cm, sprite, canvasEl: cv, kind });
    c.st = { parts: {}, op: {} }; c.draw();
    return c;
  }

  /* =======================================================================
     DEFAULT SITE DATA + starter pages
     ======================================================================= */
  const DEFAULT_SITE = {
    title: 'Harry',
    tagline: '',
    pages: [
      { id: 'about', title: 'About', url: 'about', icon: 'animal:monkey' },
      { id: 'projects', title: 'Projects', url: 'projects', icon: 'animal:toucan' },
      { id: 'gallery', title: 'Gallery', url: 'gallery', icon: 'animal:chameleon' },
      { id: 'flappy', title: 'Flappy', url: 'flappy', icon: 'animal:macaw', place: 'jungle' },
      { id: 'trolley', title: 'Trolley Trials', url: 'trolley', icon: 'animal:capuchin', place: 'jungle' },
      { id: 'trivia', title: 'Tree-Frog Trivia', url: 'trivia', icon: 'animal:frog', place: 'jungle' },
      { id: 'arcade', title: 'Arcade', url: 'arcade', icon: 'animal:parrot', place: 'jungle' },
      { id: 'contact', title: 'Contact', url: 'contact', icon: 'animal:frog' }
    ],
    socials: [
      { id: 'ig', platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/', icon: 'auto' },
      { id: 'yt', platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/', icon: 'auto' },
      { id: 'tt', platform: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/', icon: 'auto' }
    ]
  };
  /** page folders that must not be used for new pages */
  const RESERVED = ['icons', 'fonts', 'pages', 'index', 'console', 'site', 'favicon', 'cookies', 'flappy', 'trolley', 'trivia', 'arcade', 'swing', 'stack', 'snap', 'shush', 'arcade-kit', 'share', 'media', '404', 'apple-touch-icon', 'jungle-kit', 'page'];
  const pageSlug = (title, taken = []) => { let b = slugify(title); if (RESERVED.includes(b)) b += '-page'; let s = b, n = 1; while (taken.includes(s)) s = `${b}-${++n}`; return s; };

  /* =======================================================================
     CONSENT — nothing optional is stored on the device until the visitor
     accepts. Until then those values only live in memory for this visit.
     ======================================================================= */
  const CONSENT_KEY = 'harry-consent';
  const FUNCTIONAL = ['harry-wx', 'harry-sound', 'harry-flappy', 'harry-trolley', 'harry-trivia', 'harry-swing', 'harry-stack', 'harry-snap'];
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage off */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage off */ } } };
  const MEM = {}, subs = [];
  const Consent = {
    get() { return ls.get(CONSENT_KEY); },                 // 'all' | 'essential' | null (not asked yet)
    allowed() { return Consent.get() === 'all'; },
    set(v) {
      ls.set(CONSENT_KEY, v);
      if (v === 'all') Object.keys(MEM).forEach((k) => ls.set(k, MEM[k]));
      else FUNCTIONAL.forEach((k) => ls.del(k));
      subs.forEach((f) => f(v));
    },
    onChange(f) { subs.push(f); },
    /** shows the banner (first visit, or `force` from the footer "Cookies" link). policy = link to the cookie policy */
    banner(policy, force) {
      if (!force && Consent.get()) return;
      if (!document.getElementById('cbar-css')) {
        const st = document.createElement('style'); st.id = 'cbar-css';
        st.textContent = `.cbar{position:fixed;z-index:30;left:50%;bottom:max(34px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(560px,calc(100vw - 24px));padding:16px 18px;background:#f4efe1;color:#14181a;box-shadow:0 0 0 3px #14181a,6px 6px 0 3px #14181a;font:15px/1.45 Barlow,system-ui,sans-serif;animation:cbin .4s steps(4)}
.cbar b{display:block;margin-bottom:4px;font:600 13px 'Pixelify Sans',ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}
.cbar p{margin:0 0 12px}.cbar a{color:#1d7a35;font-weight:600}
.cbar .cb-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.cbar button{font:600 13px 'Pixelify Sans',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;padding:10px 14px;border:0;cursor:pointer;background:#f4efe1;color:#14181a;box-shadow:inset 0 0 0 3px #14181a}
.cbar button.cb-yes{background:#43c463;box-shadow:inset 0 0 0 3px #14181a,3px 3px 0 #14181a}
.cbar button:focus-visible{outline:3px solid #43c463;outline-offset:2px}
@keyframes cbin{from{opacity:0;margin-bottom:-10px}to{opacity:1;margin-bottom:0}}`;
        document.head.appendChild(st);
      }
      const old = document.querySelector('.cbar'); if (old) old.remove();
      const el = document.createElement('div'); el.className = 'cbar'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cookies and storage');
      el.innerHTML = `<b>Cookies &amp; storage</b><p>No tracking and no ads, but with your OK, we use your device’s storage to remember your settings and saved progress (like game scores), and to keep recent info like the weather. <a href="${esc(policy)}">Cookie policy</a></p>
        <div class="cb-row"><button type="button" class="cb-no">Essential only</button><button type="button" class="cb-yes">Accept</button></div>`;
      el.querySelector('.cb-no').addEventListener('click', () => { Consent.set('essential'); el.remove(); });
      el.querySelector('.cb-yes').addEventListener('click', () => { Consent.set('all'); el.remove(); });
      document.body.appendChild(el);
    }
  };
  /** storage for optional ("functional") things — persisted only with consent, otherwise remembered for this visit */
  const store = {
    get(k) { return Consent.allowed() ? ls.get(k) : (k in MEM ? MEM[k] : null); },
    set(k, v) { MEM[k] = v; if (Consent.allowed()) ls.set(k, v); }
  };

  /* =======================================================================
     LONDON SUN + LIVERPOOL WEATHER (shared by the game and pages)
     ======================================================================= */
  const Env = {
    sun(date = new Date()) {
      const rad = Math.PI / 180, lat = 51.5074, lon = -0.1278, d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
      const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
      const Ls = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
      const ra = Math.atan2(Math.cos(e) * Math.sin(Ls), Math.cos(Ls)), dec = Math.asin(Math.sin(e) * Math.sin(Ls));
      const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
      let ha = (gmst * 15 + lon) * rad - ra; ha = Math.atan2(Math.sin(ha), Math.cos(ha));
      return { alt: Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad, morning: ha < 0 };
    },
    phase(date) {
      const s = Env.sun(date);
      if (s.alt < -7) return 'night'; if (s.alt < -0.5) return s.morning ? 'dawn' : 'dusk'; if (s.alt < 9) return s.morning ? 'dawn' : 'golden'; return 'day';
    },
    CODES: [[[0], 'clear', 'Clear'], [[1], 'cloudy', 'Mainly clear'], [[2], 'cloudy', 'Partly cloudy'], [[3], 'overcast', 'Overcast'], [[45, 48], 'fog', 'Fog'],
      [[51, 53, 55, 56, 57], 'drizzle', 'Drizzle'], [[61], 'rain', 'Light rain'], [[63, 80, 81], 'rain', 'Rain'], [[65, 66, 67, 82], 'heavy', 'Heavy rain'],
      [[71, 73, 75, 77, 85, 86], 'snow', 'Snow'], [[95, 96, 99], 'storm', 'Thunderstorm']],
    URL: 'https://api.open-meteo.com/v1/forecast?latitude=53.4084&longitude=-2.9916&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=mph&timezone=Europe%2FLondon',
    async weather() {
      try { const c = JSON.parse(store.get('harry-wx') || 'null'); if (c && Date.now() - c.at < 20 * 60e3) return c.wx; } catch (e) { /* none cached */ }
      const r = await fetch(Env.URL, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const cur = (await r.json()).current, row = Env.CODES.find((w) => w[0].includes(cur.weather_code)) || [0, 'cloudy', 'Cloudy'];
      const wx = { kind: row[1], desc: row[2], temp: Math.round(cur.temperature_2m), wind: cur.wind_speed_10m };
      store.set('harry-wx', JSON.stringify({ at: Date.now(), wx })); return wx;
    }
  };

  /* =======================================================================
     STARTER PAGES — each page is a folder (about/index.html → /about)
     ======================================================================= */
  const fontLink = (pre) => `<link rel="stylesheet" href="${pre}fonts/fonts.css">`;
  const iconLinks = (pre) => `<link rel="icon" href="${pre}favicon.svg" type="image/svg+xml">\n<link rel="icon" href="${pre}favicon-32.png" sizes="32x32" type="image/png">\n<link rel="apple-touch-icon" href="${pre}apple-touch-icon.png">`;
  /** a page file. Visiting it directly hands over to the home page, which shows it inside the jungle */
  function pageTemplate(title, siteTitle = 'Harry', slug, bodyHTML) {
    const t = esc(title), st = esc(siteTitle), sl = slug || pageSlug(title);
    const body = bodyHTML || `  <h1>${t}</h1>\n  <p>This page is ready for your content. Open <code>${esc(sl)}/index.html</code> in your repository and replace this paragraph with your own words, pictures and links.</p>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} · ${st}</title>
<script>if (!/[?&]standalone\\b/.test(location.search)) location.replace('../?p=' + encodeURIComponent('${sl}') + location.hash);</script>
${iconLinks('../')}
${fontLink('../')}
<link rel="stylesheet" href="../page.css">
</head>
<body>
<canvas class="backdrop" aria-hidden="true"></canvas>
<header class="top"><a class="home" href="../">${st}</a></header>
<main class="sheet">
${body}
</main>
<footer class="copy">Copyright © <span class="yr">2026</span> Ducklops · <a href="../cookies/">Cookies</a></footer>
<script src="../jungle-kit.js"></script>
<script>JungleKit.decoratePage(document.querySelector('.backdrop'));</script>
</body>
</html>
`;
  }

  /** paints a calm pixel jungle frame behind a page (or the console) plus a few 6fps animals */
  function decoratePage(cv, opts = {}) {
    // an older page opened directly → show it inside the home page instead
    if (opts.redirect !== false && !/[?&]standalone\b/.test(location.search) && location.href.startsWith(SITE_ROOT)) {
      const rel = location.href.slice(SITE_ROOT.length).split(/[?#]/)[0].replace(/index\.html$/, '').replace(/\/$/, '');
      if (rel && !/^(console|404)(\.html)?$/.test(rel) && !rel.includes('..')) { location.replace(SITE_ROOT + '?p=' + encodeURIComponent(rel)); return; }
    }
    document.querySelectorAll('.yr').forEach((y) => { y.textContent = new Date().getFullYear(); });
    if (!cv) return;
    const draw = () => {
      const PX = Math.max(2, Math.min(5, Math.round(Math.min(innerWidth, innerHeight) / 220)));
      const W = Math.ceil(innerWidth / PX), H = Math.ceil(innerHeight / PX);
      cv.width = W; cv.height = H; cv.style.width = W * PX + 'px'; cv.style.height = H * PX + 'px';
      const c = cv.getContext('2d', { willReadFrequently: true }), P = new Painter(c, 9);
      P.vgrad(0, 0, W, H, [[0, '#a4d2e6'], [0.45, '#e2f0e6'], [1, '#64a29a']]);
      P.rgrad(W / 2, -H * 0.1, H * 0.9, [[0, 'rgba(255,251,230,1)'], [1, 'rgba(255,251,230,0)']]);
      for (let i = 0; i < 26; i++) P.clump(W * (i / 25), H * (0.92 + P.r() * 0.1), 10 + P.r() * 14, TONES.leafTeal, [0, -1]);
      [[0.04, 0.14], [0.96, 0.14]].forEach(([x, w]) => P.trunk(W * x, -5, H + 5, W * w * 0.5, W * w * 0.7, TONES.barkCool));
      for (let i = 0; i < 18; i++) { P.clump(P.r() * W * 0.22, P.r() * H * 0.3, 8 + P.r() * 10, TONES.leafA, [0.5, -1]); P.clump(W - P.r() * W * 0.22, P.r() * H * 0.3, 8 + P.r() * 10, TONES.leafA, [-0.5, -1]); }
      for (let i = 0; i < 10; i++) P.frond(P.r() * W, H + 4, 26 + P.r() * 20, -Math.PI / 2 + (P.r() - 0.5) * 1.6, TONES.leafB);
      for (let i = 0; i < 6; i++) P.frond(-4, H * (0.1 + i * 0.12), 30 + P.r() * 20, -0.3 + P.r() * 0.6, TONES.leafDeep);
      for (let i = 0; i < 6; i++) P.frond(W + 4, H * (0.1 + i * 0.12), 30 + P.r() * 20, Math.PI + 0.3 - P.r() * 0.6, TONES.leafDeep);
      finalize(c, W, H, { haze: 0.08, hazeColor: '#c6e4ec' });
      return PX;
    };
    setGrade(opts.grade || { mul: [1, 1, 1], sat: 1 });
    const PX = draw();
    if (opts.animals !== false) {
      const host = document.createElement('div'); host.className = 'critters'; document.body.appendChild(host);
      const add = (kind, w, css) => { const c = liveSprite(kind, w, PX); c.el.style.cssText = 'position:fixed;' + css; c.el.addEventListener('click', () => Motion.poke(c)); host.appendChild(c.el); return c; };
      add('monkey', 26, 'left:7%;top:-1%;');
      add('toucan', 24, 'right:5%;top:28%;');
      add('frog', 18, 'right:9%;bottom:3%;');
      Motion.start();
    }
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 250); });
  }

  /* =====================================================================
     NO DOUBLE-TAP ZOOM — iPhones zoom the page when you tap twice quickly,
     which wrecks fast-tapping games. CSS touch-action does most of the work;
     this catches what iOS still lets through. Pinch-to-zoom is left alone,
     and text boxes keep their normal double-tap (select a word).
     ===================================================================== */
  function noDoubleTapZoom() {
    if (noDoubleTapZoom.on) return; noDoubleTapZoom.on = true;
    const KEEP = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
    const ACT = 'button, a[href], label, summary, [role="button"], [data-tap], .critter';
    let last = 0, lx = 0, ly = 0;
    document.addEventListener('touchend', (e) => {
      if (e.touches.length || e.changedTouches.length !== 1) { last = 0; return; }       // pinches and multi-finger
      const t = e.changedTouches[0], now = e.timeStamp || performance.now();
      const quick = now - last < 400 && Math.abs(t.clientX - lx) < 48 && Math.abs(t.clientY - ly) < 48;
      last = now; lx = t.clientX; ly = t.clientY;
      if (!quick) return;
      const el = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
      if (!el || el.closest(KEEP)) return;
      e.preventDefault();                                   // stops the zoom (and the browser's own click)…
      const hit = el.closest(ACT);
      if (hit && !hit.disabled) hit.click();                // …so the tap still presses what it landed on
    }, { passive: false });
  }

  global.JungleKit = {
    A, SPECIES, rng, hash, esc, slugify, safeHref, safeImageSrc, iconHTML, animalIconURL, glyphIconURL, PLATFORMS, ICON_ANIMALS, ANIMAL_LABELS,
    Sprite, liveSprite, Painter, TONES, finalize, setGrade, Motion, DEFAULT_SITE, pageTemplate, decoratePage,
    Consent, store, Env, SITE_ROOT, RESERVED, pageSlug, fontLink, iconLinks, noDoubleTapZoom
  };
})(window);
