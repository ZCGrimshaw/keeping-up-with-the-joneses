/* ===================== UI ===================== */
const SPEEDS = { slow:{ label:'Slow', step:420, bub:1500 }, normal:{ label:'Normal', step:230, bub:900 }, fast:{ label:'Fast', step:110, bub:420 }, instant:{ label:'Instant', step:0, bub:0 } };
const COLORS = ['#ff6f59', '#18a99c', '#8a5cf6', '#f2a900', '#1a8fd6', '#e0559c'];
const SKINS = ['#ffdcbf', '#f1c27d', '#d39a5c', '#a86b3c', '#7a4a2a'];
const HAIRC = ['#2a1f3d', '#6b3e26', '#c9762d', '#e8c25a', '#9c9aa6', '#d64a7a'];
const PREFS_KEY = 'kuwtj-prefs-v1';
const NPCS = {
  gulp:['Gus', 'night cashier', 'Scratch-offs are by the register. Hope is extra.'],
  byte:['Pixel', 'tech sales', 'You NEED this. Trust me. I work on commission.'],
  thread:['Madame Hem', 'tailor', 'Dress for the job you want, darling. Not the one you have.'],
  college:['Dean Bookbinder', 'registrar', 'Knowledge is priceless. Tuition is not.'],
  hub:['Rhonda', 'recruiter', 'Take a number. Any number. They all wait the same.'],
  bank:['Mr. Penniworth', 'branch banker', 'Your money is safe with us. Mostly from you.'],
  mega:['Brad from HR', 'people & culture', "Let's circle back and synergize, champ."],
  burger:['Patty', 'shift manager', 'Welcome to Burger Bunker! Mega Feast is a choice.'],
  gym:['Coach Flex', 'trainer', 'ONE MORE REP. Then one more after that.'],
  grind:['Moss', 'barista', 'Gig board is by the plants. Oat milk is extra.'],
  fun:['DJ Strike', 'host', 'Lanes are open and the mic is hot.'],
  clinic:['Dr. Goodvibes', 'physician', 'Deep breath. Now tell me about your stress.'],
  realty:['Sheldon Shark', 'realtor', 'Cozy means small. Charming means old. Sign here!'],
  casino:['Vinnie Velvet', 'pit boss', 'Feeling lucky? The house is feeling luckier.'],
};
const ART_MISSING = new Set();   // placeholders until the art arrives
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let busy = false, cpuSkip = false, modalState = null, openLoc = -1, walking = new Set(), routeTo = -1;
let prefs = { seenHelp:false, speed:'normal', hints:true, jobFilter:false };
let setup = null;

function loadPrefs() { try { const s = localStorage.getItem(PREFS_KEY); if (s) Object.assign(prefs, JSON.parse(s)); } catch (e) {} }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }
function save() { if (typeof ONLINE !== 'undefined' && ONLINE) { onlineSave(); return; } try { if (G) localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
const cur = () => G.players[G.turn];
const speed = () => (cpuSkip && cur() && cur().kind === 'cpu') ? SPEEDS.instant : SPEEDS[G.settings.speed] || SPEEDS.normal;
const humans = () => G.players.filter(p => p.kind === 'human');
const you = s => s.replace(/^\{n\}/, 'You').replace(/\{n\}/g, 'you');
const named = (p, s) => s.replace(/\{n\}/g, p.name);
function signed(n, money) { const r = Math.round(n); return (r > 0 ? '+' : r < 0 ? '−' : '±') + (money ? '$' + Math.abs(r).toLocaleString('en-US') : Math.abs(r)); }

function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; if (id !== 'game') { $('#needs').hidden = true; document.body.classList.remove('has-needs'); } window.scrollTo(0, 0); }
function toast(msg, kind) {
  const box = $('#toasts'); const t = document.createElement('div');
  t.className = 'toast ' + (kind || ''); t.textContent = msg; box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 2800);
}

/* ---------- modal ---------- */
function openModal(html, opts) {
  modalState = opts || {};
  const m = $('#modal');
  m.innerHTML = `<div class="modal-card ${modalState.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(modalState.label || 'Dialog')}">${html}</div>`;
  m.hidden = false;
  const f = m.querySelector('[data-autofocus]') || m.querySelector('button:not(:disabled)');
  f && f.focus({ preventScroll:true });
}
function closeModal(force) {
  if (!force && modalState && modalState.locked) return;
  $('#modal').hidden = true; $('#modal').innerHTML = ''; openLoc = -1;
  const cb = modalState && modalState.onClose; modalState = null;
  cb && cb();
}

/* ---------- title ---------- */
function showTitle() {
  show('title');
  $('#title-art').innerHTML = '<img src="assets/scr/bg_title.webp" alt="">';
  const s = readSave();
  const ok = s && s.players && !s.over;
  $('#btn-continue').hidden = !ok;
  $('#btn-online').hidden = !NET_BE;
  $('#save-note').textContent = ok ? `Saved game: week ${s.week}, ${s.players.map(p => p.name).join(', ')}` : '';
}

/* ---------- setup ---------- */
/* Playable characters: the painted cast. Each seat takes one; picking a taken one swaps the two seats. */
const CHARS = [
  { id:'jones_jasper',  first:'Jasper' },
  { id:'jones_jordan',  first:'Jordan' },
  { id:'jones_juniper', first:'Juniper' },
  { id:'jones_jackie',  first:'Jackie' },
];
const charOf = s => CHARS.find(c => c.id === s.avatar) || CHARS[0];
function defaultSetup(online) {
  const seat = (kind, avatar, persona, color, extra) => Object.assign({ kind, avatar, persona, color, name:'', trait:'hustler', diff:'normal' }, extra || {});
  return {
    slots: [
      seat('human', 'jones_jasper', 'investor', COLORS[0], { name:'You' }),
      seat(online ? 'invite' : 'cpu', 'jones_jordan', 'grinder', COLORS[1]),
      seat('cpu', 'jones_juniper', 'scholar', COLORS[2]),
      seat('off', 'jones_jackie', 'partier', COLORS[3]),
    ],
    goals:{ wealth:50, happiness:50, education:50, career:50 }, health:false, healthGoal:50, limit:0, online:!!online, timer:0,
  };
}
function slotPreview(s) { return { avatar:s.avatar, color:s.color, happiness:60 }; }
function slotName(s) {
  if (s.kind === 'human') return (s.name || '').trim() || charOf(s).first;
  return `${charOf(s).first} Jones`;
}
function renderSetup() {
  $('#slots').innerHTML = setup.slots.map((s, i) => {
    const on = s.kind !== 'off', ch = charOf(s), locked = !!(setup.online && i > 0 && s.uid);
    const kinds = setup.online ? (i === 0 || locked ? [] : ['invite', 'cpu', 'off']) : ['human', 'cpu', 'off'];
    const seg = kinds.map(k => `<button data-slot="${i}" data-kind="${k}" aria-pressed="${s.kind === k}">${{ human:'Human', invite:'Friend', cpu:'CPU', off:'Empty' }[k]}</button>`).join('');
    const picks = CHARS.map(c => {
      const other = setup.slots.findIndex((x, j) => j !== i && x.avatar === c.id);
      const taken = other >= 0 && setup.slots[other].kind !== 'off';
      const blocked = locked || (other >= 0 && setup.online && other > 0 && !!setup.slots[other].uid);
      return `<button class="pick ${c.id === s.avatar ? 'sel' : ''}" data-slot="${i}" data-avatar="${c.id}" aria-pressed="${c.id === s.avatar}" ${blocked ? 'disabled' : ''} title="${c.first}${blocked && c.id !== s.avatar ? ' (taken by a friend who joined)' : taken ? ` (swap with seat ${other + 1})` : ''}">` +
        `<img src="assets/jones/${c.id}.webp" alt="${c.first}">${taken ? `<span class="pick-seat">${other + 1}</span>` : ''}</button>`;
    }).join('');
    const sw = COLORS.map(c => `<button data-slot="${i}" data-color="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${s.color === c}"></button>`).join('');
    let body = '';
    if (s.kind === 'human') {
      body = `<label>Name<input type="text" id="name-${i}" data-slot="${i}" data-field="name" value="${esc(s.name)}" placeholder="${ch.first}" maxlength="16"></label>
        <label>Trait<select id="trait-${i}" data-slot="${i}" data-field="trait">${Object.entries(TRAITS).map(([k, t]) => `<option value="${k}" ${s.trait === k ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
        <div class="desc">${esc(TRAITS[s.trait].desc)}</div>`;
    } else if (s.kind === 'cpu') {
      body = `<label>Personality<select id="persona-${i}" data-slot="${i}" data-field="persona">${Object.entries(PERSONAS).map(([k, t]) => `<option value="${k}" ${s.persona === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
        <div class="desc">${esc(PERSONAS[s.persona].blurb)} Trait: ${TRAITS[PERSONAS[s.persona].trait].name}.</div>
        <div class="fieldlabel">Difficulty</div><div class="seg" role="group" aria-label="Difficulty">${Object.entries(DIFFS).map(([k, d]) => `<button data-slot="${i}" data-diff="${k}" aria-pressed="${s.diff === k}">${d.label}</button>`).join('')}</div>`;
    } else if (locked) {
      body = `<div class="desc"><b>${esc(s.name || 'A friend')}</b> has joined this seat${s.trait ? ` as a ${esc(TRAITS[s.trait]?.name || '')}` : ''}. Their seat can't be changed.</div>`;
    } else if (s.kind === 'invite') {
      body = `<div class="desc">A friend takes this seat with your invite code and picks their own name and trait. If nobody joins, a CPU plays it.</div>`;
    } else body = `<div class="desc">This seat is empty. Pick ${setup.online ? 'Friend' : 'Human'} or CPU to add another player.</div>`;
    return `<div class="card slot ${on ? '' : 'off'}" style="--pc:${s.color}">
      <div class="stage">
        <img class="figure" src="assets/tok/${s.avatar}.webp" alt="">
        <div class="stage-tag"><span class="eyebrow">Seat ${i + 1}${on ? ` · ${s.kind === 'cpu' ? 'CPU' : s.kind === 'invite' ? 'Friend' : setup.online ? 'You · Host' : 'Human'}` : ''}</span><b>${esc(!on ? 'Empty seat' : s.kind === 'invite' ? (s.uid ? s.name || 'Friend' : 'Open seat') : slotName(s))}</b></div>
      </div>
      ${seg ? `<div class="seg kind" role="group" aria-label="Seat ${i + 1} player type">${seg}</div>` : ''}
      ${on ? `<div class="fieldlabel">Character</div><div class="picks" role="group" aria-label="Character">${picks}</div>` : ''}
      ${body}
      ${on && !locked ? `<div class="fieldlabel">Color</div><div class="swatches" role="group" aria-label="Color">${sw}</div>` : ''}
    </div>`;
  }).join('');
  const gs = goalKeysSetup().map(k => {
    const v = k === 'health' ? setup.healthGoal : setup.goals[k];
    const out = k === 'wealth' ? fmt$(v * WEALTH_UNIT) : v;
    return `<div class="gs"><b style="color:${GOAL_META[k].color}">${GOAL_META[k].label}</b><input type="range" id="goal-${k}" min="10" max="100" step="5" value="${v}" data-goal="${k}" aria-label="${GOAL_META[k].label} goal"><output>${out}</output></div>`;
  }).join('');
  $('#goal-sliders').innerHTML = gs + `<label class="check"><input type="checkbox" id="opt-health" ${setup.health ? 'checked' : ''}> Add a Health goal</label>
    <p style="margin:0;font-size:.82rem;color:var(--ink-2)">Wealth is net worth: cash, savings, stocks and home equity, minus debt. Education comes from degrees and certificates. Career comes from your job's prestige and time on the job.</p>`;
  for (const b of document.querySelectorAll('#presets button')) b.setAttribute('aria-pressed', ['wealth', 'happiness', 'education', 'career'].every(k => setup.goals[k] == b.dataset.preset));
  $('#opt-limit').value = String(setup.limit);
  $('#opt-speed').innerHTML = Object.entries(SPEEDS).map(([k, s]) => `<button data-speed="${k}" aria-pressed="${prefs.speed === k}">${s.label}</button>`).join('');
  $('#opt-hints').checked = prefs.hints;
  $('#btn-start').disabled = !setup.slots.some(s => s.kind !== 'off');
  $('#btn-start').textContent = setup.editing ? 'Save changes' : setup.online ? 'Create game and get invite code' : 'Move to town';
  $('#setup h1').textContent = setup.editing ? 'Change the game' : setup.online ? 'Set up your online game' : "Who's moving to Hollowbrook?";
  $('#opt-timer-row').hidden = !setup.online; $('#opt-timer').value = String(setup.timer || 0);
  $('#opt-share-row').hidden = !!setup.online;
}
function goalKeysSetup() { return ['wealth', 'happiness', 'education', 'career'].concat(setup.health ? ['health'] : []); }
function bindSetup() {
  const root = $('#setup');
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = b.dataset.slot !== undefined ? +b.dataset.slot : -1;
    if (b.dataset.kind) {
      const s = setup.slots[i]; s.kind = b.dataset.kind;
      if (s.kind !== 'off') {   // joining seats keep a unique character and color
        const clash = setup.slots.find((x, j) => j !== i && x.kind !== 'off' && x.avatar === s.avatar);
        if (clash) { const free = CHARS.find(c => !setup.slots.some((x, j) => j !== i && x.kind !== 'off' && x.avatar === c.id)); if (free) { const k = setup.slots.findIndex((x, j) => j !== i && x.avatar === free.id); if (k >= 0 && !setup.slots[k].uid) setup.slots[k].avatar = s.avatar; s.avatar = free.id; } }
        if (setup.slots.some((x, j) => j !== i && x.kind !== 'off' && x.color === s.color)) s.color = COLORS.find(c => !setup.slots.some((x, j) => j !== i && x.kind !== 'off' && x.color === c)) || s.color;
      }
      renderSetup();
    }
    else if (b.dataset.avatar) {
      const s = setup.slots[i], other = setup.slots.find((x, j) => j !== i && x.avatar === b.dataset.avatar);
      if ((other && other.uid && setup.slots.indexOf(other) > 0) || (s.uid && i > 0)) return;
      if (other) other.avatar = s.avatar;
      s.avatar = b.dataset.avatar; renderSetup();
    }
    else if (b.dataset.color) { setup.slots[i].color = b.dataset.color; renderSetup(); }
    else if (b.dataset.diff) { setup.slots[i].diff = b.dataset.diff; renderSetup(); }
    else if (b.dataset.preset) { for (const k of ['wealth', 'happiness', 'education', 'career']) setup.goals[k] = +b.dataset.preset; setup.healthGoal = +b.dataset.preset; renderSetup(); }
    else if (b.dataset.speed) { prefs.speed = b.dataset.speed; savePrefs(); renderSetup(); }
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.goal) {
      const k = t.dataset.goal; if (k === 'health') setup.healthGoal = +t.value; else setup.goals[k] = +t.value;
      t.nextElementSibling.textContent = k === 'wealth' ? fmt$(t.value * WEALTH_UNIT) : t.value;
      for (const b of document.querySelectorAll('#presets button')) b.setAttribute('aria-pressed', ['wealth', 'happiness', 'education', 'career'].every(k2 => setup.goals[k2] == b.dataset.preset));
    } else if (t.dataset.field === 'name') { const s = setup.slots[+t.dataset.slot]; s.name = t.value; t.closest('.slot').querySelector('.stage-tag b').textContent = slotName(s); }
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.field === 'trait' || t.dataset.field === 'persona') { setup.slots[+t.dataset.slot][t.dataset.field] = t.value; renderSetup(); }
    else if (t.id === 'opt-health') { setup.health = t.checked; renderSetup(); }
    else if (t.id === 'opt-limit') setup.limit = +t.value;
    else if (t.id === 'opt-timer') setup.timer = +t.value;
    else if (t.id === 'opt-hints') { prefs.hints = t.checked; savePrefs(); }
  });
  $('#btn-setup-back').onclick = () => setup && setup.editing ? backToLobby() : setup && setup.online ? showOnlineHub() : showTitle();
  $('#btn-start').onclick = startNewGame;
}
function startNewGame() {
  if (setup.editing) { saveLobbyEdits(); return; }
  if (setup.online) { createOnline(); return; }
  const players = setup.slots.map((s, i) => ({ s, i })).filter(x => x.s.kind !== 'off').map(({ s, i }) => ({
    kind:s.kind, name:slotName(s) || `Player ${i + 1}`, trait:s.trait, persona:s.persona, diff:s.diff,
    color:s.color, avatar:s.avatar, skin:SKINS[0], hair:0, hairColor:HAIRC[0],
  }));
  if (!players.length) return;
  const goals = Object.assign({}, setup.goals, { health: setup.health ? setup.healthGoal : 0 });
  newGame({ players, goals, weekLimit:setup.limit, settings:{ speed:prefs.speed, hints:prefs.hints } });
  for (const p of G.players) addLog(p, `${p.name} moved into ${HOUSING.rust.name}.`);
  save();
  enterGame();
  startTurn();
}

/* ---------- game screen ---------- */
function enterGame() {
  show('game');
  $('#title-art').innerHTML = '';
  $('#map').innerHTML = townSVG(true);
  bindMap();
  renderAll();
}
function renderAll() { if (!G) return; renderHUD(); renderSide(); renderTokens(); renderBillboard(); renderDusk(); renderNeeds(); }
/* Everything the current player could fix right now, most urgent first. level: urgent | warn | goal */
function needsFor(p) {
  const n = [], add = (level, icon, title, detail, loc) => n.push({ level, icon, title, detail, loc });
  const j = p.job && JOB[p.job], ct = clothesTier(p), liquid = p.cash + p.bank;
  if (p.sick) add('urgent', '🤒', 'Sick', 'You lose 15 hours a week until you get a checkup.', 'clinic');
  if (!p.fed && p.groceries <= 0) add('urgent', '🍔', 'Hungry', "Eat this week or lose 12 health. Grab a combo meal or groceries.", 'burger');
  if (p.dressWarn && j) add('urgent', '👔', 'Dress code warning', `Buy ${CLOTHES[j.clothes].name.toLowerCase()} clothes this week or get fired.`, 'thread');
  if (!isOwner(p) && p.rentDueIn <= 1 && liquid < p.rent) add('urgent', '🏠', 'Rent due, short on cash', `${fmt$(p.rent)} is due at the end of this week. You have ${fmt$(liquid)}.`, 'bank');
  if (p.health < 30) add('urgent', '❤️', 'Health is low', `Health ${Math.round(p.health)}. Work out, eat, and see the clinic.`, 'gym');
  if (p.stress > 65) add('urgent', '😵', 'Stressed out', `Stress ${Math.round(p.stress)}. Over 70 hurts health and happiness. Try yoga, therapy or a nap.`, 'gym');
  else if (p.stress > 45) add('warn', '😬', 'Stress building', `Stress ${Math.round(p.stress)}. Some downtime would help.`, 'fun');
  if (!j) add('warn', '💼', 'No job', 'The Hustle Hub lists every opening in town.', 'hub');
  if (ct === 0) add('warn', '👕', 'Ratty clothes', 'Most jobs need at least casual clothes.', 'thread');
  else if ((p.clothes[ct] || 0) <= 2) add('warn', '👕', 'Clothes wearing out', `${p.clothes[ct]} week${p.clothes[ct] === 1 ? '' : 's'} left on your ${CLOTHES[ct].name.toLowerCase()} outfit.`, 'thread');
  if (!p.fed && p.groceries === 1) add('warn', '🥫', 'Last week of groceries', 'Restock at Gulp & Go soon.', 'gulp');
  if (p.cash > 300 && HOUSING[p.housing].risk > .1) add('warn', '🦝', 'Cash at risk', `${fmt$(p.cash)} in your wallet. Rustbucket gets burgled; bank it.`, 'bank');
  if (p.loan > 0) add('warn', '💸', 'Loan growing', `${fmt$(p.loan)} at 1% a week.`, 'bank');
  if (p.happiness < 35) add('warn', '😞', 'Feeling down', `Happiness ${Math.round(p.happiness)}. Have some fun.`, 'fun');
  if (p.course) add('goal', '📚', 'Course in progress', `${DEG[p.course.id].name}: ${p.course.prog}/${DEG[p.course.id].sessions} classes.`, p.items.laptop ? 'home' : 'college');
  const s = scores(p);
  for (const k of goalKeys()) if (s[k] < G.goals[k]) {
    const meta = { wealth:['💰', 'Wealth', 'bank'], happiness:['😊', 'Happiness', 'fun'], education:['🎓', 'Education', 'college'], career:['📈', 'Career', 'hub'], health:['💪', 'Health', 'gym'] }[k];
    const have = k === 'wealth' ? fmt$(netWorth(p)) : Math.floor(s[k]), need = k === 'wealth' ? fmt$(G.goals.wealth * WEALTH_UNIT) : G.goals[k];
    add('goal', meta[0], `${meta[1]} goal`, `${have} of ${need}.`, k === 'wealth' && j ? j.loc : meta[2]);
  }
  return n;
}
function renderNeeds() {
  const bar = $('#needs'); if (!bar) return;
  const p = cur();
  if (!p || p.kind !== 'human' || G.over || !isMine(p)) { bar.hidden = true; document.body.classList.remove('has-needs'); return; }
  const list = needsFor(p);
  bar.hidden = false; document.body.classList.add('has-needs');
  const urgent = list.filter(x => x.level === 'urgent').length;
  bar.innerHTML = `<span class="needs-h">${urgent ? `<b>${urgent}</b> need${urgent > 1 ? '' : 's'} attention` : 'All good'}</span>` +
    `<div class="needs-list">${list.length ? list.map(x => `<button class="need ${x.level}" data-need-loc="${x.loc}" title="${esc(x.detail)} Click to go to ${esc(LOCS[LI[x.loc]].name)}.">` +
      `<span class="ni" aria-hidden="true">${x.icon}</span><span class="nt"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span></button>`).join('') : '<span class="need ok"><span class="nt"><b>Nothing urgent.</b><small>Every goal is met. Finish the week to win!</small></span></span>'}</div>`;
}
function econLabel() { const e = G.econ; return e > 1.08 ? 'Prices high' : e < .94 ? 'Prices low' : 'Prices normal'; }
function renderHUD() {
  $('#hud-week').textContent = G.week + (G.weekLimit ? `/${G.weekLimit}` : '');
  $('#hud-econ').textContent = `${econLabel()} · ${Math.round(G.econ * 100)}%`;
  $('#hud-econ').title = 'Economy index: affects prices, wages and rent at signing.';
  $('#hud-players').innerHTML = G.players.map((p, i) => {
    const pc = Math.round(progress(p) * 100);
    return `<button class="pchip ${i === G.turn ? 'cur' : ''}" data-pid="${i}" style="--pc:${p.color}" title="${esc(p.name)}: ${pc}% of goals">
      <span class="ring" style="--p:${pc}"><span>${pc}</span></span><span class="nm">${esc(p.name)}</span></button>`;
  }).join('');
  $('#speed-line').textContent = `Speed: ${SPEEDS[G.settings.speed].label}`;
}
function goalRow(p, k, s) {
  const t = G.goals[k], v = s[k], met = v >= t, w = Math.min(100, v / t * 100);
  const val = k === 'wealth' ? `${fmt$(netWorth(p))} / ${fmt$(t * WEALTH_UNIT)}` : `${Math.floor(v)} / ${t}`;
  return `<div class="grow ${met ? 'met' : ''}"><span class="lbl">${GOAL_META[k].label}</span><span class="gbar" style="--gc:${GOAL_META[k].color}"><i style="width:${w}%"></i></span><span class="val">${val}</span></div>`;
}
function vitalRow(label, v, color, invert) {
  return `<div class="vrow"><b>${label}</b><span class="gbar" style="--gc:${color}"><i style="width:${Math.round(v)}%"></i></span><output>${Math.round(v)}</output></div>`;
}
function lifeRows(p) {
  const rows = [];
  const j = p.job && JOB[p.job];
  rows.push(['Job', j ? `${j.title} · ${fmt$(wageOf(p, j))}/h <span class="chip note">${LOCS[LI[j.loc]].name}</span>` : '<span class="warn">Unemployed</span>']);
  const ups = Object.keys(p.upgrades || {}).filter(k => hasUpg(p, k));
  rows.push(['Home', isOwner(p) ? `${HOUSING[p.housing].name} · mortgage ${fmt$(p.mortgage)}${ups.length ? `<span class="upg-mini">${ups.map(k => `<img src="assets/upg/upg_${k}.webp" alt="${esc(UPGRADES[k].name)}" title="${esc(UPGRADES[k].name)}">`).join('')}</span>` : ''}` : `${HOUSING[p.housing].name} · rent ${fmt$(p.rent)} due in ${p.rentDueIn} wk`]);
  const ct = clothesTier(p);
  rows.push(['Clothes', ct ? `${CLOTHES[ct].name} · ${p.clothes[ct]} wk left${p.dressWarn ? ' <span class="warn">Dress code warning</span>' : ''}` : '<span class="warn">Ratty. Buy clothes!</span>']);
  rows.push(['School', p.course ? `${DEG[p.course.id].name} · ${p.course.prog}/${DEG[p.course.id].sessions}` : (p.degrees.length ? `${p.degrees.length} earned` : 'Not enrolled')]);
  rows.push(['Food', p.fed ? 'Fed this week' : p.groceries > 0 ? `${p.groceries} wk of groceries at home` : '<span class="warn">Hungry! Eat this week</span>']);
  const it = Object.keys(p.items).map(k => ITEMS[k].name);
  rows.push(['Stuff', it.length ? it.join(', ') : 'Nothing fancy yet']);
  if (p.loan) rows.push(['Loan', `<span class="warn">${fmt$(p.loan)}</span> at 1%/week`]);
  if (p.sick) rows.push(['Health', '<span class="warn">Sick: −15h/week until a checkup</span>']);
  return rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
function hintFor(p) {
  if (p.sick) return "You're sick, which costs 15 hours every week. Get a checkup at Dr. Goodvibes Clinic.";
  if (!p.fed && p.groceries <= 0) return "You haven't eaten this week. Grab a combo meal at Burger Bunker or groceries at Gulp & Go, or you'll lose health.";
  if (!p.job) return 'No job yet. The Hustle Hub lists every opening in town. Fry Cook, Cashier and Sales Associate need no experience.';
  if (p.dressWarn) return `Dress code warning! Buy ${CLOTHES[JOB[p.job].clothes].name.toLowerCase()} clothes at Threadbare & Co. this week or you'll be fired.`;
  const ct = clothesTier(p);
  if (ct > 0 && (p.clothes[ct] || 0) <= 2) return 'Your clothes are wearing thin. Threadbare & Co. has fresh outfits.';
  if (p.stress > 65) return 'Stress is high. Yoga, therapy, a nap or a night out brings it down before you get sick.';
  if (!isOwner(p) && p.rentDueIn <= 1 && p.cash + p.bank < p.rent) return `Rent (${fmt$(p.rent)}) is due at the end of this week and you're short.`;
  if (p.cash > 300 && HOUSING[p.housing].risk > .1) return 'Rustbucket Studio gets burgled. Park spare cash at the First Bank of Bucks.';
  const s = scores(p);
  const k = goalKeys().filter(k => s[k] < G.goals[k]).sort((a, b) => s[a] / G.goals[a] - s[b] / G.goals[b])[0];
  return ({
    wealth:'Wealth is your weakest goal. Work longer shifts, take gigs at The Daily Grind, or invest at the bank.',
    happiness:'Happiness is lagging. Try the Funplex, video games, a nicer apartment or a shiny gadget.',
    education:'Education is lagging. Enroll at Hollowbrook College. Certificates are quick; degrees unlock the big jobs.',
    career:'Career is lagging. Better jobs need degrees, nicer clothes and experience. Check the Hustle Hub.',
    health:'Health is lagging. Work out at Swole Patrol and keep stress down.',
  })[k] || 'Every goal is met. Finish the week to claim the win!';
}
function renderSide() {
  const p = canAct() ? cur() : (myPlayer() || cur()); if (!p) return;
  const s = scores(p);
  const isHuman = p.kind === 'human';
  const sub = isHuman ? `${TRAITS[p.trait].name}` : `${PERSONAS[p.persona].label} · ${DIFFS[p.diff].label} CPU`;
  const logs = G.log.slice(-14).reverse();
  let lastW = null;
  const logHTML = logs.map(l => {
    const pl = G.players[l.pid];
    const head = l.w !== lastW ? `<li class="wk">Week ${l.w}</li>` : '';
    lastW = l.w;
    return head + `<li><i style="background:${pl ? pl.color : '#ccc'}"></i><span>${esc(l.text)}</span></li>`;
  }).join('');
  $('#side').innerHTML = `
    <div class="card pcard" style="--pc:${p.color}">
      <div class="pc-top">${portrait(p, 58)}<div><div class="nm">${esc(p.name)}</div><div class="sub">${esc(sub)}</div></div></div>
      <div class="clockrow"><span class="lcd" aria-label="${fmtTime(p)} left">${fmtTime(p)}</span><span class="hbar"><i style="width:${Math.max(0, p.hours / HOURS * 100)}%"></i></span><small>hours left this week · at ${esc(LOCS[p.loc].name)}</small></div>
      <div class="money"><div><span>Wallet</span><b>${fmt$(p.cash)}</b></div><div><span>Bank</span><b>${fmt$(p.bank)}</b></div><div><span>Net worth</span><b>${fmt$(netWorth(p))}</b></div></div>
    </div>
    <div class="card sbox"><h3>Goals</h3>${goalKeys().map(k => goalRow(p, k, s)).join('')}</div>
    <div class="card sbox"><h3>Vitals</h3>
      ${vitalRow('Happiness', p.happiness, GOAL_META.happiness.color)}${vitalRow('Health', p.health, GOAL_META.health.color)}${vitalRow('Stress', p.stress, p.stress > 65 ? '#c7392f' : '#f2a900')}
    </div>
    <div class="card sbox"><h3>Life</h3><dl class="life">${lifeRows(p)}</dl></div>
    ${isHuman && isMine(p) && G.settings.hints ? `<div class="hint"><span class="q">?</span><span>${esc(hintFor(p))}</span></div>` : ''}
    ${isHuman && p === cur() && isMine(p) ? `<div class="endrow"><button class="btn warn" id="btn-end">End week</button></div>` : ''}
    <div class="card logbox"><h3>Town log</h3><ul class="loglist">${logHTML || '<li>Nothing yet.</li>'}</ul></div>`;
  const be = $('#btn-end');
  if (be) be.onclick = () => {
    if (busy) return;
    if (p.hours >= 6 && be.dataset.armed !== '1') { be.dataset.armed = '1'; be.textContent = `End with ${p.hours}h unused?`; setTimeout(() => { if (be.isConnected) { be.dataset.armed = ''; be.textContent = 'End week'; } }, 3500); return; }
    endTurnUI();
  };
}
function tokenPos(p, pt) {
  const n = G.players.length, k = p.id;
  return { x: pt.x + (k - (n - 1) / 2) * 20, y: pt.y + 12 };
}
function renderTokens() {
  const hi = document.getElementById('home-img'); if (hi && G) hi.setAttribute('href', bldSrc('home', cur().housing));
  const hs = document.getElementById('home-sold'); if (hs && G) hs.setAttribute('visibility', isOwner(cur()) ? 'visible' : 'hidden');
  const g = $('#tokens'); if (!g) return;
  const order = G.players.filter(p => p.id !== G.turn).concat([cur()]);
  g.innerHTML = order.map(p => {
    const pt = tokenPos(p, LOCS[p.loc].door);
    const me = p.id === G.turn;
    return `<g class="tok ${me ? 'me' : ''}" id="tok-${p.id}" transform="translate(${pt.x} ${pt.y}) scale(${me ? 1.2 : .95})">
      ${me ? `<ellipse class="ring-me" cx="0" cy="0" rx="22" ry="8" fill="none" stroke="${p.color}" stroke-width="4"/>` : ''}${tokenArt(p)}</g>`;
  }).join('');
  for (const id of walking) { const el = $('#tok-' + id); el && el.classList.add('walking'); }
}
const TOK_W = { jones_jordan:73, jones_jackie:81, jones_jasper:80, jones_juniper:70 };
function tokenArt(p) {
  const id = avatarId(p);
  if (!id) return charSVG(p);
  const h = 108, w = Math.round(TOK_W[id] / 176 * h);
  return `<ellipse cx="0" cy="0" rx="15" ry="5" fill="#000" opacity=".22"/><g class="bob"><image href="assets/tok/${id}.webp" x="${-w / 2}" y="${-h + 2}" width="${w}" height="${h}"/></g>`;
}
function setTokenAt(p, pt) {
  const el = $('#tok-' + p.id); if (!el) return;
  const q = tokenPos(p, pt); el.setAttribute('transform', `translate(${q.x} ${q.y}) scale(${p.id === G.turn ? 1.2 : .95})`);
}
function renderBillboard() {
  const t = $('#headline'); if (!t) return;
  t.innerHTML = `<b>Hollowbrook Herald · week ${G.news.week || 1}</b><span>${esc(G.news.t)}</span>`;
}
function renderDusk() { const d = $('#dusk'); if (d) d.setAttribute('opacity', (.32 * (1 - clamp(cur().hours / HOURS, 0, 1))).toFixed(3)); }

/* ---------- map interaction ---------- */
function bindMap() {
  const svg = $('#map');
  svg.addEventListener('click', e => { const b = e.target.closest('.bld'); if (b) onBuilding(+b.dataset.i); });
  svg.addEventListener('keydown', e => { const b = e.target.closest('.bld'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onBuilding(+b.dataset.i); } });
  svg.addEventListener('pointerover', e => { const b = e.target.closest('.bld'); if (b) showTip(+b.dataset.i, e); });
  svg.addEventListener('pointermove', e => { if (!$('#maptip').hidden) placeTip(e); });
  svg.addEventListener('pointerout', e => { const b = e.target.closest('.bld'); if (b && !b.contains(e.relatedTarget)) hideTip(); });
  svg.addEventListener('focusin', e => { const b = e.target.closest('.bld'); if (b) { const r = b.getBoundingClientRect(); showTip(+b.dataset.i, { clientX:r.left + r.width / 2, clientY:r.top }); } });
  svg.addEventListener('focusout', hideTip);
}
function showTip(i, e) {
  if (!G) return;
  const p = cur(), L = LOCS[i];
  const tip = $('#maptip');
  let tt;
  if (p.kind !== 'human') tt = `${esc(p.name)} is taking their turn.`;
  else if (i === p.loc) tt = 'You are here.';
  else { const t = travelTime(p, p.loc, i); tt = t > p.hours ? `<span style="color:var(--bad)">${t}h walk. Not enough time.</span>` : `${t}h walk · ${p.hours - t}h left after`; drawRoute(p.loc, i); }
  const jobsHere = JOBS.filter(j => j.loc === L.id).length;
  tip.innerHTML = `<b>${esc(L.name)}</b><span class="t">${esc(L.tag)}</span>${jobsHere ? `<div class="t">${jobsHere} job${jobsHere > 1 ? 's' : ''} here</div>` : ''}<div class="tt">${tt}</div>`;
  tip.hidden = false; placeTip(e);
}
function placeTip(e) {
  const tip = $('#maptip'); const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 16, y = e.clientY + 16;
  if (x + w > innerWidth - 8) x = e.clientX - w - 16;
  if (y + h > innerHeight - 8) y = e.clientY - h - 16;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
}
function hideTip() { $('#maptip').hidden = true; clearRoute(); }
function routeDir(a, b) { const cw = (b - a + NLOC) % NLOC; return cw <= NLOC - cw ? 1 : -1; }
function routeDelta(a, b) { const s0 = LOCS[a].s, s1 = LOCS[b].s; return routeDir(a, b) > 0 ? (s1 - s0 + PERIM) % PERIM : -((s0 - s1 + PERIM) % PERIM); }
function drawRoute(a, b) {
  const g = $('#route'); if (!g) return;
  const s0 = LOCS[a].s, ds = routeDelta(a, b), n = Math.max(2, Math.ceil(Math.abs(ds) / 30));
  const pts = []; for (let k = 0; k <= n; k++) { const q = pointAt(s0 + ds * k / n); pts.push(`${q.x},${q.y}`); }
  g.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 18" opacity=".95"/>`;
}
function clearRoute() { const g = $('#route'); if (g) g.innerHTML = ''; }
function walk(p, to) {
  return new Promise(res => {
    const from = p.loc, t = travelTime(p, from, to), n = steps(from, to);
    const s0 = LOCS[from].s, ds = routeDelta(from, to);
    const dur = speed().step * n * (p.items.scooter ? .55 : 1);
    walking.add(p.id); renderTokens();
    const finish = () => { walking.delete(p.id); p.hours -= t; p.loc = to; clearRoute(); renderAll(); res(); };
    if (dur <= 0 || n === 0) { finish(); return; }
    const t0 = performance.now();
    const f = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setTokenAt(p, pointAt(s0 + ds * e));
      if (k < 1) requestAnimationFrame(f); else finish();
    };
    requestAnimationFrame(f);
  });
}
async function bubble(p, text) {
  const ms = speed().bub; if (!ms) { await sleep(0); return; }
  const wrap = $('#mapwrap'); const pt = tokenPos(p, LOCS[p.loc].door);
  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = text;
  b.style.left = (pt.x / 1600 * 100) + '%'; b.style.top = ((pt.y - 92) / 900 * 100) + '%';
  wrap.appendChild(b); await sleep(ms); b.remove();
}
async function onBuilding(i) {
  if (!G || G.over) return;
  if (ONLINE && !canAct()) { if (G.players.some(isMine)) { hideTip(); openLocation(i); } return; }   // look, don't touch
  if (busy) return;
  const p = cur(); if (p.kind !== 'human') return;
  hideTip();
  if (i !== p.loc) {
    const t = travelTime(p, p.loc, i);
    if (t > p.hours) { toast(`Walking to ${LOCS[i].name} takes ${t}h. You only have ${p.hours}h left.`, 'bad'); return; }
    busy = true; await walk(p, i); busy = false; save();
  }
  openLocation(i);
}

/* ---------- location panel ---------- */
const GROUPS = [
  ['games', 'Games of chance'], ['work', 'Your job'], ['school', 'Study'], ['do', 'Things to do'], ['shop', 'For sale'], ['housing', 'Housing'], ['upgrades', 'Upgrade your home'], ['courses', 'Course catalog'],
  ['gigs', 'Gig board'], ['bank', 'Accounts'], ['loan', 'Loans'], ['stocks', 'Stonk market'], ['jobs', 'Jobs'],
];
function chipsFor(p, a) {
  const c = [];
  if (a.hours) c.push(`<span class="chip time">${a.hours}h</span>`);
  if (a.cost) c.push(`<span class="chip cost">${fmt$(a.cost)}</span>`);
  for (const [t, k] of a.fx) c.push(`<span class="chip ${k}">${esc(t)}</span>`);
  return c.join('');
}
function actCard(p, a) {
  const why = canDo(p, a);
  return `<button class="act${a.img ? ' has-img' : ''}" data-act="${a.id}" ${why ? 'disabled' : ''}>${a.img ? `<img class="act-img" src="${a.img}" alt="">` : ''}<span class="act-t">${esc(a.label)}</span>${a.desc ? `<span class="act-d">${esc(a.desc)}</span>` : ''}<span class="chips">${chipsFor(p, a)}</span>${why ? `<span class="why">${esc(why)}</span>` : ''}</button>`;
}
function jobCard(p, a) {
  const j = a.job, why = canDo(p, a);
  const reqs = [];
  reqs.push(`<span class="chip ${j.edu ? (hasDeg(p, j.edu) ? 'good' : 'bad') : 'good'}">${j.edu ? (j.edu === 'bachelor' ? "Any bachelor's" : DEG[j.edu].name) : 'No degree'}</span>`);
  reqs.push(`<span class="chip ${clothesTier(p) >= j.clothes ? 'good' : 'bad'}">${CLOTHES[j.clothes].name} clothes</span>`);
  if (j.exp) reqs.push(`<span class="chip ${p.exp >= j.exp ? 'good' : 'bad'}">${j.exp}h experience</span>`);
  if (j.minHealth) reqs.push(`<span class="chip ${p.health >= j.minHealth ? 'good' : 'bad'}">Health ${j.minHealth}+</span>`);
  if (j.minHappy) reqs.push(`<span class="chip ${p.happiness >= j.minHappy ? 'good' : 'bad'}">Happiness ${j.minHappy}+</span>`);
  return `<button class="act ${a.cur ? 'current' : ''}" data-act="${a.id}" ${why ? 'disabled' : ''}>
    <span class="act-t">${esc(j.title)}${a.cur ? ' · current job' : ''}</span><span class="act-d">${esc(a.desc)}</span>
    <span class="chips"><span class="chip time">Apply: 1h</span><span class="chip good">Career ${j.prestige * 9}+</span>${reqs.join('')}</span>
    ${why && !a.cur ? `<span class="why">${esc(why)}</span>` : ''}</button>`;
}
function spark(hist, color) {
  const h = hist.slice(-12); if (h.length < 2) return '';
  const mn = Math.min(...h), mx = Math.max(...h), w = 70, ht = 22;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${(ht - 2 - (mx === mn ? .5 : (v - mn) / (mx - mn)) * (ht - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}
function stockBasis(p, id) {
  p.basis = p.basis || {};
  const own = p.shares[id] || 0;
  if (own && p.basis[id] == null) p.basis[id] = Math.round(own * G.stocks[id].price);   // older saves: start tracking from today's price
  return own ? p.basis[id] : 0;
}
function plCell(p, id) {
  const own = p.shares[id] || 0; if (!own) return '<span style="color:var(--muted)">–</span>';
  const cost = stockBasis(p, id), val = Math.round(own * G.stocks[id].price), d = val - cost, pct = cost ? d / cost * 100 : 0;
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<span class="${cls}">${d > 0 ? '▲ +' : d < 0 ? '▼ −' : ''}${fmt$(Math.abs(d))} <small>(${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)</small></span><small style="display:block;color:var(--muted)">avg cost ${fmt$(cost / own)}</small>`;
}
function plTotal(p) {
  const ids = Object.keys(p.shares).filter(k => p.shares[k]); if (!ids.length) return '';
  let cost = 0, val = 0; for (const k of ids) { cost += stockBasis(p, k); val += Math.round(p.shares[k] * G.stocks[k].price); }
  const d = val - cost, cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return `<tr style="background:var(--wash)"><td colspan="4"><b>Your portfolio</b></td><td><b>${fmt$(val)}</b></td><td class="${cls}"><b>${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt$(Math.abs(d))}</b> <small>(${d >= 0 ? '+' : '−'}${cost ? Math.abs(d / cost * 100).toFixed(1) : '0.0'}%)</small></td><td></td></tr>`;
}
function stocksTable(p, acts) {
  const rows = STOCKS.map(s => {
    const st = G.stocks[s.id], h = st.hist, prev = h.length > 1 ? h[h.length - 2] : st.price, ch = (st.price / prev - 1) * 100, own = p.shares[s.id] || 0;
    const btn = id => { const a = acts.find(x => x.id === id); const why = canDo(p, a); return `<button class="btn sm ${id.startsWith('buy') ? '' : 'alt'}" data-act="${id}" ${why ? `disabled title="${esc(why)}"` : ''}>${esc(a.label)}</button>`; };
    return `<tr><td class="tk"><b>${s.id}</b><small>${esc(s.name)}</small></td><td>${fmt$(st.price)}${st.price < 10 ? '' : ''}</td>
      <td class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</td><td>${spark(h, ch >= 0 ? '#23894a' : '#c7392f')}</td>
      <td>${own}${own ? ` <small style="color:var(--muted)">(${fmt$(own * st.price)})</small>` : ''}</td>
      <td>${plCell(p, s.id)}</td>
      <td style="display:flex;gap:4px">${btn('buy1_' + s.id)}${btn('buy10_' + s.id)}${btn('sell1_' + s.id)}${btn('sell10_' + s.id)}</td></tr>`;
  }).join('');
  return `<div class="tablewrap"><table class="stk"><thead><tr><th>Ticker</th><th>Price</th><th>Week</th><th>Trend</th><th>You own</th><th>Up / down</th><th>Trade</th></tr></thead><tbody>${rows}${plTotal(p)}</tbody></table></div>
    <p style="margin:6px 0 0;font-size:.8rem;color:var(--ink-2)">Prices move every week with the news on the town billboard. No trading fees, just regret.</p>`;
}
function locStatus(p, i) {
  const id = LOCS[i].id, c = [];
  if (id === 'home') { c.push(`<span class="chip">${HOUSING[p.housing].name}</span>`, `<span class="chip">${p.groceries} wk of groceries</span>`); if (hasOffice(p)) c.push('<span class="chip good">Home office: online classes here take 1h less</span>'); if (!p.items.laptop) c.push(`<span class="chip note">Buy a laptop for ${hasOffice(p) ? 'remote gigs' : 'online classes and remote gigs'}</span>`); }
  if (id === 'bank') c.push(`<span class="chip">Wallet ${fmt$(p.cash)}</span>`, `<span class="chip">Savings ${fmt$(p.bank)} · 0.2%/week</span>`, `<span class="chip ${p.loan ? 'bad' : ''}">Loan ${fmt$(p.loan)}</span>`, `<span class="chip">Loan limit ${fmt$(loanLimit(p))}</span>`);
  if (id === 'college') c.push(`<span class="chip">${p.course ? `Enrolled: ${DEG[p.course.id].name} (${p.course.prog}/${DEG[p.course.id].sessions})` : 'Not enrolled'}</span>`, `<span class="chip good">Education ${Math.floor(eduScore(p))}</span>`);
  if (id === 'hub') c.push(`<span class="chip">${p.job ? 'Current: ' + JOB[p.job].title : 'Unemployed'}</span>`, `<span class="chip">${Math.floor(p.exp)}h work experience</span>`);
  if (id === 'realty') c.push(`<span class="chip">You live in ${HOUSING[p.housing].name}</span>`, isOwner(p) ? `<span class="chip">Home value ${fmt$(homeValueOf(p))} · equity ${fmt$(homeEquity(p))}</span>` : `<span class="chip">Rent ${fmt$(p.rent)}/month, due in ${p.rentDueIn} wk (autopay)</span>`);
  if (id === 'thread') { const t = clothesTier(p); c.push(`<span class="chip">Wearing: ${CLOTHES[t].name}${t ? `, ${p.clothes[t]} wk left` : ''}</span>`); }
  if (id === 'byte') c.push(`<span class="chip">Owned: ${Object.keys(p.items).map(k => ITEMS[k].name).join(', ') || 'nothing yet'}</span>`);
  if (id === 'grind') c.push('<span class="chip">Gig board refreshes every week</span>');
  if (id === 'clinic' && p.sick) c.push('<span class="chip bad">You are sick</span>');
  if (id === 'burger' || id === 'gulp') c.push(`<span class="chip ${p.fed || p.groceries > 0 ? 'good' : 'bad'}">${p.fed ? 'Fed this week' : p.groceries > 0 ? 'Groceries at home' : 'Hungry'}</span>`);
  return c.join('');
}
function openLocation(i) {
  openLoc = i;
  openModal(locHTML(i), { label:LOCS[i].name, cls:previewing() ? 'preview' : '', onClose:() => { openLoc = -1; } });
}
/* Online, while someone else plays: browse a building as yourself, standing there, with next week's hours. */
const previewing = () => !!(ONLINE && G && !canAct() && G.players.some(isMine));
function locViewer(i) {
  if (!previewing()) return cur();
  const me = G.players.find(isMine), v = JSON.parse(JSON.stringify(me));
  v.loc = i;
  if (me.done) v.hours = Math.max(10, HOURS - (me.sick ? 15 : 0) - (me.health < 25 ? 10 : 0) - (me.hourPenalty || 0));
  return v;
}
function locHTML(i) {
  const pv = previewing(), p = locViewer(i), L = LOCS[i], acts = actionsFor(p);
  let body = '';
  for (const [g, title] of GROUPS) {
    let list = acts.filter(a => a.group === g);
    if (!list.length) continue;
    let inner;
    if (g === 'stocks') inner = stocksTable(p, list);
    else if (g === 'bank' || g === 'loan') inner = `<div class="bankrow">${list.map(a => { const why = canDo(p, a); return `<button class="btn sm ${a.id.startsWith('dep') || a.id.startsWith('repay') ? 'go' : 'alt'}" data-act="${a.id}" ${why ? `disabled title="${esc(why)}"` : ''}>${esc(a.label)}</button>`; }).join('')}</div>`;
    else if (g === 'jobs') {
      if (L.id === 'hub' && prefs.jobFilter) list = list.filter(a => a.cur || !a.fails.length);
      list.sort((a, b) => (b.cur - a.cur) || (!a.fails.length === !b.fails.length ? wageOf(p, b.job) - wageOf(p, a.job) : a.fails.length ? 1 : -1));
      inner = `<div class="acts">${list.map(a => jobCard(p, a)).join('') || '<p>No openings you qualify for yet.</p>'}</div>`;
    } else inner = `<div class="acts">${list.map(a => actCard(p, a)).join('')}</div>`;
    const t = g === 'jobs' ? (L.id === 'hub' ? 'Every job in town' : 'Jobs here') : title;
    const filter = g === 'jobs' && L.id === 'hub' ? `<label class="jobfilter"><input type="checkbox" id="jobfilter" ${prefs.jobFilter ? 'checked' : ''}> Only jobs I qualify for</label>` : '';
    body += `<section class="grp"><h3>${t}${filter}</h3>${inner}</section>`;
  }
  const intId = L.id === 'home' ? 'int_home_' + p.housing : 'int_' + L.id, npc = NPCS[L.id];
  const bg = ART_MISSING.has(intId) ? 'background-image:radial-gradient(ellipse at 50% 120%,#ffc93c55,transparent 60%),repeating-linear-gradient(90deg,#5b1d3a 0 40px,#6b2346 40px 80px)' : `background-image:url(assets/int/${intId}.webp)`;
  const npcImg = npc && !ART_MISSING.has('npc_' + L.id) ? `<img class="npc" src="assets/npc/npc_${L.id}.webp" alt="${esc(npc[0])}">` : '';
  return `<div class="lochero" style="${bg}">
      ${npc ? `${npcImg}<span class="quote" ${npcImg ? '' : 'style="right:16px"'}>${esc(npc[2])}</span>` : ''}
      <div class="lh-card"><h2>${esc(L.id === 'home' ? HOUSING[p.housing].name : L.name)}</h2><p>${esc(L.tag)}</p>${npc ? `<span class="who">${esc(npc[0])} · ${esc(npc[1])}</span>` : ''}</div></div>
    <div class="mbody">${pv ? `<div class="previewnote">👀 Just looking. It's ${esc(cur().name)}'s turn, so you can browse prices and plan, then act on your week.</div>` : ''}<div class="status">${locStatus(p, i)}</div>${body}</div>
    <div class="mfoot"><span style="margin-right:auto;align-self:center;font-weight:600">${pv ? 'Your hours next turn' : 'Time left this week'}</span><span class="lcd" style="font-size:1.5rem;align-self:center">${p.hours}h</span><button class="btn alt" data-close="1">Leave</button></div>`;
}
function refreshLoc() {
  if (openLoc < 0) return;
  const card = $('#modal .modal-card'); const y = card ? card.scrollTop : 0;
  card.innerHTML = locHTML(openLoc); card.scrollTop = y;
}
function humanAct(id) {
  if (busy || !G || previewing()) return;
  const p = cur(); if (p.kind !== 'human' || !canAct()) return;
  const a = actionsFor(p).find(x => x.id === id); if (!a) return;
  const why = canDo(p, a); if (why) { toast(why, 'bad'); return; }
  if (a.opens) {
    if (a.opens !== 'wheel') addLog(p, named(p, doAction(p, a)));
    openGame(a.opens); return;
  }
  const msg = doAction(p, a);
  addLog(p, named(p, msg));
  toast(you(msg), /graduated|WON|hired|bought the Starter/.test(msg) ? 'good' : '');
  save(); renderAll(); refreshLoc();
  if (p.hours <= 0) { closeModal(true); toast("You're out of hours. That's the week!"); setTimeout(endTurnUI, 900); }
}

/* ---------- turns ---------- */
function startTurn() {
  if (!G || G.over) { if (G && G.over) showVictory(); return; }
  const p = cur(); p.loc = 0;
  renderAll();
  if (p.kind === 'cpu') runCPU(p);
  else if (!isMine(p)) { save(); renderWaiting(); }
  else showIntro(p);
}
async function endTurnUI(force) {
  if (busy || !G || G.over) return;
  if (!force && !canAct()) return;
  const p = cur();
  if (!(openLoc >= 0 && ONLINE && !isMine(p))) closeModal(true);   // keep someone's building preview open while a CPU wraps up
  addLog(p, `${p.name} called it a week with ${p.hours}h to spare.`);
  p.done = true;
  G.turn++;
  if (G.turn >= G.players.length) {
    endWeek(); save();
    if (G.over) { renderAll(); showVictory(); return; }
    toast(`Week ${G.week} begins. New headline on the billboard.`);
  }
  cur().loc = 0;
  save();
  startTurn();
}
async function runCPU(p) {
  busy = true; cpuSkip = !!ONLINE;
  const bar = $('#cpubar');
  bar.innerHTML = `<span class="l">${portrait(p, 30)}<span><b>${esc(p.name)}</b> is planning their week<span class="dots"></span></span></span><button class="btn sm alt" id="btn-skip">Skip ahead</button>`;
  bar.hidden = false;
  $('#btn-skip').onclick = () => { cpuSkip = true; };
  if (p.event) {
    const ch = cpuEventChoice(p); const e = EVENTS[p.event];
    const r = resolveEvent(p, ch);
    if (r) addLog(p, `${p.name}: ${r.text}${e.choices ? ` Chose "${e.choices[ch].label}". ${r.result}` : ''}`);
  }
  renderAll();
  await sleep(speed().bub * .6);
  for (let n = 0; n < 40 && !G.over; n++) {
    const b = cpuNext(p); if (!b) break;
    if (b.i !== p.loc) await walk(p, b.i);
    const a = actionsFor(p).find(x => x.id === b.id);
    if (!a || canDo(p, a)) continue;
    const msg = doAction(p, a);
    addLog(p, named(p, msg));
    renderAll();
    await bubble(p, a.label);
  }
  bar.hidden = true; busy = false;
  await sleep(speed().bub * .4);
  endTurnUI(true);
}
function deltaCell(label, v, money) {
  const cls = Math.round(v) > 0 ? 'up' : Math.round(v) < 0 ? 'down' : '';
  return `<div><span>${label}</span><b class="${label === 'Stress' ? (cls === 'up' ? 'down' : cls === 'down' ? 'up' : '') : cls}">${signed(v, money)}</b></div>`;
}
function showIntro(p) {
  const multi = !ONLINE && humans().length > 1;
  if (ONLINE) { G.turnKey = turnKey(); save(); }
  let eventHTML = '';
  let needChoice = false, evImg = '';
  if (p.event) {
    const e = EVENTS[p.event];
    evImg = `<img class="evimg" id="evimg" src="assets/evt/evt_${p.event}.webp" alt="">`;
    if (e.choices) { needChoice = true; eventHTML = `<div class="eventbox">${evImg}<span class="eyebrow">Something came up</span><span class="ev">${esc(e.text)}</span><div class="choices">${e.choices.map((c, k) => `<button class="btn sm ${k ? 'alt' : ''}" data-evc="${k}">${esc(c.label)}</button>`).join('')}</div></div>`; }
    else { const r = resolveEvent(p); addLog(p, `${p.name}: ${r.text}`); eventHTML = `<div class="eventbox">${evImg}<span class="eyebrow">Something happened</span><span class="ev">${esc(r.text)}</span></div>`; }
  }
  let recap = '';
  if (p.recap) {
    const d = p.recap.d;
    recap = `<section class="grp"><h3>Last week (week ${p.recap.week})</h3>
      <div class="recap"><div><span>Earned</span><b class="up">${fmt$(p.recap.earned)}</b></div><div><span>Spent</span><b class="down">${fmt$(p.recap.spent)}</b></div>
      ${deltaCell('Net worth', d.nw, true)}${deltaCell('Happiness', d.hap)}${deltaCell('Health', d.hea)}${deltaCell('Stress', d.str)}${d.edu ? deltaCell('Education', d.edu) : ''}${d.car ? deltaCell('Career', d.car) : ''}</div>
      ${p.recap.lines.length ? `<ul class="lines" style="margin-top:10px">${p.recap.lines.map(([t, k]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  const st = standings();
  const standingHTML = G.players.length > 1 ? `<section class="grp"><h3>The race</h3><div class="standing">${st.map(q => `<div>${portrait(q, 28)}<span style="min-width:0"><span style="display:block;font-size:.8rem;font-weight:600">${esc(q.name)}</span><span class="gbar" style="--gc:${q.color};display:block"><i style="width:${Math.round(progress(q) * 100)}%"></i></span></span><b class="num">${Math.round(progress(q) * 100)}%</b></div>`).join('')}</div></section>` : '';
  const html = `<div class="mhead intro-head"><div class="intro-hero">${portrait(p, 64)}<div><span class="eyebrow">Week ${G.week}${G.weekLimit ? ` of ${G.weekLimit}` : ''}</span><h2>${multi ? `Pass the device to ${esc(p.name)}` : `Your week, ${esc(p.name)}`}</h2></div></div></div>
    <div class="mbody">
      ${eventHTML}
      <div class="newsbox"><div class="nh">HOLLOWBROOK HERALD</div><p>${esc(G.news.t)}</p></div>
      ${recap}
      ${standingHTML}
    </div>
    <div class="mfoot"><span style="margin-right:auto;align-self:center;font-weight:600">${p.hours}h this week${p.hours < HOURS ? ' (sick or worn out)' : ''}</span><button class="btn go" id="btn-startweek" data-autofocus ${needChoice ? 'disabled' : ''}>Start week</button></div>`;
  openModal(html, { locked:true, cls:'narrow', label:'Start of week' });
  const m = $('#modal');
  m.querySelectorAll('[data-evc]').forEach(b => b.onclick = () => {
    const k = +b.dataset.evc, e = EVENTS[p.event]; p.lastEvent = p.event;
    const r = resolveEvent(p, k);
    addLog(p, `${p.name}: ${r.text} Chose "${e.choices[k].label}". ${r.result}`);
    const box = m.querySelector('.eventbox');
    const ei = p.lastEvent === 'crypto' ? (/mooned/.test(r.result) ? 'crypto_moon' : k === 0 ? 'crypto_rug' : 'crypto') : p.lastEvent;
    box.innerHTML = `<img class="evimg" src="assets/evt/evt_${ei}.webp" alt=""><span class="eyebrow">Something came up</span><span class="ev">${esc(r.text)}</span><span class="res">${esc(e.choices[k].label)}: ${esc(r.result)}</span>`;
    $('#btn-startweek').disabled = false; $('#btn-startweek').focus();
    m.querySelector('.mfoot span').textContent = `${p.hours}h this week`;
    save(); renderAll();
  });
  $('#btn-startweek').onclick = () => {
    closeModal(true); save(); renderAll();
    if (!prefs.seenHelp && G.settings.hints) { prefs.seenHelp = true; savePrefs(); showHelp(); }
  };
}

/* ---------- other modals ---------- */
function showHelp() {
  const S = (h, t) => `<section><h3>${h}</h3><p>${t}</p></section>`;
  openModal(`<div class="mhead"><div class="ttl"><h2>How to play</h2><p>Hit every life goal before your rivals do.</p></div><button class="btn sm alt" data-close="1">Got it</button></div>
    <div class="mbody"><div class="help-grid">
      ${S('Your week', 'Everyone gets 60 hours a week. Walking costs 1 hour per step around the ring road, and actions show their time and cost before you commit. When you run out of hours, or press End week, the next player goes.')}
      ${S('The goals', 'Wealth is your net worth. Happiness and Health are vitals you keep topped up. Education comes from certificates and degrees. Career comes from your job\'s prestige plus time in the role. Meet every goal at the end of a week to win.')}
      ${S('Eat, sleep, pay rent', 'Eat once a week: a combo at Burger Bunker, or groceries from Gulp & Go that you eat at home automatically. Rent is autopaid every 4 weeks, and if you come up short it goes onto a loan.')}
      ${S('Jobs and school', 'The Hustle Hub lists every job and what it needs: a degree, a dress code and hours of experience. Work shifts at the job\'s location: up to 30 regular hours a week, then 12 hours of overtime at 1.5× pay (but double stress), then your manager sends you home. Classes at Hollowbrook College build toward certificates and degrees.')}
      ${S('Stress and health', 'Work and study add stress. Stress over 70 hurts health and happiness and makes you sick more often. Being sick costs 15 hours a week until you get a checkup.')}
      ${S('Money moves', 'Your wallet can be burgled at the Rustbucket, so bank your spare cash. Stocks swing with the billboard headlines. A house builds equity, and the gig board and espresso squeeze more out of a week.')}
      ${S('Your rivals', 'The Joneses are CPU players with personalities: the Grinder, the Party Animal, the Investor and the Scholar. Click any player at the top to see their file.')}
      ${S('Saving', 'The game saves after every action in this browser. Close the tab and choose Continue on the title screen to pick up where you left off.')}
    </div></div>`, { label:'How to play' });
}
function showMenu() {
  openModal(`<div class="mhead"><div class="ttl"><h2>Menu</h2><p>Your game saves automatically after every action.</p></div><button class="btn sm alt" data-close="1">Resume</button></div>
    <div class="mbody">
      <div class="opt-row"><span class="eyebrow">Animation speed</span><div class="seg" id="menu-speed">${Object.entries(SPEEDS).map(([k, s]) => `<button data-mspeed="${k}" aria-pressed="${G.settings.speed === k}">${s.label}</button>`).join('')}</div></div>
      <label class="check"><input type="checkbox" id="menu-hints" ${G.settings.hints ? 'checked' : ''}> Show tips in the sidebar</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn alt" id="menu-title">${ONLINE ? 'Back to your games' : 'Save and exit to title'}</button>${ONLINE ? '' : '<button class="btn warn" id="menu-new">Start a new game</button>'}</div>
      <p id="menu-confirm" style="margin:0;font-weight:600;color:var(--bad)" hidden>Starting over ends this game. Press again to confirm.</p>
    </div>`, { cls:'narrow', label:'Menu' });
  $('#menu-speed').onclick = e => { const b = e.target.closest('[data-mspeed]'); if (!b) return; G.settings.speed = b.dataset.mspeed; prefs.speed = b.dataset.mspeed; savePrefs(); save(); showMenu(); renderHUD(); };
  $('#menu-hints').onchange = e => { G.settings.hints = e.target.checked; prefs.hints = e.target.checked; savePrefs(); save(); renderSide(); };
  $('#menu-title').onclick = () => { if (busy) { toast('Wait for the current turn to finish.', 'bad'); return; } save(); closeModal(true); if (ONLINE) { setTimeout(() => { leaveOnline(); showOnlineHub(); }, 400); return; } showTitle(); };
  if ($('#menu-new')) $('#menu-new').onclick = e => {
    if (busy) { toast('Wait for the current turn to finish.', 'bad'); return; }
    if (e.target.dataset.armed !== '1') { e.target.dataset.armed = '1'; $('#menu-confirm').hidden = false; return; }
    closeModal(true); clearSave(); setup = setup || defaultSetup(); renderSetup(); show('setup');
  };
}
function showRival(i) {
  const p = G.players[i], s = scores(p);
  const sub = p.kind === 'human' ? `Human · ${TRAITS[p.trait].name}` : `${PERSONAS[p.persona].label} · ${DIFFS[p.diff].label} CPU · ${TRAITS[p.trait].name}`;
  openModal(`<div class="mhead">${portrait(p, 64)}<div class="ttl"><h2>${esc(p.name)}</h2><p>${esc(sub)}</p></div><button class="btn sm alt" data-close="1">Close</button></div>
    <div class="mbody">
      <div class="rival-grid">
        <div class="card sbox"><h3>Goals · ${Math.round(progress(p) * 100)}%</h3>${goalKeys().map(k => goalRow(p, k, s)).join('')}</div>
        <div class="card sbox"><h3>Vitals</h3>${vitalRow('Happiness', p.happiness, GOAL_META.happiness.color)}${vitalRow('Health', p.health, GOAL_META.health.color)}${vitalRow('Stress', p.stress, '#f2a900')}</div>
      </div>
      <div class="card sbox"><h3>Life</h3><dl class="life">${lifeRows(p)}<dt>Degrees</dt><dd>${p.degrees.map(d => DEG[d].name).join(', ') || 'None yet'}</dd><dt>Stocks</dt><dd>${Object.entries(p.shares).map(([k, n]) => `${n} ${k}`).join(', ') || 'None'}</dd></dl></div>
    </div>`, { cls:'narrow', label:p.name });
}
const STAT_TABS = [['nw', 'Net worth', true], ['hap', 'Happiness'], ['edu', 'Education'], ['car', 'Career'], ['hea', 'Health'], ['str', 'Stress']];
function lineChart(key, money) {
  const W = 720, H = 300, pl = money ? 68 : 44, pr = 18, pt = 16, pb = 34;
  const all = G.players.flatMap(p => p.hist.map(h => h[key]));
  const maxW = Math.max(1, ...G.players.flatMap(p => p.hist.map(h => h.w)));
  let lo = Math.min(0, ...all), hi = Math.max(money ? 100 : 100, ...all);
  const stepRaw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(stepRaw || 1))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= stepRaw);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = w => pl + (w / maxW) * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo || 1)) * (H - pt - pb);
  let g = '';
  for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3dcef" stroke-width="1.5"/><text x="${pl - 8}" y="${Y(v)}" text-anchor="end" dominant-baseline="central" font-size="12" fill="#6a6383" class="svgbody">${money ? fmt$(v) : Math.round(v)}</text>`;
  const xt = Math.max(1, Math.ceil(maxW / 8));
  for (let w = 0; w <= maxW; w += xt) g += `<text x="${X(w)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#6a6383" class="svgbody">${w}</text>`;
  g += `<text x="${W - pr}" y="${H - 12}" text-anchor="end" font-size="11" fill="#6a6383" class="svgbody" dy="0">week</text>`;
  const goalKey = { nw:'wealth', hap:'happiness', edu:'education', car:'career', hea:'health' }[key];
  if (goalKey && G.goals[goalKey]) { const gv = key === 'nw' ? G.goals.wealth * WEALTH_UNIT : G.goals[goalKey]; if (gv <= hi) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(gv)}" y2="${Y(gv)}" stroke="#2a1f3d" stroke-width="2" stroke-dasharray="6 6"/><text x="${pl + 6}" y="${Y(gv) - 9}" font-size="12" fill="#2a1f3d" class="svgbody" font-weight="700">Goal</text>`; }
  for (const p of G.players) {
    const pts = p.hist.map(h => `${X(h.w).toFixed(1)},${Y(h[key]).toFixed(1)}`).join(' ');
    const last = p.hist[p.hist.length - 1];
    g += `<polyline points="${pts}" fill="none" stroke="${p.color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(last.w)}" cy="${Y(last[key])}" r="5.5" fill="${p.color}" stroke="#2a1f3d" stroke-width="2"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${key} over time">${g}</svg>`;
}
function showStats(tab) {
  tab = tab || 'nw';
  const t = STAT_TABS.find(x => x[0] === tab);
  openModal(`<div class="mhead"><div class="ttl"><h2>Stats</h2><p>Everyone's progress, week by week.</p></div><button class="btn sm alt" data-close="1">Close</button></div>
    <div class="mbody">
      <div class="tabs" role="group" aria-label="Stat">${STAT_TABS.map(([k, l]) => `<button data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>
      ${lineChart(tab, !!t[2])}
      <div class="legend">${G.players.map(p => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div>
    </div>`, { label:'Stats' });
  $('#modal .tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) showStats(b.dataset.tab); };
}
function showLog(filter) {
  filter = filter ?? -1;
  const items = G.log.filter(l => filter < 0 || l.pid === filter).slice().reverse();
  let lastW = null;
  const html = items.map(l => { const pl = G.players[l.pid]; const h = l.w !== lastW ? `<li class="wk">Week ${l.w}</li>` : ''; lastW = l.w; return h + `<li><i style="background:${pl ? pl.color : '#ccc'}"></i><span>${esc(l.text)}</span></li>`; }).join('');
  openModal(`<div class="mhead"><div class="ttl"><h2>Town log</h2><p>Everything everyone did this game, newest first.</p></div><button class="btn sm alt" data-close="1">Close</button></div>
    <div class="mbody"><div class="tabs" id="logtabs"><button data-lf="-1" aria-pressed="${filter < 0}">Everyone</button>${G.players.map(p => `<button data-lf="${p.id}" aria-pressed="${filter === p.id}">${esc(p.name)}</button>`).join('')}</div>
    <ul class="loglist" style="max-height:none">${html || '<li>Nothing yet.</li>'}</ul></div>`, { label:'Town log' });
  $('#logtabs').onclick = e => { const b = e.target.closest('[data-lf]'); if (b) showLog(+b.dataset.lf); };
}
function confetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#ffc93c', '#ff6f59', '#18a99c', '#7b4fd1', '#1a8fd6', '#fff'];
  for (let i = 0; i < 70; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = cols[i % cols.length]; s.style.animationDuration = 2.2 + Math.random() * 2.4 + 's'; s.style.animationDelay = Math.random() * .8 + 's'; c.appendChild(s); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 6000);
}
function showVictory() {
  const o = G.over; const w = G.players[o.ids[0]];
  const st = standings();
  const anyHuman = humans().length > 0;
  const humanWon = o.ids.some(id => G.players[id].kind === 'human');
  const line = o.reason === 'limit' ? `Time's up after ${o.week} weeks. ${esc(w.name)} got closest to their goals.` :
    o.ids.length > 1 ? `${o.ids.map(id => esc(G.players[id].name)).join(' and ')} hit every goal in week ${o.week}. A tie for the ages.` :
    `${esc(w.name)} hit every life goal in week ${o.week}.`;
  const tag = humanWon ? 'Forget keeping up. You ARE the Joneses now.' : anyHuman ? 'The Joneses stay one step ahead. For now.' : 'The Joneses keep up with themselves.';
  const hero = o.reason === 'limit' ? 'win_timeup' : w.kind === 'human' ? 'win_human' : (avatarId(w) || 'jones_jordan').replace('jones_', 'win_');
  openModal(`<img class="vhero" src="assets/scr/${hero}.webp" alt=""><div class="mbody victory">${portrait(w, 110)}<span class="eyebrow">Game over</span><h2>${humanWon || !anyHuman ? esc(w.name) + ' wins!' : esc(w.name) + ' wins'}</h2><p style="margin:0;font-weight:600">${line}</p><p style="margin:0;color:var(--ink-2)">${tag}</p>
    <div class="standing" style="width:100%;text-align:left">${st.map(q => `<div>${portrait(q, 28)}<span style="min-width:0"><span style="display:block;font-size:.8rem;font-weight:600">${esc(q.name)}</span><span class="gbar" style="--gc:${q.color};display:block"><i style="width:${Math.round(progress(q) * 100)}%"></i></span></span><b class="num">${Math.round(progress(q) * 100)}%</b></div>`).join('')}</div></div>
    <div class="mfoot"><button class="btn alt" id="v-stats">See the stats</button><button class="btn alt" id="v-town">Look at the town</button><button class="btn go" id="v-new">${ONLINE ? 'Back to your games' : 'Play again'}</button></div>`, { cls:'narrow', label:'Game over', locked:true });
  if (humanWon || !anyHuman) confetti();
  $('#v-stats').onclick = () => { closeModal(true); showStats(); modalState.onClose = showVictory; };
  $('#v-town').onclick = () => closeModal(true);
  $('#v-new').onclick = () => { closeModal(true); if (ONLINE) { leaveOnline(); showOnlineHub(); return; } clearSave(); setup = setup || defaultSetup(); renderSetup(); show('setup'); };
}

/* ---------- wiring ---------- */
function bindGlobal() {
  $('#btn-new').onclick = () => { if (!setup || setup.online) setup = defaultSetup(); renderSetup(); show('setup'); };
  $('#btn-online').onclick = () => showOnlineHub();
  $('#btn-online-back').onclick = showTitle;
  $('#btn-net-create').onclick = hubCreate;
  $('#btn-net-join').onclick = hubJoin;
  $('#btn-net-refresh').onclick = renderMyGames;
  $('#net-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#net-code').addEventListener('keydown', e => { if (e.key === 'Enter') hubJoin(); });
  $('#net-games').addEventListener('click', async e => { const b = e.target.closest('[data-open-game]'); if (!b) return; b.disabled = true; try { await openOnlineGame(b.dataset.openGame); } catch (err) { netToast(err); b.disabled = false; } });
  $('#btn-continue').onclick = () => { const s = readSave(); if (!s) return; G = migrateGame(s); enterGame(); startTurn(); };
  $('#btn-help-title').onclick = showHelp;
  $('#btn-help').onclick = showHelp;
  $('#btn-menu').onclick = showMenu;
  $('#btn-stats').onclick = () => showStats();
  $('#btn-log').onclick = () => showLog();
  $('#needs').onclick = e => { const b = e.target.closest('[data-need-loc]'); if (b && $('#modal').hidden) onBuilding(LI[b.dataset.needLoc]); };
  $('#hud-players').onclick = e => { const b = e.target.closest('[data-pid]'); if (b) showRival(+b.dataset.pid); };
  const m = $('#modal');
  m.addEventListener('click', e => {
    if (e.target === m) { closeModal(); return; }
    if (e.target.closest('[data-close]')) { closeModal(true); return; }
    const cb = e.target.closest('[data-cas]'); if (cb) { if (!cb.disabled) casinoClick(cb.dataset.cas, cb.dataset.v); return; }
    const b = e.target.closest('[data-act]'); if (b && !b.disabled) humanAct(b.dataset.act);
  });
  m.addEventListener('change', e => { if (e.target.id === 'jobfilter') { prefs.jobFilter = e.target.checked; savePrefs(); refreshLoc(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  });
  bindSetup();
}
function boot(data) {
  loadPrefs();
  bindGlobal();
  if (data && data.G) {
    G = migrateGame(data.G); enterGame();
    if (G.over) showVictory();
    else if (cur().kind === 'cpu') startTurn();
  } else {
    let join = '';
    try { join = (new URLSearchParams(location.search).get('join') || '').toUpperCase(); } catch (e) {}
    if (join && NET_BE) showOnlineHub(join); else showTitle();
  }
}
try { window.claude?.hot?.snapshot?.(() => ({ G: (G && !$('#game').hidden) ? G : null })); } catch (e) {}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
