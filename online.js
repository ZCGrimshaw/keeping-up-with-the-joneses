/* ===================== Online play: session, hub, lobby, sync ===================== */
const NET_BE = pickBackend();
let ONLINE = null;          // { id, code, uid, version, row, unsub, poll, pushing, dirty, victoryShown }
let NET_UID = null;
const TIMERS = [[0, 'No turn timer'], [12, '12 hours per turn'], [24, '24 hours per turn'], [48, '48 hours per turn'], [72, '3 days per turn']];

const isMine = p => !ONLINE || (p && p.kind === 'human' && p.uid === ONLINE.uid);
const canAct = () => !ONLINE || (isMine(cur()) && !(G && G.together && (cur().done || (G.wheel && G.wheel.status === 'open'))));
const myPlayer = () => ONLINE && G ? G.players.find(p => p.uid === ONLINE.uid) : null;
const turnKey = () => G.week + ':' + G.turn;

async function netReady() {
  if (!NET_BE) throw new Error('offline');
  if (!NET_UID) NET_UID = await NET_BE.init();
  return NET_UID;
}
function netToast(e) { toast(NET_MSG[e && e.code] || (e && e.message) || NET_MSG.network, 'bad'); }

/* ---------- hub ---------- */
async function showOnlineHub(prefill) {
  show('online');
  $('#net-name').value = prefs.netName || '';
  $('#net-trait').innerHTML = Object.entries(TRAITS).map(([k, t]) => `<option value="${k}" ${prefs.netTrait === k ? 'selected' : ''}>${t.name}: ${esc(t.desc)}</option>`).join('');
  $('#net-err').textContent = '';
  $('#net-sound').checked = !!prefs.sound; $('#net-sound').onchange = e => { prefs.sound = e.target.checked; savePrefs(); if (prefs.sound) chime(); };
  if (prefill) { $('#net-code').value = prefill; $('#net-code').focus(); }
  try { await netReady(); renderMyGames(); }
  catch (e) { $('#net-games').innerHTML = `<p class="neterr">${esc(NET_MSG[e.code] || NET_MSG.network)}</p>`; }
}
async function renderMyGames() {
  const box = $('#net-games');
  let rows;
  try { rows = await NET_BE.myGames(); } catch (e) { box.innerHTML = `<p class="neterr">${esc(NET_MSG.network)}</p>`; return; }
  if (!rows.length) { box.innerHTML = '<p class="muted">No online games yet. Create one or join with a code.</p>'; return; }
  box.innerHTML = rows.map(r => {
    const seats = (r.lobby.seats || []).filter(s => s.kind !== 'off');
    const names = r.names || seats.map(s => s.kind === 'cpu' ? 'CPU' : (s.name || 'Open seat'));
    let status, cls = '';
    if (r.status === 'lobby') status = `In the lobby · ${seats.filter(s => s.kind === 'invite' && !s.uid).length} open seat(s)`;
    else if (r.status === 'over') status = 'Finished';
    else if (r.mode === 'together') { if (r.my_done) status = `Week ${r.week} · You're done, waiting for ${r.pending} more`; else { status = `Week ${r.week} · Play your week!`; cls = 'mine'; } }
    else if (r.turn_uid === NET_UID) { status = `Week ${r.week} · Your turn!`; cls = 'mine'; }
    else status = `Week ${r.week} · Waiting for ${r.turn_name || 'a CPU'}`;
    return `<div class="netgame ${cls}"><div class="ng-code">${esc(r.code)}</div><div class="ng-main"><b>${esc(names.join(', '))}</b><span>${esc(status)}</span></div>` +
      `<button class="btn sm ${cls ? 'go' : 'alt'}" data-open-game="${esc(r.id)}">${r.status === 'lobby' ? 'Open lobby' : cls ? 'Play' : 'Open'}</button></div>`;
  }).join('');
}
function hubName() {
  const n = $('#net-name').value.trim();
  prefs.netName = n; prefs.netTrait = $('#net-trait').value; savePrefs();
  return n;
}
async function hubJoin() {
  const code = $('#net-code').value.trim().toUpperCase(), err = $('#net-err');
  err.textContent = '';
  const name = hubName();
  if (!name) { err.textContent = 'Type your name first so friends know who joined.'; $('#net-name').focus(); return; }
  if (code.length < 5 || code.length > 6) { err.textContent = 'Codes are five-letter words, like LUCKY.'; return; }
  $('#btn-net-join').disabled = true;
  try { await netReady(); const r = await NET_BE.joinGame(code, name, prefs.netTrait || 'hustler'); await openOnlineGame(r.id); }
  catch (e) { err.textContent = NET_MSG[e.code] || e.message; }
  finally { $('#btn-net-join').disabled = false; }
}
function hubCreate() {
  const name = hubName();
  if (!name) { $('#net-err').textContent = 'Type your name first so friends know who invited them.'; $('#net-name').focus(); return; }
  setup = defaultSetup(true); setup.slots[0].name = name; renderSetup(); show('setup');
}

/* ---------- create / open ---------- */
async function createOnline() {
  const btn = $('#btn-start'); btn.disabled = true;
  try {
    await netReady();
    const r = await NET_BE.createGame(setupToLobby());
    await openOnlineGame(r.id);
  } catch (e) { netToast(e); }
  finally { btn.disabled = false; }
}
/* ---------- lobby <-> setup screen ----------
   The lobby always has 4 seats (kind host | invite | cpu | off) so seat numbers never shift once friends join. */
function setupToLobby() {
  const seats = setup.slots.map((s, i) => {
    const seat = { kind: i === 0 ? 'host' : s.kind, avatar:s.avatar, color:s.color, persona:s.persona, diff:s.diff, trait:s.trait,
      name: i === 0 ? slotName(s) : (s.uid ? s.name : '') };
    if (s.uid) seat.uid = s.uid;
    return seat;
  });
  return { seats, goals:Object.assign({}, setup.goals, { health: setup.health ? setup.healthGoal : 0 }), weekLimit:setup.limit, timerHours:setup.timer || 0, mode:setup.mode || 'turns' };
}
function padSeats(seats) {
  const out = seats.map(s => Object.assign({}, s));
  const used = out.map(s => s.avatar);
  while (out.length < 4) {
    const av = CHARS.map(c => c.id).find(id => !used.includes(id)) || 'jones_jackie'; used.push(av);
    out.push({ kind:'off', avatar:av, color:COLORS.find(c => !out.some(x => x.color === c)) || COLORS[out.length], persona:'partier', diff:'normal', trait:'hustler', name:'' });
  }
  return out;
}
function lobbyToSetup(L) {
  const g = L.goals || {};
  return {
    slots: padSeats(L.seats).map((s, i) => ({ kind: i === 0 ? 'human' : s.kind, avatar:s.avatar, color:s.color, persona:s.persona || 'grinder', diff:s.diff || 'normal',
      trait:s.trait || 'hustler', name:s.name || '', uid:s.uid || null })),
    goals:{ wealth:g.wealth || 50, happiness:g.happiness || 50, education:g.education || 50, career:g.career || 50 },
    health:!!g.health, healthGoal:g.health || 50, limit:L.weekLimit || 0, online:true, timer:+L.timerHours || 0, mode:L.mode || 'turns', editing:ONLINE.id,
  };
}
function editLobbySettings() { setup = lobbyToSetup(ONLINE.row.lobby); renderSetup(); show('setup'); }
function backToLobby() { if (ONLINE) { setup = null; renderLobby(); netRefresh(true); } else showOnlineHub(); }
async function saveLobbyEdits() {
  const btn = $('#btn-start'); btn.disabled = true;
  try {
    const lobby = setupToLobby();
    const latest = await NET_BE.getGame(ONLINE.id);           // keep anyone who joined while the host was editing
    let kept = 0;
    lobby.seats = lobby.seats.map((s, i) => { const l = latest.lobby.seats[i]; if (l && l.uid && l.uid !== s.uid) { kept++; return l; } return s; });
    ONLINE.version = await NET_BE.updateLobby(ONLINE.id, lobby);
    setup = null; toast(kept ? `Game updated. A friend joined while you were editing, so their seat was kept.` : 'Game updated. Everyone in the lobby sees the change.', 'good');
    await netRefresh(true);
  } catch (e) { netToast(e); if (e.code === 'seat_taken' || e.code === 'conflict') { setup = null; await netRefresh(true); } }
  finally { btn.disabled = false; }
}
async function hostEditSeat(i, patch) {
  const L = JSON.parse(JSON.stringify(ONLINE.row.lobby));
  L.seats = padSeats(L.seats);
  const s = L.seats[i]; if (!s || s.uid || i === 0) return;
  Object.assign(s, patch);
  if (patch.kind && patch.kind !== 'off') {
    const others = L.seats.filter((x, j) => j !== i && x.kind !== 'off');
    if (others.some(x => x.avatar === s.avatar)) { const av = CHARS.map(c => c.id).find(id => !others.some(x => x.avatar === id)); if (av) { const k = L.seats.findIndex((x, j) => j !== i && x.avatar === av && !x.uid); if (k >= 0) L.seats[k].avatar = s.avatar; s.avatar = av; } }
    if (others.some(x => x.color === s.color)) s.color = COLORS.find(c => !others.some(x => x.color === c)) || s.color;
  }
  try { ONLINE.version = await NET_BE.updateLobby(ONLINE.id, L); await netRefresh(true); }
  catch (e) { netToast(e); await netRefresh(true); }
}
async function openOnlineGame(id) {
  await netReady();
  leaveOnline();
  const row = await NET_BE.getGame(id);
  ONLINE = { id, code:row.code, uid:NET_UID, version:-1, row:null, pushing:false, dirty:false, victoryShown:false, pendingLog:[], myChoice:{} };
  ONLINE.unsub = NET_BE.subscribe(id, () => netRefresh());
  ONLINE.poll = setInterval(netPoll, 15000);
  applyRow(row);
}
function leaveOnline() {
  if (!ONLINE) return;
  try { ONLINE.unsub && ONLINE.unsub(); } catch (e) {}
  clearInterval(ONLINE.poll); clearInterval(ONLINE.tick); clearTimeout(ONLINE.flushT); clearTimeout(ONLINE.cpuT); clearTimeout(ONLINE.advT); clearTimeout(ONLINE.wheelT);
  ONLINE = null;
  renderCodeBox();
  $('#net-chip').hidden = true;
}
async function netPoll() {
  if (!ONLINE) return;
  if (!together() && (ONLINE.pushing || ONLINE.dirty)) return;
  try { const v = await NET_BE.getVersion(ONLINE.id); if (v > ONLINE.version) netRefresh(); else if (together()) tgTick(); else if (G && !G.over && cur().kind === 'cpu') afterSync(); else if (G) renderWaiting(); } catch (e) {}
}
async function netRefresh(force) {
  if (!ONLINE || (!force && !together() && (ONLINE.pushing || ONLINE.dirty))) return;
  try { const row = await NET_BE.getGame(ONLINE.id); if (ONLINE && (force || row.version > ONLINE.version)) applyRow(row); } catch (e) {}
}

/* ---------- applying server state ---------- */
function applyRow(row) {
  ONLINE.row = row; ONLINE.version = row.version;
  if (row.status === 'lobby') { renderLobby(); return; }
  if (row.state && row.state.together) { tgApply(row); return; }
  const wasOpen = !$('#game').hidden;
  G = migrateGame(row.state);
  if (!wasOpen) enterGame(); else { renderAll(); if (openLoc >= 0 && previewing()) refreshLoc(); }
  $('#net-chip').hidden = false; $('#net-chip').textContent = 'Online';
  renderCodeBox();
  afterSync();
}
function afterSync() {
  if (!ONLINE || !G) return;
  clearTimeout(ONLINE.cpuT);
  if (G.over) { hideWaiting(); if (!ONLINE.victoryShown) { ONLINE.victoryShown = true; showVictory(); } return; }
  const p = cur();
  if (p.kind === 'cpu') {
    if (busy) return;
    const age = Date.now() - new Date(ONLINE.row.updated_at).getTime();
    if (age > 12000) { hideWaiting(); runCPU(p); }           // nobody is driving this CPU: take over
    else { renderWaiting(); ONLINE.cpuT = setTimeout(() => netRefresh(true), 13000 - age); }
    return;
  }
  if (isMine(p)) {
    hideWaiting();
    if (G.turnKey !== turnKey() && !busy) { closeModal(true); showIntro(p); }
    return;
  }
  renderWaiting();
}

/* ---------- pushing local changes ---------- */
function onlineSave() {
  if (!ONLINE || !G) return;
  ONLINE.dirty = true;
  clearTimeout(ONLINE.flushT);
  ONLINE.flushT = setTimeout(onlineFlush, 200);
}
async function onlineFlush() {
  if (!ONLINE || ONLINE.pushing || !ONLINE.dirty) return;
  if (together()) { tgFlush(); return; }
  ONLINE.pushing = true; ONLINE.dirty = false;
  const o = ONLINE, snap = JSON.parse(JSON.stringify(G));
  if (snap.log.length > LOG_MAX) snap.log = snap.log.slice(-LOG_MAX);
  try { o.version = await NET_BE.submit(o.id, o.version, snap); o.row = Object.assign({}, o.row, { updated_at:new Date().toISOString(), state:snap }); }
  catch (e) {
    o.pushing = false; o.dirty = false;
    if (ONLINE !== o) return;
    netToast(e); closeModal(true); busy = false;
    await netRefresh(true); return;
  }
  o.pushing = false;
  if (ONLINE === o && o.dirty) onlineFlush();
}

/* ---------- waiting for someone else ---------- */
function timeLeftMs() {
  const h = +(ONLINE.row.lobby.timerHours || 0); if (!h || !ONLINE.row.turn_started_at) return null;
  return new Date(ONLINE.row.turn_started_at).getTime() + h * 3600e3 - Date.now();
}
function fmtDur(ms) { const m = Math.max(0, Math.round(ms / 60000)); const d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`; }
function renderWaiting() {
  if (!ONLINE || !G || G.over) return;
  if (G.together) { tgRenderWaiting(); return; }
  const p = cur(); if (isMine(p)) { hideWaiting(); return; }
  const bar = $('#cpubar');
  const left = timeLeftMs();
  const timer = left == null ? '' : left > 0 ? ` · ${fmtDur(left)} left on the clock` : ' · out of time';
  const what = p.kind === 'cpu' ? `<b>${esc(p.name)}</b> (CPU) is taking their week<span class="dots"></span>` : `Waiting for <b>${esc(p.name)}</b> to take their week${timer}`;
  bar.innerHTML = `<span class="l">${portrait(p, 30)}<span>${what}</span></span>` +
    (p.kind !== 'cpu' && left != null && left <= 0 ? `<button class="btn sm warn" id="btn-skipturn">Skip ${esc(p.name)}'s week</button>` : '');
  bar.hidden = false; bar.classList.add('waiting');
  const sk = $('#btn-skipturn'); if (sk) sk.onclick = skipTurn;
}
/* small room-code box in the map corner; click to copy */
function renderCodeBox() {
  let b = $('#codebox');
  if (!ONLINE) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('button'); b.id = 'codebox'; b.className = 'codebox'; $('#mapwrap').appendChild(b); b.onclick = () => copyText(ONLINE.code); }
  b.title = 'Room code. Click to copy.';
  b.innerHTML = `<small>Room</small>${esc(ONLINE.code)}`;
}
function hideWaiting() { const bar = $('#cpubar'); if (bar.classList.contains('waiting')) { bar.hidden = true; bar.classList.remove('waiting'); } }
function skipTurn() {
  if (!ONLINE || !turnAllowed(ONLINE.row, ONLINE.uid, Date.now())) { toast("Their time isn't up yet.", 'bad'); return; }
  const p = cur();
  addLog(p, `${p.name} ran out of time, so their week was skipped.`);
  hideWaiting();
  endTurnUI(true);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied!', 'good'); }
  catch (e) { toast(`Copy this: ${t}`); }
}

/* ---------- lobby ---------- */
function inviteLink() { return location.origin + location.pathname + '?join=' + ONLINE.code; }
function renderLobby() {
  if (setup && setup.editing === ONLINE.id && !$('#setup').hidden) return;   // host is mid-edit; don't yank the screen away
  show('lobby');
  const row = ONLINE.row, L = row.lobby, host = row.host === ONLINE.uid;
  const seats = host ? padSeats(L.seats) : L.seats.filter(s => s.kind !== 'off');
  const open = L.seats.filter(s => s.kind === 'invite' && !s.uid).length;
  const players = L.seats.filter(s => s.kind !== 'off').length;
  const seatHTML = seats.map((s, idx) => {
    const i = host ? idx : L.seats.indexOf(s);
    if (s.kind === 'off') {
      return `<div class="lseat off"><div><b>Empty seat</b><span>Add another player</span>
        <div class="lseat-ctl"><button class="btn sm" data-seat="${i}" data-set-kind="invite">+ Friend</button><button class="btn sm alt" data-seat="${i}" data-set-kind="cpu">+ CPU</button></div></div></div>`;
    }
    const who = s.kind === 'cpu' ? `${CHARS.find(c => c.id === s.avatar)?.first || 'CPU'} Jones` : s.uid ? s.name : 'Open seat';
    const sub = s.kind === 'cpu' ? `CPU · ${PERSONAS[s.persona]?.label || ''} · ${DIFFS[s.diff]?.label || ''}` : s.kind === 'host' ? `Host · ${TRAITS[s.trait]?.name || ''}` : s.uid ? `Friend · ${TRAITS[s.trait]?.name || ''}` : 'Waiting for a friend to join…';
    const me = s.uid === ONLINE.uid ? ' <span class="chip good">You</span>' : '';
    let ctl = '';
    if (host && i > 0 && !s.uid) {
      ctl = `<div class="lseat-ctl"><div class="seg" role="group" aria-label="Seat ${i + 1} type">${['invite', 'cpu', 'off'].map(k => `<button data-seat="${i}" data-set-kind="${k}" aria-pressed="${s.kind === k}">${{ invite:'Friend', cpu:'CPU', off:'Remove' }[k]}</button>`).join('')}</div>` +
        (s.kind === 'cpu' ? `<select data-seat="${i}" data-set="persona" aria-label="Personality">${Object.entries(PERSONAS).map(([k, p]) => `<option value="${k}" ${s.persona === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select>` +
          `<select data-seat="${i}" data-set="diff" aria-label="Difficulty">${Object.entries(DIFFS).map(([k, d]) => `<option value="${k}" ${s.diff === k ? 'selected' : ''}>${d.label}</option>`).join('')}</select>` : '') + `</div>`;
    }
    return `<div class="lseat ${s.uid || s.kind === 'cpu' ? '' : 'open'}" style="--pc:${s.color}"><img src="assets/tok/${s.avatar}.webp" alt=""><div><b>${esc(who)}</b>${me}<span>${esc(sub)}</span>${ctl}</div></div>`;
  }).join('');
  const g = L.goals;
  $('#lobby-body').innerHTML = `
    <div class="setup-head"><h1>Game lobby</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${host ? '<button class="btn plum sm" id="btn-lobby-edit">Edit game settings</button>' : ''}<button class="btn alt sm" id="btn-lobby-back">Your games</button></div></div>
    <div class="card lobby-code">
      <span class="eyebrow">Invite code</span>
      <div class="bigcode">${esc(row.code)}</div>
      <p>Friends open the game, choose <b>Play online</b>, and enter this code. Or send them the link.</p>
      <div class="joinrow"><input type="text" readonly value="${esc(inviteLink())}" id="invite-link" aria-label="Invite link"><button class="btn" id="btn-copy-link">Copy link</button><button class="btn alt" id="btn-copy-code">Copy code</button></div>
    </div>
    <div class="lseats">${seatHTML}</div>
    <div class="card ocard lobby-rules"><span>Goals: wealth ${fmt$(g.wealth * WEALTH_UNIT)}, happiness ${g.happiness}, education ${g.education}, career ${g.career}${g.health ? `, health ${g.health}` : ''}</span>
      <span>${L.mode === 'together' ? 'Everyone plays at once' : 'Take turns'} · ${L.weekLimit ? `${L.weekLimit}-week limit` : 'No week limit'} · ${(TIMERS.find(t => t[0] === +L.timerHours)?.[1] || 'No turn timer').replace('per turn', L.mode === 'together' ? 'per week' : 'per turn')}</span></div>
    <div class="setup-go">${host
      ? `<span class="muted">${players} player${players > 1 ? 's' : ''}. ${open ? `${open} seat${open > 1 ? 's are' : ' is'} still open. Start now and they'll be played by CPUs.` : 'Everyone is here.'}</span><button class="btn go" id="btn-lobby-start">Start the game</button>`
      : `<span class="muted">Waiting for the host to start the game…</span>`}</div>`;
  $('#btn-lobby-back').onclick = () => { leaveOnline(); showOnlineHub(); };
  $('#btn-copy-link').onclick = () => copyText(inviteLink());
  $('#btn-copy-code').onclick = () => copyText(row.code);
  const st = $('#btn-lobby-start'); if (st) st.onclick = hostStart;
  const ed = $('#btn-lobby-edit'); if (ed) ed.onclick = editLobbySettings;
  const body = $('#lobby-body');
  body.onclick = e => { const b = e.target.closest('[data-set-kind]'); if (!b || b.getAttribute('aria-pressed') === 'true') return; body.querySelectorAll('[data-set-kind]').forEach(x => x.disabled = true); hostEditSeat(+b.dataset.seat, { kind:b.dataset.setKind }); };
  body.onchange = e => { const t = e.target.closest('[data-set]'); if (t) hostEditSeat(+t.dataset.seat, { [t.dataset.set]:t.value }); };
}
async function hostStart() {
  const btn = $('#btn-lobby-start'); btn.disabled = true;
  try {
    const row = await NET_BE.getGame(ONLINE.id); const L = row.lobby;
    const players = L.seats.filter(s => s.kind !== 'off').map(s => {
      const human = s.kind === 'host' || (s.kind === 'invite' && s.uid);
      const persona = s.persona || 'grinder';
      return { kind: human ? 'human' : 'cpu', name: human ? (s.name || 'Player') : `${CHARS.find(c => c.id === s.avatar)?.first || 'CPU'} Jones`,
        trait: s.trait || 'hustler', persona, diff: s.diff || 'normal', color:s.color, avatar:s.avatar, skin:SKINS[0], hair:0, hairColor:HAIRC[0], uid: human ? s.uid : null };
    });
    newGame({ players, goals:L.goals, weekLimit:L.weekLimit, settings:{ speed:prefs.speed, hints:prefs.hints } });
    G.players.forEach((p, i) => { p.uid = players[i].uid; addLog(p, `${p.name} moved into ${HOUSING.rust.name}.`); });
    G.online = { code:row.code };
    if (L.mode === 'together') {
      try { await NET_BE.togetherReady(); } catch (e) { throw e.code === 'needs_update' ? e : Object.assign(new Error('needs_update'), { code:'needs_update' }); }
      G.together = true;
      tgRunCPUs();                                    // CPUs play week 1 right away
      ONLINE.pendingLog = [];
    }
    ONLINE.version = await NET_BE.startGame(ONLINE.id, JSON.parse(JSON.stringify(G)));
    await netRefresh(true);
  } catch (e) { netToast(e); btn.disabled = false; }
}
