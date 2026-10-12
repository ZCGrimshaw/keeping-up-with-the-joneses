/* ===================== Art: the town of Hollowbrook, drawn in code ===================== */
const K = '#2a1f3d';
const GLASS = '#c4f0ff';
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
const sw = n => `stroke="${K}" stroke-width="${n}" stroke-linejoin="round" stroke-linecap="round"`;
const R = (x, y, w, h, f, rx = 0, s = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${sw(s)}/>`;
const Ci = (x, y, r, f, s = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${sw(s)}/>`;
const Pa = (d, f, s = 4) => `<path d="${d}" fill="${f}" ${sw(s)}/>`;
const Tx = (x, y, t, size, fill, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" class="svgdisp" ${extra}>${t}</text>`;
function signText(x, y, w, t, fill, max) { const fs = Math.min(max || 24, (w - 16) / (t.length * .62)); return Tx(x, y, esc(t), fs.toFixed(1), fill); }
function win(x, y, w, h, f) { return R(x, y, w, h, f || GLASS, 4, 3) + `<path d="M${x + 6} ${y + h - 6} L${x + w * .45} ${y + 6}" stroke="#fff" stroke-width="3" opacity=".85" stroke-linecap="round"/>`; }
function shadowE(w, h) { return `<ellipse cx="${w / 2}" cy="${h - 1}" rx="${w / 2 - 2}" ry="8" fill="#1d3a12" opacity=".18"/>`; }

const ART = {
  home: (w, h) => shadowE(w, h) + R(146, 16, 20, 34, '#b5523b', 2) +
    Pa('M2 66 L105 12 L208 66 Z', '#e0566b') + R(16, 62, 178, 96, '#ffd2dc', 4) +
    win(32, 80, 42, 32) + win(136, 80, 42, 32) +
    R(84, 100, 42, 58, '#7b4fd1', 6) + Ci(117, 130, 3, '#ffc93c', 2) +
    R(70, 34, 70, 22, '#fff', 8, 3) + Tx(105, 45.5, 'HOME', 14, K) +
    R(30, 114, 46, 8, '#7a4a2a', 2, 2) + Ci(40, 110, 4, '#ff6f59', 2) + Ci(53, 109, 4, '#ffc93c', 2) + Ci(66, 110, 4, '#ff6f59', 2),
  gulp: (w, h) => shadowE(w, h) + R(8, 50, 194, 108, '#fff3d9', 4) +
    R(16, 8, 178, 40, '#ff6f59', 10) + signText(105, 28, 178, 'GULP & GO', '#fff', 24) +
    Pa('M8 62 L202 62 L208 84 L2 84 Z', 'url(#stripeRed)') +
    R(20, 96, 84, 50, GLASS, 4, 3) + Tx(62, 112, 'SALE', 13, '#d6403a') + Tx(62, 130, '2 for $5', 11, K) +
    R(126, 96, 52, 62, '#18a99c', 4) + R(134, 104, 36, 28, GLASS, 3, 2),
  byte: (w, h) => shadowE(w, h) + `<line x1="152" y1="26" x2="152" y2="4" ${sw(3)}/>` + Ci(152, 6, 5, '#ff6f59', 2) +
    R(20, 26, 170, 132, '#a7ecf6', 6) +
    [62, 148].map(x => `<line x1="${x}" y1="76" x2="${x}" y2="158" ${sw(3)}/>`).join('') +
    `<line x1="20" y1="104" x2="190" y2="104" ${sw(3)}/>` +
    R(30, 34, 150, 36, K, 8, 3) + Pa('M48 40 L40 54 L47 54 L42 66 L56 50 L49 50 L54 40 Z', '#ffc93c', 2) + signText(116, 52, 120, 'BYTE ME', '#64f3ff', 22) +
    R(86, 112, 38, 46, '#e8fbff', 4, 3) + `<path d="M30 92 L52 80" stroke="#fff" stroke-width="4" opacity=".8" stroke-linecap="round"/>`,
  thread: (w, h) => {
    let sc = 'M14 54 H196 V66';
    for (let i = 0; i < 7; i++) sc += ` Q${196 - 13 - 26 * i} 80 ${196 - 26 * (i + 1)} 66`;
    return shadowE(w, h) + R(14, 48, 182, 110, '#efe1ff', 4) + R(6, 38, 198, 16, '#7b4fd1', 4) +
      R(30, 6, 150, 32, '#fff', 16, 3) + signText(105, 22, 150, 'THREADBARE', '#7b4fd1', 20) +
      Pa(sc + ' Z', '#b48cff', 3) + R(26, 86, 80, 60, GLASS, 4, 3) + Ci(66, 100, 7, '#ffe0c4', 2) +
      Pa('M56 110 L76 110 L82 140 L50 140 Z', '#ff6f59', 2) + R(126, 88, 48, 70, '#7b4fd1', 6) + Ci(166, 124, 3, '#ffc93c', 2);
  },
  college: (w, h) => shadowE(w, h) + `<line x1="190" y1="64" x2="190" y2="8" ${sw(3)}/>` + Pa('M190 10 L209 17 L190 25 Z', '#ff6f59', 2) +
    R(8, 140, 194, 18, '#e3d7c3', 3) + Pa('M10 64 L96 20 L182 64 Z', '#f7efe0') + Tx(96, 50, 'HC', 15, K) +
    R(14, 62, 182, 18, '#f7efe0', 2) + signText(105, 71.5, 182, 'HOLLOWBROOK', K, 13) +
    [24, 56, 136, 168].map(x => R(x, 80, 18, 60, '#fffaf1', 2, 3)).join('') +
    `<path d="M86 140 V108 A19 19 0 0 1 124 108 V140 Z" fill="#6b3e26" ${sw(3)}/>`,
  hub: (w, h) => shadowE(w, h) + R(10, 40, 112, 108, '#ffe08a', 4) + R(4, 6, 124, 34, '#18a99c', 8) + signText(66, 23, 124, 'HUSTLE HUB', '#fff', 18) +
    win(22, 50, 36, 26) + win(74, 50, 36, 26) + R(16, 86, 100, 18, '#fff', 4, 3) + Tx(66, 95.5, 'NOW HIRING', 11, '#d6403a') +
    R(48, 110, 36, 38, '#4a3f63', 4),
  bank: (w, h) => shadowE(w, h) + R(8, 136, 116, 12, '#e3d7c3', 3) + Pa('M4 52 L66 10 L128 52 Z', '#ffd56b') + Tx(66, 36, '$', 22, K) +
    R(8, 52, 116, 16, '#fff7e0', 2) + signText(66, 60.5, 116, 'BANK', K, 14) +
    [16, 44, 74, 102].map(x => R(x, 68, 14, 68, '#fffaf0', 2, 3)).join(''),
  mega: (w, h) => {
    let g = '';
    for (let y = 38; y < 112; y += 15) for (const x of [74, 92, 110, 128]) g += `<rect x="${x}" y="${y}" width="10" height="8" rx="1.5" fill="#dff1ff"/>`;
    for (let y = 74; y < 140; y += 16) for (const x of [24, 46, 148, 170]) g += `<rect x="${x}" y="${y}" width="14" height="8" rx="1.5" fill="#e7f3ff"/>`;
    return shadowE(w, h) + R(14, 62, 58, 86, '#a9c4ea', 4) + R(138, 62, 58, 86, '#a9c4ea', 4) + R(66, 2, 78, 146, '#7aa2d6', 4) + g +
      Ci(105, 18, 11, '#ffc93c', 3) + Tx(105, 18.5, 'M', 12, K) + R(68, 116, 74, 22, '#fff', 6, 3) + signText(105, 127, 74, 'MEGACORP', K, 12);
  },
  burger: (w, h) => shadowE(w, h) + R(12, 76, 186, 82, '#ffe2c2', 4) +
    R(44, 60, 122, 16, '#e49a45', 8, 3) + R(38, 50, 134, 12, '#7a3e1d', 6, 3) +
    Pa('M38 50 L48 44 L58 50 L68 44 L78 50 L88 44 L98 50 L108 44 L118 50 L128 44 L138 50 L148 44 L158 50 L168 44 L172 50', '#7bd35a', 3) +
    Pa('M42 46 Q105 -6 168 46 Z', '#f1b45a') +
    [[78, 28], [100, 22], [124, 26], [146, 36], [62, 38]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.4" fill="#fff8e6"/>`).join('') +
    R(24, 86, 162, 26, '#d6403a', 8, 3) + signText(105, 99, 162, 'BURGER BUNKER', '#fff', 16) +
    win(30, 120, 40, 28) + win(140, 120, 40, 28) + R(84, 118, 42, 40, '#ffc93c', 4, 3),
  gym: (w, h) => shadowE(w, h) + R(12, 50, 186, 108, '#c7f0df', 4) +
    R(54, 30, 102, 8, '#9a9fb8', 4, 3) + R(38, 16, 18, 36, '#4a3f63', 4, 3) + R(154, 16, 18, 36, '#4a3f63', 4, 3) +
    R(28, 60, 154, 28, K, 8, 3) + signText(105, 74, 154, 'SWOLE PATROL', '#ffc93c', 17) +
    win(26, 100, 52, 36) + win(132, 100, 52, 36) + R(88, 102, 34, 56, '#ff6f59', 4),
  grind: (w, h) => shadowE(w, h) + R(16, 58, 178, 100, '#f2d2b1', 4) +
    `<g class="steam" fill="none" ${sw(3)}><path d="M92 14 q-6 -5 0 -10"/><path d="M106 14 q-6 -5 0 -10"/><path d="M120 14 q-6 -5 0 -10"/></g>` +
    Pa('M136 26 Q156 28 134 46', 'none', 4) + Pa('M72 18 L140 18 L132 56 L80 56 Z', '#fff') + `<ellipse cx="106" cy="20" rx="30" ry="3" fill="#6b3e26"/>` +
    R(30, 64, 150, 26, '#6b3e26', 8, 3) + signText(105, 77, 150, 'DAILY GRIND', '#fff1dc', 17) +
    Pa('M16 96 H194 L200 110 H10 Z', 'url(#stripeBrown)', 3) + win(28, 118, 56, 32) + R(128, 114, 40, 44, '#18a99c', 4),
  fun: (w, h) => {
    let b = '';
    for (let x = 28; x <= 182; x += 14) b += `<circle class="bulb" cx="${x}" cy="7" r="3.2" fill="#fff" ${sw(1.5)}/><circle class="bulb b2" cx="${x}" cy="45" r="3.2" fill="#fff" ${sw(1.5)}/>`;
    return shadowE(w, h) + R(10, 42, 190, 116, '#5b2fa8', 4) + R(20, 8, 170, 38, '#ffc93c', 10) + signText(105, 27, 170, 'FUNPLEX', K, 24) + b +
      Pa('M170 66 q-9 10 -5 22 q-9 14 -2 48 h14 q7 -34 -2 -48 q4 -12 -5 -22 z', '#fff', 3) + `<rect x="164" y="90" width="12" height="5" fill="#ff6f59"/>` +
      R(40, 100, 64, 58, '#ff6f59', 6) + `<line x1="72" y1="100" x2="72" y2="158" ${sw(3)}/>` +
      R(26, 60, 92, 26, '#2a1f3d', 6, 3) + Tx(72, 73, 'OPEN LATE', 12, '#ff9de6');
  },
  clinic: (w, h) => shadowE(w, h) + R(10, 30, 112, 118, '#ffffff', 4) + R(4, 20, 124, 16, '#18a99c', 4) +
    Pa('M56 44 h20 v14 h14 v20 h-14 v14 h-20 v-14 h-14 v-20 h14 z', '#ff6f59', 3) +
    win(16, 50, 22, 24) + win(94, 50, 22, 24) + signText(66, 104, 112, 'CLINIC', '#18a99c', 18) + R(46, 116, 40, 32, GLASS, 4, 3),
  realty: (w, h) => shadowE(w, h) + Pa('M86 32 Q98 8 106 4 Q102 24 110 46 Z', '#8a8fa8', 3) +
    Pa('M2 62 L66 14 L130 62 Z', '#4b9fd8') + R(14, 60, 104, 88, '#eaf6ff', 4) +
    R(26, 70, 80, 22, '#fff', 6, 3) + signText(66, 81, 80, 'REALTY', '#1a6fb0', 15) +
    win(20, 104, 24, 22) + win(88, 104, 24, 22) + R(52, 104, 28, 44, '#ff6f59', 4),
};

function tree(x, y, s) {
  s = s || 1;
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-6" width="10" height="22" rx="3" fill="#8a5a3c" ${sw(3)}/>` +
    `<circle cx="-12" cy="-16" r="16" fill="#4fb548" ${sw(3)}/><circle cx="12" cy="-18" r="16" fill="#46a840" ${sw(3)}/><circle cx="0" cy="-30" r="17" fill="#5cc451" ${sw(3)}/></g>`;
}
function parkSVG() { return ''; }
function townSVG(interactive) {
  let s = `<defs>
    <pattern id="stripeRed" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="24" fill="#ff6f59"/><rect x="12" width="12" height="24" fill="#fff"/></pattern>
    <pattern id="stripeBrown" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="20" fill="#8a5a3c"/><rect x="10" width="10" height="20" fill="#f5e6d3"/></pattern>
    <pattern id="grassDots" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="10" cy="14" r="2" fill="#7cc35a"/><circle cx="40" cy="42" r="2" fill="#7cc35a"/><circle cx="48" cy="10" r="1.6" fill="#a7e88a"/></pattern>
  </defs>`;
  s += `<rect width="1600" height="900" fill="#8fd46a"/><image href="assets/scr/bg_map.webp" width="1600" height="900" preserveAspectRatio="xMidYMid slice"/>`;
  s += `<rect x="175" y="215" width="1250" height="490" rx="36" fill="none" stroke="#efe7d6" stroke-width="96"/>`;
  s += `<rect x="127" y="167" width="1346" height="586" rx="72" fill="none" ${sw(4)}/><rect x="223" y="263" width="1154" height="394" rx="6" fill="none" ${sw(4)}/>`;
  s += `<rect x="175" y="215" width="1250" height="490" rx="36" fill="none" stroke="#5d6280" stroke-width="64"/>`;
  s += `<rect x="175" y="215" width="1250" height="490" rx="36" fill="none" stroke="#ffd44d" stroke-width="3" stroke-dasharray="18 16"/>`;
  s += parkSVG();
  LOCS.forEach((l, i) => {
    s += `<circle cx="${l.door.x}" cy="${l.door.y}" r="9" fill="#fff" ${sw(2.5)} opacity=".9"/>`;
  });
  s += `<g id="route"></g>`;
  LOCS.forEach((l, i) => {
    const b = l.box;
    s += `<g class="bld${interactive ? ' live' : ''}" data-i="${i}" transform="translate(${b.x} ${b.y})" ${interactive ? `tabindex="0" role="button" aria-label="${esc(l.name)}"` : ''}>` +
      `<g class="art"><ellipse cx="${b.w / 2}" cy="${b.h - 3}" rx="${b.w / 2 - 6}" ry="7" fill="#1d3a12" opacity=".2"/>` +
      `<image ${l.id === 'home' ? 'id="home-img" ' : ''}href="${bldSrc(l.id)}" width="${b.w}" height="${b.h}" preserveAspectRatio="xMidYMax meet"/>` +
      (l.id === 'home' ? `<g id="home-sold" visibility="hidden" transform="translate(${b.w - 22} ${b.h - 78})"><image href="assets/bld/sign_sold.webp" width="76" height="76"/><text x="44" y="41" font-size="13" text-anchor="middle" class="svgdisp" fill="#c7392f">OWNED</text></g>` : '') + `</g>` +
      `<rect width="${b.w}" height="${b.h}" fill="transparent"/></g>`;
  });
  if (interactive) s += `<g class="labels" pointer-events="none">${LOCS.map(l => bldLabel(l)).join('')}</g>`;
  s += `<rect id="dusk" width="1600" height="900" fill="#2b1d6b" opacity="0" pointer-events="none"/>`;
  s += `<g id="tokens"></g>`;
  return s;
}
const HAIRS = [
  c => `<path d="M-15 -56 Q-14 -72 0 -71 Q14 -72 15 -56 Q8 -64 0 -62 Q-8 -64 -15 -56Z" fill="${c}" ${sw(3)}/>`,
  c => `<path d="M-16 -52 Q-18 -74 0 -72 Q18 -74 16 -52 L17 -36 Q12 -42 11 -58 Q0 -64 -11 -58 Q-12 -42 -17 -36Z" fill="${c}" ${sw(3)}/>`,
  c => `<circle cx="0" cy="-73" r="7" fill="${c}" ${sw(3)}/><path d="M-14 -56 Q-12 -70 0 -69 Q12 -70 14 -56 Q0 -62 -14 -56Z" fill="${c}" ${sw(3)}/>`,
  c => `<path d="M-15 -57 L-13 -72 L-6 -65 L0 -77 L6 -65 L13 -72 L15 -57 Q0 -63 -15 -57Z" fill="${c}" ${sw(3)}/>`,
];
function charSVG(p, opts) {
  opts = opts || {};
  const mood = (p.happiness ?? 50) < 35 ? -1 : 1;
  const sick = p.sick;
  return `${opts.noShadow ? '' : '<ellipse cx="0" cy="0" rx="15" ry="5" fill="#000" opacity=".22"/>'}
  <g class="bob">
    <rect x="-10" y="-16" width="8" height="16" rx="3" fill="${K}"/><rect x="2" y="-16" width="8" height="16" rx="3" fill="${K}"/>
    <rect x="-15" y="-42" width="30" height="30" rx="12" fill="${p.color}" ${sw(3)}/>
    <circle cx="0" cy="-55" r="14" fill="${sick ? '#cfe8b8' : p.skin}" ${sw(3)}/>
    ${HAIRS[p.hair % HAIRS.length](p.hairColor)}
    <circle cx="-5" cy="-55" r="2.3" fill="${K}"/><circle cx="5" cy="-55" r="2.3" fill="${K}"/>
    <path d="${mood > 0 ? 'M-5 -49 Q0 -44 5 -49' : 'M-5 -46 Q0 -50 5 -46'}" fill="none" ${sw(2.5)}/>
  </g>`;
}
const JONES_IMG = { grinder:'jones_jordan', partier:'jones_jackie', investor:'jones_jasper', scholar:'jones_juniper' };
const HOME_IMG = { rust:'home_rust', maple:'home_maple', loft:'home_loft', pent:'home_pent', house:'home_house', craftsman:'home_craftsman' };
// Painted art for a player: CPUs use their Jones; humans borrow a male figure not already in the game (stand-in until player avatars exist).
function avatarId(p) {
  if (p.avatar) return p.avatar;
  if (p.persona && JONES_IMG[p.persona]) return JONES_IMG[p.persona];
  if (p.kind !== 'human' || typeof G === 'undefined' || !G || !G.players.includes(p)) return null;
  const used = G.players.filter(q => q.persona).map(q => JONES_IMG[q.persona]);
  const free = ['jones_jasper', 'jones_jordan'].filter(id => !used.includes(id));
  const humans = G.players.filter(q => q.kind === 'human');
  return free.length ? free[humans.indexOf(p) % free.length] : null;
}
function bldSrc(id, housing) {
  if (id === 'home') return `assets/bld/${HOME_IMG[housing || 'rust']}.webp`;
  return `assets/bld/${id === 'burger' ? 'bld_burger_clean' : 'bld_' + id}.webp`;
}
function bldLabel(l) {
  const b = l.box, name = l.id === 'home' ? 'Home' : l.name.replace(/^The /, '');
  const x = b.x + b.w / 2, y = l.labelY;
  const w = Math.round(name.length * 7.4 + 22);
  return `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="#fffdf8" ${sw(2.5)}/>` +
    `<text y="1" font-size="12.5" font-weight="700" fill="${K}" text-anchor="middle" dominant-baseline="central" class="svgbody">${esc(name)}</text></g>`;
}
function portrait(p, size) {
  const av = avatarId(p);
  if (av) return `<span class="pimg" style="width:${size}px;height:${size}px;border-color:${p.color}"><img src="assets/jones/${av}.webp" alt=""></span>`;
  return `<svg class="portrait" viewBox="-24 -84 48 54" width="${size}" height="${Math.round(size * 54 / 48)}" aria-hidden="true">` +
    `<circle cx="0" cy="-57" r="23" fill="${p.color}" opacity=".18"/>${charSVG(p, { noShadow:true })}</svg>`;
}
function buildingThumb(i) {
  const b = LOCS[i].box;
  return `<svg class="thumb" viewBox="-6 -6 ${b.w + 12} ${b.h + 12}" aria-hidden="true">${townDefsMini()}${ART[LOCS[i].id](b.w, b.h)}</svg>`;
}
function townDefsMini() {
  return `<defs><pattern id="stripeRed" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="24" fill="#ff6f59"/><rect x="12" width="12" height="24" fill="#fff"/></pattern>
  <pattern id="stripeBrown" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="20" fill="#8a5a3c"/><rect x="10" width="10" height="20" fill="#f5e6d3"/></pattern></defs>`;
}
