/* ===================== Lucky Loophole Casino: slots, blackjack, the wheel ===================== */
const SLOT_SYMS = [{ id:'cherry', w:5 }, { id:'lemon', w:5 }, { id:'star', w:4 }, { id:'bell', w:3 }, { id:'bar', w:2 }, { id:'seven', w:1 }];
const SLOT_PAY = { seven:100, bar:40, bell:25, star:15, lemon:10, cherry:8 };
const SLOT_NAMES = { seven:'Lucky 7', bar:'BAR', bell:'Bell', star:'Star', lemon:'Lemon', cherry:'Cherry' };
const JACKPOT_SEED = 250, JACKPOT_CUT = .01;
const jackpot = () => { if (G.jackpot == null) G.jackpot = JACKPOT_SEED; return G.jackpot; };
const SLOT_MIN = 6, BJ_MIN = 12;   // minutes per pull / per hand: 10 pulls or 5 hands an hour
const minsLeft = p => p.hours * 60 - (p.casMin || 0);
function useMinutes(p, m) { p.casMin = (p.casMin || 0) + m; while (p.casMin >= 60 && p.hours > 0) { p.casMin -= 60; p.hours--; } }
function fmtTime(p) { const m = Math.max(0, minsLeft(p)); return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; }
const SLOT_BETS = [5, 25, 100], BJ_BETS = [10, 50, 200];
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let CAS = null;

function slotRoll() {
  const tot = SLOT_SYMS.reduce((t, s) => t + s.w, 0);
  return [0, 1, 2].map(() => { let r = rng() * tot; for (const s of SLOT_SYMS) { r -= s.w; if (r <= 0) return s.id; } return 'cherry'; });
}
function slotPayout(r, bet) {
  if (r[0] === r[1] && r[1] === r[2]) return bet * SLOT_PAY[r[0]];
  return r.filter(x => x === 'cherry').length === 2 ? bet * 3 : 0;
}
function symSVG(id) {
  const s = sw(3);
  const body = {
    cherry: `<path d="M30 14 Q38 6 46 10 M30 14 Q26 26 20 34 M30 14 Q34 26 42 36" fill="none" ${s}/><path d="M34 10 q8 -6 12 0 q-6 4 -12 0z" fill="#5cb85c" ${sw(2)}/><circle cx="20" cy="40" r="10" fill="#e5383b" ${s}/><circle cx="42" cy="42" r="10" fill="#e5383b" ${s}/><circle cx="17" cy="37" r="2.5" fill="#fff"/><circle cx="39" cy="39" r="2.5" fill="#fff"/>`,
    lemon: `<ellipse cx="30" cy="32" rx="20" ry="15" fill="#ffd93b" ${s}/><path d="M10 32 l-4 -2 M50 32 l4 -2" ${s}/><path d="M20 26 q6 -4 12 -2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    star: `<path d="M30 8 L36 23 L52 24 L40 35 L44 51 L30 42 L16 51 L20 35 L8 24 L24 23 Z" fill="#ffc93c" ${s}/>`,
    bell: `<path d="M30 10 C18 10 16 22 16 32 L12 42 H48 L44 32 C44 22 42 10 30 10 Z" fill="#f2a900" ${s}/><circle cx="30" cy="46" r="5" fill="#f2a900" ${s}/><circle cx="30" cy="8" r="3" fill="#f2a900" ${sw(2)}/>`,
    bar: `<rect x="6" y="20" width="48" height="22" rx="4" fill="#2a1f3d" ${s}/><text x="30" y="32" text-anchor="middle" dominant-baseline="central" class="svgdisp" font-size="16" fill="#fff">BAR</text>`,
    seven: `<text x="30" y="33" text-anchor="middle" dominant-baseline="central" class="svgdisp" font-size="46" fill="#e5383b" stroke="#2a1f3d" stroke-width="3" paint-order="stroke">7</text>`,
  }[id];
  return `<svg viewBox="0 0 60 60" aria-label="${SLOT_NAMES[id]}" role="img">${body}</svg>`;
}

/* ---------- blackjack ---------- */
function bjCard() { return { r:Math.floor(rng() * 13), s:Math.floor(rng() * 4) }; }
function bjValue(hand) {
  let v = 0, aces = 0;
  for (const c of hand) { if (c.r === 0) { aces++; v += 11; } else v += Math.min(10, c.r + 1); }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}
const bjIsBJ = h => h.length === 2 && bjValue(h) === 21;
function cardHTML(c, hidden) {
  if (hidden) return '<span class="pcrd back" aria-label="Face-down card"></span>';
  const red = c.s === 1 || c.s === 2;
  return `<span class="pcrd ${red ? 'red' : ''}" aria-label="${RANKS[c.r]} of ${['spades', 'hearts', 'diamonds', 'clubs'][c.s]}"><b>${RANKS[c.r]}</b><i>${SUITS[c.s]}</i></span>`;
}
function bjDeal() {
  const p = cur(), bet = CAS.bet;
  if (minsLeft(p) < BJ_MIN) { CAS.msg = "You're out of time this week. The dealer waves goodnight."; CAS.win = 'lose'; return; }
  if (!afford(p, bet)) { CAS.msg = `You need ${fmt$(bet)} to play this hand.`; return; }
  spend(p, bet); CAS.net -= bet; CAS.rounds++; useMinutes(p, BJ_MIN);
  CAS.bj = { player:[bjCard(), bjCard()], dealer:[bjCard(), bjCard()], bet, phase:'play' };
  CAS.msg = '';
  const b = CAS.bj;
  if (bjIsBJ(b.player) || bjIsBJ(b.dealer)) bjFinish();
}
function bjHit() { const b = CAS.bj; b.player.push(bjCard()); if (bjValue(b.player) >= 21) bjFinish(); }
function bjDouble() {
  const p = cur(), b = CAS.bj;
  if (b.player.length !== 2 || !afford(p, b.bet)) return;
  spend(p, b.bet); CAS.net -= b.bet; b.bet *= 2; b.player.push(bjCard()); bjFinish();
}
function bjFinish() {
  const p = cur(), b = CAS.bj, pv = bjValue(b.player);
  if (pv <= 21 && !bjIsBJ(b.player)) while (bjValue(b.dealer) < 17) b.dealer.push(bjCard());
  const dv = bjValue(b.dealer);
  let pay = 0, msg;
  if (pv > 21) msg = `Bust with ${pv}. The dealer takes ${fmt$(b.bet)}.`;
  else if (bjIsBJ(b.player) && !bjIsBJ(b.dealer)) { pay = Math.round(b.bet * 2.5); msg = `Blackjack! You win ${fmt$(pay - b.bet)}.`; }
  else if (bjIsBJ(b.dealer) && !bjIsBJ(b.player)) msg = 'Dealer has blackjack. Ouch.';
  else if (dv > 21) { pay = b.bet * 2; msg = `Dealer busts with ${dv}. You win ${fmt$(b.bet)}.`; }
  else if (pv > dv) { pay = b.bet * 2; msg = `${pv} beats ${dv}. You win ${fmt$(b.bet)}.`; }
  else if (pv === dv) { pay = b.bet; msg = `Push at ${pv}. Your bet comes back.`; }
  else msg = `Dealer's ${dv} beats your ${pv}.`;
  if (pay) { earn(p, pay); CAS.net += pay; }
  b.phase = 'done'; CAS.msg = msg; CAS.win = pay > b.bet ? 'win' : pay === b.bet ? 'push' : 'lose';
}

/* ---------- session ---------- */
function openGame(game) {
  CAS = { game, net:0, rounds:0, bet: game === 'slots' ? 25 : 50, reels:['seven', 'bar', 'bell'], bj:null, msg:'', spinning:false, wheel:null };
  openModal(gameHTML(), { label:'Casino', onClose:endSession });
}
function refreshGame() { const card = $('#modal .modal-card'); if (card && CAS) card.innerHTML = gameHTML(); }
function endSession() {
  if (!CAS) return;
  const p = cur(), c = CAS; CAS = null;
  if (c.game === 'bj' && c.bj && c.bj.phase === 'play') bjFinishQuiet(p, c);
  if (c.game !== 'wheel' && c.rounds) {
    const net = c.net, name = c.game === 'slots' ? 'the slots' : 'the blackjack table';
    if (net > 0) addHappy(p, Math.min(8, Math.round(net / 40) + 1));
    if (net < 0) { addStress(p, Math.min(12, Math.round(-net / 40) + 1)); addHappy(p, -Math.min(6, Math.round(-net / 80))); }
    addLog(p, `${p.name} left ${name} ${net >= 0 ? 'up' : 'down'} ${fmt$(Math.abs(net))} after ${c.rounds} ${c.game === 'slots' ? 'spin' : 'hand'}${c.rounds > 1 ? 's' : ''}.`);
    toast(`You left ${name} ${net >= 0 ? 'up' : 'down'} ${fmt$(Math.abs(net))}.`, net > 0 ? 'good' : net < 0 ? 'bad' : '');
  }
  normalize(p); save(); renderAll();
  if (p.hours <= 0 && !G.over) { toast("You're out of hours. That's the week!"); setTimeout(endTurnUI, 900); }
}
function bjFinishQuiet(p, c) { const keep = CAS; CAS = c; bjFinish(); CAS = keep; }
function backToFloor() { closeModal(true); if (cur().hours > 0) openLocation(LI.casino); }

/* ---------- rendering ---------- */
function gameHTML() {
  const p = cur(), c = CAS;
  const head = { slots:'Loophole Slots', bj:'Blackjack', wheel:"The Wheel of Somebody Else's Life" }[c.game];
  let body = '';
  if (c.game === 'slots') {
    const rows = SLOT_SYMS.slice().reverse().map(s => `<tr><td><span class="minisym">${symSVG(s.id)}${symSVG(s.id)}${symSVG(s.id)}</span></td><td class="num">× ${SLOT_PAY[s.id]}${s.id === 'seven' ? ' <span class="jp-tag">+ JACKPOT</span>' : ''}</td></tr>`).join('') +
      `<tr><td><span class="minisym">${symSVG('cherry')}${symSVG('cherry')}<em>any</em></span></td><td class="num">× 3</td></tr>`;
    body = `<div class="cas-row"><div class="slotmachine">
        <div class="jackpot"><span>Progressive jackpot</span><b class="lcd">${fmt$(Math.floor(jackpot()))}</b><small>${symSVG('seven')}${symSVG('seven')}${symSVG('seven')} wins it all</small></div>
        <div class="reels">${c.reels.map((s, i) => `<div class="reel" id="reel${i}">${symSVG(s)}</div>`).join('')}</div>
        <div class="cas-msg ${c.win || ''}" aria-live="polite">${esc(c.msg || 'Pick a bet and pull the lever.')}</div>
        <div class="cas-ctl">${betSeg(SLOT_BETS, c.bet)}<button class="btn" data-cas="spin" ${c.spinning ? 'disabled' : ''}>Spin ${fmt$(c.bet)} · ${SLOT_MIN} min</button></div>
      </div>
      <div class="paytable"><h3>Pays (× your bet)</h3><table>${rows}</table><p>1% of every spin feeds the progressive jackpot, shared by every player in town. Any bet size can win it. When it hits, it resets to ${fmt$(JACKPOT_SEED)}.</p></div></div>`;
  } else if (c.game === 'bj') {
    const b = c.bj;
    const dealerHTML = b ? b.dealer.map((cd, i) => cardHTML(cd, b.phase === 'play' && i === 1)).join('') : '';
    const dv = b ? (b.phase === 'play' ? '?' : bjValue(b.dealer)) : '';
    const ctl = !b || b.phase === 'done'
      ? `${betSeg(BJ_BETS, c.bet)}<button class="btn" data-cas="deal">Deal ${fmt$(c.bet)} · ${BJ_MIN} min</button>`
      : `<button class="btn" data-cas="hit">Hit</button><button class="btn alt" data-cas="stand">Stand</button><button class="btn alt" data-cas="double" ${b.player.length !== 2 || !afford(p, b.bet) ? 'disabled' : ''}>Double ${fmt$(b.bet)}</button>`;
    body = `<div class="felt">
        <div class="hand"><span class="hl">Dealer ${b ? `· ${dv}` : ''}</span><div class="cards">${dealerHTML || '<span class="pcrd ghost"></span><span class="pcrd ghost"></span>'}</div></div>
        <div class="cas-msg ${c.win || ''}" aria-live="polite">${esc(c.msg || (b && b.phase === 'play' ? 'Hit, stand or double?' : 'Place your bet. Dealer stands on all 17s.'))}</div>
        <div class="hand"><span class="hl">You ${b ? `· ${bjValue(b.player)}` : ''}${b && b.phase === 'play' ? ` · bet ${fmt$(b.bet)}` : ''}</span><div class="cards">${b ? b.player.map(cd => cardHTML(cd)).join('') : '<span class="pcrd ghost"></span><span class="pcrd ghost"></span>'}</div></div>
        <div class="cas-ctl">${ctl}</div></div>`;
  } else {
    const n = WHEEL.length, a = 360 / n, r = 150;
    const segs = WHEEL.map((s, i) => {
      const a0 = (i * a - 90) * Math.PI / 180, a1 = ((i + 1) * a - 90) * Math.PI / 180;
      const x0 = 160 + r * Math.cos(a0), y0 = 160 + r * Math.sin(a0), x1 = 160 + r * Math.cos(a1), y1 = 160 + r * Math.sin(a1);
      const mid = i * a + a / 2;
      return `<path d="M160 160 L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${s.color}" ${sw(3)}/>` +
        `<g transform="rotate(${mid} 160 160)"><text x="160" text-anchor="middle" class="svgdisp" font-size="13" fill="#fff" stroke="#2a1f3d" stroke-width="3" paint-order="stroke">` +
        s.label.split(' ').map((w, k, arr) => `<tspan x="160" y="${160 - r * .68 + (k - (arr.length - 1) / 2) * 15 + 5}">${w}</tspan>`).join('') + `</text></g>`;
    }).join('');
    const can = actionsFor(p).find(x => x.id === 'wheel_spin'), why = can ? canDo(p, can) : 'Not available';
    const done = c.wheel && c.wheel.revealed;
    body = `<div class="cas-row"><div class="wheelbox">
        <svg viewBox="0 0 320 340" class="wheel" role="img" aria-label="Prize wheel">
          <g id="wheel-g" style="transform-origin:160px 160px;transform:rotate(${c.wheel ? c.wheel.angle : 0}deg)">${segs}<circle cx="160" cy="160" r="20" fill="#ffc93c" ${sw(4)}/></g>
          <path d="M146 0 H174 L160 26 Z" fill="#ffc93c" ${sw(3)}/>
        </svg>
        <div class="cas-msg ${done && p.lastWheel !== 'nothing' ? 'win' : ''}" aria-live="polite">${esc(done ? c.wheel.msg : c.wheel ? (c.wheel.pending ? (c.wheel.note || 'The table is paused…') : 'Round and round it goes…') : 'One spin a week. The wheel is not drawn to scale.')}</div>
        <div class="cas-ctl">${c.wheel ? '' : `<button class="btn plum" data-cas="wheel" ${why ? `disabled title="${esc(why)}"` : ''}>Spin for $100 · 1h</button>`}${why && !c.wheel ? `<span class="why-inline">${esc(why)}</span>` : ''}</div>
      </div>
      <div class="paytable"><h3>Possible outcomes</h3><ul class="wheel-list">${WHEEL.map(s => `<li><i style="background:${s.color}"></i><span><b>${s.label}</b> ${esc(s.text)}</span></li>`).join('')}</ul></div></div>`;
  }
  const net = c.net;
  return `<div class="cas-head"><div><span class="eyebrow" style="color:#ffc93c">Lucky Loophole Casino</span><h2>${esc(head)}</h2></div>
      <div class="cas-stats"><span>Cash + bank <b class="lcd">${fmt$(p.cash + p.bank)}</b></span>${c.game !== 'wheel' ? `<span>This session <b class="lcd ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${net >= 0 ? '+' : '−'}${fmt$(Math.abs(net))}</b></span>` : ''}<span>Time left <b class="lcd">${fmtTime(p)}</b></span></div></div>
    <div class="mbody cas-body">${body}</div>
    <div class="mfoot"><span style="margin-right:auto;align-self:center;font-size:.85rem;color:var(--ink-2)">Winning lifts your mood; losing adds stress. Gamble responsibly, or at least entertainingly.</span><button class="btn alt" data-cas="back">Back to the casino floor</button></div>`;
}
function betSeg(bets, cur) { return `<div class="seg" role="group" aria-label="Bet">${bets.map(b => `<button data-cas="bet" data-v="${b}" aria-pressed="${b === cur}">${fmt$(b)}</button>`).join('')}</div>`; }

/* ---------- input ---------- */
function casinoClick(cmd, v) {
  if (!CAS) return;
  const p = cur();
  if (cmd === 'back') { backToFloor(); return; }
  if (cmd === 'bet') { if (CAS.game === 'bj' && CAS.bj && CAS.bj.phase === 'play') return; CAS.bet = +v; refreshGame(); return; }
  if (CAS.game === 'slots' && cmd === 'spin') return slotSpin();
  if (CAS.game === 'bj') {
    if (cmd === 'deal') bjDeal(); else if (cmd === 'hit') bjHit(); else if (cmd === 'stand') bjFinish(); else if (cmd === 'double') bjDouble();
    save(); refreshGame(); renderSide(); return;
  }
  if (CAS.game === 'wheel' && cmd === 'wheel') return together() ? tgWheelSpin() : wheelSpinUI();
}
function slotSpin() {
  const p = cur(), c = CAS;
  if (c.spinning) return;
  if (minsLeft(p) < SLOT_MIN) { c.msg = "You're out of time this week. The machine dims its lights."; c.win = 'lose'; refreshGame(); return; }
  if (!afford(p, c.bet)) { c.msg = `You need ${fmt$(c.bet)} for this spin.`; c.win = 'lose'; refreshGame(); return; }
  spend(p, c.bet); c.net -= c.bet; c.rounds++; useMinutes(p, SLOT_MIN);
  G.jackpot = jackpot() + c.bet * JACKPOT_CUT;
  if (G.together) p.jackAdd = (p.jackAdd || 0) + c.bet * JACKPOT_CUT;
  const res = slotRoll();
  const jp = res.every(x => x === 'seven') ? Math.floor(jackpot()) : 0;
  const pay = slotPayout(res, c.bet) + jp;
  if (jp) { G.jackpot = JACKPOT_SEED; if (G.together) p.jackHit = true; }
  c.spinning = true; c.msg = 'Spinning…'; c.win = '';
  refreshGame(); renderSide();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = [0, 1, 2].map(i => document.getElementById('reel' + i));
  els.forEach(e => e && e.classList.add('spin'));
  const ids = SLOT_SYMS.map(s => s.id);
  const tick = reduce ? null : setInterval(() => els.forEach((e, i) => { if (e && e.classList.contains('spin')) e.innerHTML = symSVG(ids[Math.floor(Math.random() * ids.length)]); }), 70);
  const stops = reduce ? [0, 0, 0] : [550, 850, 1150];
  stops.forEach((ms, i) => setTimeout(() => { const e = els[i]; if (e) { e.classList.remove('spin'); e.innerHTML = symSVG(res[i]); } }, ms));
  setTimeout(() => {
    clearInterval(tick);
    if (!CAS) return;
    c.reels = res; c.spinning = false;
    if (pay) { earn(p, pay); c.net += pay; }
    const three = res[0] === res[1] && res[1] === res[2];
    c.msg = jp ? `PROGRESSIVE JACKPOT! Triple 7s win ${fmt$(jp)} plus ${fmt$(pay - jp)}.` : pay ? (three ? `Three ${SLOT_NAMES[res[0]]}s! You win ${fmt$(pay)}.` : `Two cherries pay ${fmt$(pay)}.`) : 'No luck. The machine hums smugly.';
    c.win = pay > c.bet ? 'win' : pay ? 'push' : 'lose';
    if (jp) { addLog(p, `${p.name} hit the PROGRESSIVE JACKPOT for ${fmt$(jp)}!`); addHappy(p, 10); confetti(); }
    else if (three && res[0] === 'seven') { addLog(p, `${p.name} hit triple 7s for ${fmt$(pay)}!`); confetti(); }
    save(); refreshGame(); renderSide();
  }, stops[2] + 120);
}
function wheelSpinUI() {
  const p = cur(), c = CAS;
  const a = actionsFor(p).find(x => x.id === 'wheel_spin'); if (!a) return;
  const why = canDo(p, a); if (why) { toast(why, 'bad'); return; }
  const msg = doAction(p, a);
  const idx = WHEEL.findIndex(s => s.id === p.lastWheel), seg = 360 / WHEEL.length;
  const jitter = (Math.random() - .5) * seg * .6;
  c.wheel = { angle: 360 * 6 - (idx * seg + seg / 2) + jitter, msg: you(msg), revealed:false };
  addLog(p, named(p, msg)); save();
  refreshGame(); renderAll();
  const g = document.getElementById('wheel-g');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (g && !reduce) { g.style.transform = 'rotate(0deg)'; g.getBoundingClientRect(); g.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.15,1)'; g.style.transform = `rotate(${c.wheel.angle}deg)`; }
  setTimeout(() => { if (!CAS || CAS !== c) return; c.wheel.revealed = true; refreshGame(); renderAll(); if (p.lastWheel === 'regret') confetti(); }, reduce ? 50 : 4400);
}
