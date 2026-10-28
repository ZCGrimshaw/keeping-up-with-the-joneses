/* ===================== Online play: everyone at once =====================
   Every human plays their own week at the same time and saves only their own seat. When the last
   seat is done the week rolls over (the finishing client runs it; anyone can take over), and everybody
   sees the week compared. CPUs play their weeks instantly when the week begins.
   Spinning the casino wheel pauses the table: rivals may insure against one outcome, then the spinner settles it. */

const together = () => !!(ONLINE && G && G.together);
const mySeat = () => (ONLINE && G) ? G.players.findIndex(p => p.uid === ONLINE.uid) : -1;
const humanSeats = () => G.players.filter(p => p.kind === 'human').map(p => p.id);
const wheelOpen = () => !!(G && G.wheel && G.wheel.status === 'open');
const reseedFor = (st, seat) => ((st.seed | 0) + st.week * 7919 + (seat + 1) * 104729) | 0;
const tgClone = o => JSON.parse(JSON.stringify(o));

/* ---------- applying server state ---------- */
function tgApply(row) {
  const o = ONLINE, st = row.state, me = st.players.findIndex(p => p.uid === o.uid);
  const wasOpen = !$('#game').hidden;
  const same = !!(G && G.together && wasOpen && G.week === st.week && !G.over);
  if (!same) {
    tgUnstash(true);
    G = migrateGame(st); G.turn = Math.max(0, me); G.seed = reseedFor(st, me);
    o.pendingLog = []; o.myChoice = o.myChoice || {}; o.skipAsked = false;
    if (G.wheel && G.wheel.status === 'done') { o.shownWheel = o.appliedWheel = G.wheel.id; }
    if (!wasOpen) enterGame(); else { closeModal(true); renderAll(); }
  } else {
    const keep = G.players[me];
    G.players = st.players.map((q, i) => i === me ? keep : q);
    if (st.wheel && st.wheel.status === 'done' && o.appliedWheel !== st.wheel.id) { G.players[me] = st.players[me]; o.appliedWheel = st.wheel.id; }   // the wheel may have changed me
    G.wheel = st.wheel || null; G.over = st.over || null;
    G.log = (st.log || []).concat(o.pendingLog);
    renderAll();
  }
  $('#net-chip').hidden = false; $('#net-chip').textContent = 'Online';
  renderCodeBox();
  if (!o.tick) o.tick = setInterval(tgTick, 1000);
  tgAfterSync();
}
function tgAfterSync() {
  if (!ONLINE || !G || !G.together) return;
  const me = cur();
  if (G.over) { hideWaiting(); tgUnstash(true); if (!ONLINE.victoryShown) { ONLINE.victoryShown = true; showVictory(); } return; }
  tgWheelSync();
  if (wheelOpen()) return;
  if (!me.done) hideWaiting();
  if (!me.done && me.introWeek !== G.week) {
    if (!modalState || modalState.label !== 'Start of week') { if (ONLINE.stash) return; closeModal(true); showIntro(me); }
    return;
  }
  if (me.done) { renderWaiting(); tgCheckAdvance(); } else hideWaiting();
}
function tgTick() {
  const o = ONLINE; if (!o || !G || !G.together || G.over) return;
  tgWheelSync();
  o.ticks = (o.ticks || 0) + 1;
  if (cur().done && o.ticks % 5 === 0) { renderWaiting(); tgCheckAdvance(); }
}

/* ---------- saving my seat ---------- */
async function tgFlush() {
  const o = ONLINE; if (!o || !G || o.pushing) return;
  o.pushing = true; o.dirty = false;
  const me = mySeat(), snap = tgClone(G.players[me]), log = o.pendingLog.splice(0), week = G.week;
  try { await NET_BE.submitSeat(o.id, me, week, snap, log); }
  catch (e) {
    o.pushing = false; o.pendingLog.unshift(...log);
    if (ONLINE !== o) return;
    if (e.code === 'conflict') { o.pendingLog = []; await netRefresh(true); return; }   // the week moved on without us
    netToast(e); return;
  }
  o.pushing = false;
  if (ONLINE === o && o.dirty) tgFlush();
}
async function tgFlushNow() {
  const o = ONLINE; if (!o) return;
  clearTimeout(o.flushT); o.dirty = true;
  for (let n = 0; n < 100 && o.pushing; n++) await sleep(50);
  await tgFlush();
}

/* ---------- ending my week, rolling the week over ---------- */
async function tgEndWeek() {
  if (busy || !G || G.over) return;
  const p = cur(); if (p.done || !isMine(p) || wheelOpen()) return;
  closeModal(true);
  addLog(p, `${p.name} called it a week with ${p.hours}h to spare.`);
  p.done = true;
  ONLINE.justEnded = true;
  await tgFlushNow();
  renderAll(); renderWaiting();
  tgCheckAdvance();
}
function tgTimerUp(row) {
  const h = +((row || ONLINE.row).lobby.timerHours || 0), t = (row || ONLINE.row).turn_started_at;
  return !!(h && t && new Date(t).getTime() + h * 3600e3 < Date.now());
}
function tgCheckAdvance() {
  const o = ONLINE; if (!o || !G || G.over || o.advT || o.advancing) return;
  if (!(G.players.every(p => p.done) || (tgTimerUp() && cur().done && o.skipAsked))) return;   // stragglers are only skipped when someone asks
  const rank = Math.max(0, humanSeats().indexOf(mySeat()));
  const wait = o.justEnded ? 0 : 2500 + rank * 2500;     // whoever finished last goes first; the rest are backups
  o.justEnded = false;
  o.advT = setTimeout(() => { o.advT = null; tgAdvance(); }, wait);
}
/* CPUs play their week all at once, at the start of the week. */
function tgRunCPUs() {
  for (const p of G.players) {
    if (p.kind !== 'cpu') continue;
    if (p.event) { const ch = cpuEventChoice(p), e = EVENTS[p.event], r = resolveEvent(p, ch); if (r) addLog(p, `${p.name}: ${r.text}${e.choices ? ` Chose "${e.choices[ch].label}". ${r.result}` : ''}`); }
    cpuTurnInstant(p);
    p.done = true; p.introWeek = G.week;
  }
}
async function tgAdvance() {
  const o = ONLINE; if (!o || o.advancing || !G) return;
  o.advancing = true;
  try {
    for (let k = 0; k < 3; k++) {
      const row = await NET_BE.getGame(o.id);
      if (!row.state || row.state.week !== G.week) break;                       // someone else already rolled it over
      const up = tgTimerUp(row);
      if (!up && row.state.players.some(p => !p.done)) break;
      const keepG = G, keepLog = o.pendingLog; o.pendingLog = [];
      let out;
      try {
        G = migrateGame(row.state); G.turn = 0; G.seed = (G.seed ^ (Date.now() & 0x3fffffff)) | 0;
        { const base = G.jackpot ?? JACKPOT_SEED; let add = 0, hit = false;                // settle the shared progressive pool once a week
          for (const p of G.players) { add += p.jackAdd || 0; hit = hit || !!p.jackHit; p.jackAdd = 0; p.jackHit = false; }
          G.jackpot = hit ? JACKPOT_SEED : base + add; }
        for (const p of G.players) if (!p.done) { addLog(p, `${p.name} ran out of time, so their week was skipped.`); p.done = true; }
        endWeek();
        if (!G.over) tgRunCPUs();
        G.wheel = null;
        if (G.log.length > LOG_MAX) G.log = G.log.slice(-LOG_MAX);
        out = tgClone(G);
      } finally { G = keepG; o.pendingLog = keepLog; }
      try { await NET_BE.advanceWeek(o.id, row.version, out); break; }
      catch (e) { if (e.code === 'conflict') continue; if (e.code === 'not_ready') break; throw e; }
    }
  } catch (e) { netToast(e); }
  finally { o.advancing = false; }
  await netRefresh(true);
}

/* ---------- the waiting banner ---------- */
function tgRenderWaiting() {
  const bar = $('#cpubar'), me = cur();
  const left = tgTimerUp() ? 0 : (ONLINE.row.lobby.timerHours && ONLINE.row.turn_started_at ? timeLeftMs() : null);
  const todo = G.players.filter(p => !p.done);
  if (!me.done) { hideWaiting(); return; }
  const timer = left == null ? '' : left > 0 ? ` · ${fmtDur(left)} left on the clock` : ' · out of time';
  const who = todo.length ? `Waiting for ${todo.map(p => `<b>${esc(p.name)}</b>`).join(', ')} to finish the week${timer}` : 'Everyone is done. Wrapping up the week…';
  bar.innerHTML = `<span class="l">${portrait(me, 30)}<span>You're done for the week. ${who}</span></span>` +
    (todo.length && left != null && left <= 0 ? `<button class="btn sm warn" id="btn-skipturn">Skip the stragglers</button>` : '');
  bar.hidden = false; bar.classList.add('waiting');
  const sk = $('#btn-skipturn'); if (sk) sk.onclick = () => { ONLINE.skipAsked = true; ONLINE.justEnded = true; tgCheckAdvance(); };
}

/* ---------- the week, compared ---------- */
function compareHTML() {
  const rows = standings().filter(q => q.recap);
  if (!rows.length) return '';
  const cell = (v, money) => `<td class="${Math.round(v) > 0 ? 'up' : Math.round(v) < 0 ? 'down' : ''}">${signed(v, money)}</td>`;
  return `<section class="grp"><h3>Week ${rows[0].recap.week} compared</h3><div class="tablewrap"><table class="stk cmp"><thead><tr><th>Player</th><th>Earned</th><th>Spent</th><th>Net worth</th><th>Mood</th><th>Health</th><th>Stress</th><th>Goals</th></tr></thead><tbody>${rows.map(q => {
    const d = q.recap.d, you = q.uid === ONLINE.uid;
    return `<tr class="${you ? 'me' : ''}"><td class="tk"><span class="who">${portrait(q, 24)}<b>${esc(q.name)}${you ? ' (you)' : ''}</b></span></td><td class="up">${fmt$(q.recap.earned)}</td><td class="down">${fmt$(q.recap.spent)}</td>${cell(d.nw, true)}${cell(d.hap)}${cell(d.hea)}${cell(-d.str)}<td><b>${Math.round(progress(q) * 100)}%</b></td></tr>`;
  }).join('')}</tbody></table></div></section>`;
}

/* ---------- pausing for the wheel ---------- */
function tgStash() {
  const o = ONLINE; if (o.stash) return;
  const m = $('#modal');
  o.stash = { html:m.innerHTML, state:modalState, hidden:m.hidden, loc:openLoc };
}
function tgUnstash(drop) {
  const o = ONLINE; if (!o || !o.stash) return;
  const s = o.stash; o.stash = null;
  if (drop) return;
  const m = $('#modal'); m.innerHTML = s.html; m.hidden = s.hidden; modalState = s.state; openLoc = s.loc;
  if (CAS && !CAS.spinning && !s.hidden) refreshGame();
}
function tgWheelSync() {
  const o = ONLINE, w = G.wheel, me = mySeat();
  if (!w) return;
  o.wheelSeen = o.wheelSeen || {};
  if (w.status === 'open') {
    if (!o.wheelSeen[w.id]) o.wheelSeen[w.id] = Date.now();
    const left = Math.max(0, w.window * 1000 - (Date.now() - o.wheelSeen[w.id]));
    const decided = s => w.insured[s] || w.passed.includes(s);
    const waitingOn = humanSeats().filter(s => s !== w.by && !decided(s));
    if (w.by === me) {
      if (CAS && CAS.wheel) { CAS.wheel.pending = true; const note = waitingOn.length ? `The table is paused while rivals decide on insurance (${Math.ceil(left / 1000)}s)…` : 'Everyone has decided. Spinning…'; if (CAS.wheel.note !== note) { CAS.wheel.note = note; if (!o.stash) refreshGame(); } }
      if ((!waitingOn.length || left <= 0) && !o.wheelFinishing) { clearTimeout(o.wheelT); o.wheelT = setTimeout(tgWheelFinish, waitingOn.length ? 0 : 500); }
    } else {
      if (me >= 0 && G.players[me].kind === 'human') tgInsureModal(w, decided(me), left);
      const stale = Date.now() - o.wheelSeen[w.id] > (w.window + 20) * 1000;
      if (stale && !o.wheelFinishing) tgWheelFinish();        // the spinner vanished; settle it for them
    }
  } else if (w.status === 'done' && o.shownWheel !== w.id) {
    o.shownWheel = w.id; tgWheelResult(w);
  }
}
function tgInsureModal(w, decided, left) {
  const o = ONLINE, me = cur(), by = G.players[w.by];
  if (!o.stash) tgStash();
  const closed = left <= 0, mine = w.insured[me.id] || o.myChoice[w.id];
  const state = (decided || o.myChoice[w.id] !== undefined) ? 'done' : closed ? 'late' : 'open';
  const sig = w.id + '|' + state + '|' + (mine || '');
  const secs = Math.ceil(left / 1000);
  if (o.insSig === sig && modalState && modalState.label === 'Wheel pause') { const t = document.getElementById('ins-left'); if (t) t.textContent = secs; return; }
  o.insSig = sig;
  const liquid = me.cash + me.bank, cost = insurancePremium(me);
  const richest = G.players.slice().sort((a, b) => netWorth(b) - netWorth(a))[0] === me;
  let body;
  if (state !== 'open') {
    body = `<p class="big">${mine ? `You're covered against <b>${INSURABLE[mine].label}</b>.` : state === 'late' ? 'Too late for insurance this time.' : 'No insurance this time.'}</p><p class="muted">Waiting for the spin…</p>`;
  } else {
    const opts = Object.entries(INSURABLE).filter(([k]) => k !== 'karma' || richest);
    body = `<p>Pick <b>one</b> outcome to insure against. The premium is <b>${fmt$(cost)}</b> (15% of the ${fmt$(liquid)} in your wallet and bank), paid either way. If the wheel lands there and you're the target, it's blocked.</p>
      <div class="acts">${opts.map(([k, v]) => `<button class="act" data-ins="${k}" ${cost > liquid || cost < 1 ? 'disabled' : ''}><span class="act-t">${v.label}</span><span class="act-d">${esc(v.text)}</span><span class="chips"><span class="chip cost">${fmt$(cost)}</span></span></button>`).join('')}
      <button class="act" data-ins="none"><span class="act-t">No thanks</span><span class="act-d">Keep your money and take your chances.</span></button></div>
      <p class="muted">Closes in <span id="ins-left">${secs}</span>s.</p>`;
  }
  const html = `<div class="mhead"><div class="ttl"><h2>🎡 ${esc(by.name)} is spinning the wheel</h2><p>The game is paused until it lands.</p></div></div><div class="mbody">${body}</div>`;
  const card = $('#modal .modal-card');
  if (modalState && modalState.label === 'Wheel pause' && card) card.innerHTML = html;
  else openModal(html, { locked:true, cls:'narrow', label:'Wheel pause' });
  $('#modal').querySelectorAll('[data-ins]').forEach(b => b.onclick = e => { e.stopPropagation(); tgInsure(w, b.dataset.ins); });
}
async function tgInsure(w, k) {
  const o = ONLINE, me = cur();
  if (o.myChoice[w.id] !== undefined) return;
  const outcome = k === 'none' ? null : k;
  let paid = 0;
  if (outcome) {
    const cost = insurancePremium(me); if (cost < 1 || cost > me.cash + me.bank) return;
    paid = cost; spend(me, cost); addLog(me, `${me.name} bought insurance against ${INSURABLE[outcome].label} for ${fmt$(cost)}.`);
  }
  o.myChoice[w.id] = outcome;
  tgInsureModal(w, true, Math.max(0, w.window * 1000 - (Date.now() - o.wheelSeen[w.id])));
  try { await tgFlushNow(); await NET_BE.wheelChoice(o.id, me.id, outcome, outcome ? tgClone(me) : null); }
  catch (e) {
    if (e.code === 'wheel_closed' && outcome) { me.cash += paid; me.ledger.spent -= paid; toast('The wheel landed first, so your premium was refunded.'); save(); renderAll(); }   // too late
    else if (e.code !== 'wheel_closed') netToast(e);
  }
}
async function tgWheelSpin() {
  const p = cur(), c = CAS;
  const a = actionsFor(p).find(x => x.id === 'wheel_spin'); if (!a) return;
  const why = canDo(p, a); if (why) { toast(why, 'bad'); return; }
  if (wheelOpen()) { toast('The wheel is already spinning.', 'bad'); return; }
  const msg = doAction(p, a);
  addLog(p, named(p, msg));
  c.wheel = { angle:0, msg:'', revealed:false, pending:true, note:'Starting the spin…' };
  refreshGame(); renderSide();
  try { await tgFlushNow(); await NET_BE.wheelStart(ONLINE.id, p.id, tgClone(p)); await netRefresh(true); }
  catch (e) { netToast(e); c.wheel = null; p.wheelSpun = false; refreshGame(); }
}
async function tgWheelFinish() {
  const o = ONLINE; if (!o || o.wheelFinishing) return;
  o.wheelFinishing = true;
  try {
    for (let k = 0; k < 3; k++) {
      const row = await NET_BE.getGame(o.id), w = row.state && row.state.wheel;
      if (!w || w.status !== 'open') break;
      const keepG = G, keepLog = o.pendingLog; o.pendingLog = [];
      let out;
      try {
        G = migrateGame(row.state); G.seed = (G.seed ^ (Date.now() & 0x3fffffff)) | 0;
        const spinner = G.players[w.by], insured = {};
        for (const s in w.insured) insured[+s] = w.insured[s];
        const r = spinWheel(spinner, insured);
        spinner.lastWheel = r.id;
        addLog(spinner, named(spinner, r.msg));
        G.wheel = Object.assign({}, w, { status:'done', result:r.id, msg:r.msg, blocked:r.blocked });
        out = tgClone(G);
      } finally { G = keepG; o.pendingLog = keepLog; }
      try { await NET_BE.wheelFinish(o.id, row.version, out); break; }
      catch (e) { if (e.code === 'conflict') continue; if (e.code === 'wheel_closed' || e.code === 'not_your_turn') break; throw e; }
    }
  } catch (e) { netToast(e); }
  finally { o.wheelFinishing = false; }
  await netRefresh(true);
}
function tgWheelResult(w) {
  const o = ONLINE, by = G.players[w.by], mine = w.by === mySeat();
  if (!o.stash) tgStash();
  const idx = WHEEL.findIndex(s => s.id === w.result), n = WHEEL.length, a = 360 / n, r = 150;
  const segs = WHEEL.map((s, i) => {
    const a0 = (i * a - 90) * Math.PI / 180, a1 = ((i + 1) * a - 90) * Math.PI / 180;
    const x0 = 160 + r * Math.cos(a0), y0 = 160 + r * Math.sin(a0), x1 = 160 + r * Math.cos(a1), y1 = 160 + r * Math.sin(a1), mid = i * a + a / 2;
    return `<path d="M160 160 L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${s.color}" ${sw(3)}/>` +
      `<g transform="rotate(${mid} 160 160)"><text x="160" text-anchor="middle" class="svgdisp" font-size="13" fill="#fff" stroke="#2a1f3d" stroke-width="3" paint-order="stroke">` +
      s.label.split(' ').map((wd, k, arr) => `<tspan x="160" y="${160 - r * .68 + (k - (arr.length - 1) / 2) * 15 + 5}">${wd}</tspan>`).join('') + `</text></g>`;
  }).join('');
  const angle = 360 * 6 - (idx * a + a / 2) + (Math.random() - .5) * a * .6;
  const text = mine ? you(w.msg) : named(by, w.msg);
  const insuredNames = Object.keys(w.insured || {}).map(s => G.players[+s].name);
  openModal(`<div class="mhead"><div class="ttl"><h2>🎡 ${esc(by.name)}'s spin</h2><p>${insuredNames.length ? `Insured: ${esc(insuredNames.join(', '))}` : 'Nobody bought insurance.'}</p></div></div>
    <div class="mbody"><div class="wheelbox"><svg viewBox="0 0 320 340" class="wheel" role="img" aria-label="Prize wheel"><g id="wheel-r" style="transform-origin:160px 160px">${segs}<circle cx="160" cy="160" r="20" fill="#ffc93c" ${sw(4)}/></g><path d="M160 6 L146 -14 L174 -14 Z" fill="#2a1f3d" transform="translate(0 22)"/></svg></div>
      <div class="cas-msg" id="wheel-res" aria-live="polite">Round and round it goes…</div></div>
    <div class="mfoot"><button class="btn go" id="btn-wheel-ok" disabled>Continue</button></div>`, { locked:true, cls:'narrow', label:'Wheel result' });
  const g = document.getElementById('wheel-r'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (g && !reduce) { g.style.transform = 'rotate(0deg)'; g.getBoundingClientRect(); g.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.15,1)'; g.style.transform = `rotate(${angle}deg)`; }
  setTimeout(() => {
    const res = document.getElementById('wheel-res'), ok = document.getElementById('btn-wheel-ok'); if (!res || !ok) return;
    res.textContent = text; res.classList.toggle('win', mine && w.result !== 'nothing'); ok.disabled = false; ok.focus();
    ok.onclick = () => { closeModal(true); tgUnstash(); renderAll(); tgAfterSync(); };
    if (w.result === 'regret') confetti();
    renderAll();
  }, reduce ? 50 : 4400);
}
