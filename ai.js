/* ===================== CPU rivals: utility planner ===================== */
const HOUSE_VAL = { rust:0, maple:8, loft:12, pent:16, house:20, craftsman:28 };
const ITEM_VAL = { laptop:7, scooter:9, console:4, phone:2 };
const AI_SKIP = /^(quit|wd|borrow|lotto|sell_house|drop|snack|game_|wheel|upg_)/;

function potentialWage(p) {
  let best = p.job ? wageOf(p, JOB[p.job]) : 0;
  for (const j of JOBS) if (!jobFails(p, j).length) best = Math.max(best, wageOf(p, j));
  if (p.course) {
    const frac = p.course.prog / DEG[p.course.id].sessions;
    for (const j of JOBS) if (!jobFails(p, j, p.course.id).length) best = Math.max(best, wageOf(p, j) * (.5 + .5 * frac));
  }
  return best;
}
function careerPotential(p) {
  const cur = careerScore(p);
  let best = cur;
  const frac = p.course ? p.course.prog / DEG[p.course.id].sessions : 0;
  for (const j of JOBS) {
    if (j.prestige * 9 <= cur) continue;
    const now = jobFails(p, j).filter(x => !x.includes('clothes'));
    let wt = 0;
    if (!now.length) wt = clothesTier(p) >= j.clothes ? 1 : .5;
    else if (p.course && !jobFails(p, j, p.course.id).filter(x => !x.includes('clothes')).length) wt = (.25 + .75 * frac) * (clothesTier(p) >= j.clothes ? 1 : .7);
    if (wt) best = Math.max(best, cur + (j.prestige * 9 - cur) * wt * .9);
  }
  return best;
}
function utility(p) {
  const P = PERSONAS[p.persona] || PERSONAS.grinder, w = P.w;
  const sc = scores(p, true), real = scores(p, false);
  sc.career = careerPotential(p);
  let u = 0;
  for (const g of goalKeys()) {
    const target = G.goals[g] * (g === 'wealth' ? 1.15 : 1);   // keep a cash cushion above the wealth goal
    const met = real[g] >= target;
    const f = met ? 1 : Math.min(.97, clamp(sc[g] / target, 0, 1));
    let bonus = met ? 25 : 0;
    if (!met && g === 'education' && p.course && sc[g] >= target) bonus = 25 * (.5 + .5 * p.course.prog / DEG[p.course.id].sessions);
    u += w[g] * (70 * f + 30 * (1 - (1 - f) * (1 - f)) + bonus);
  }
  if (!p.fed && p.groceries <= 0) u -= 30;
  u += Math.min(p.groceries, 3) * 2;
  u -= Math.max(0, p.stress - 45) * .5;
  u -= Math.max(0, 65 - p.health) * .35;
  if (p.sick) u -= 25;
  u -= p.cash * HOUSING[p.housing].risk * .03;
  const liquid = p.cash + p.bank;
  if (liquid < 200) u -= (200 - liquid) * .08;
  u += .04 * Math.min(Math.max(liquid, 0), 2500) + .01 * clamp(liquid - 2500, 0, 5000);   // money is a tool, not just a score
  if (!isOwner(p) && p.rentDueIn <= 1 && liquid < p.rent) u -= (p.rent - liquid) * .05;
  u -= p.loan * .012;
  const cur = p.job ? wageOf(p, JOB[p.job]) : 0;
  u += cur * .9 + potentialWage(p) * .4;
  for (const k in ITEM_VAL) if (p.items[k]) u += ITEM_VAL[k] * (k === 'console' && p.persona === 'partier' ? 2 : k === 'laptop' && p.persona === 'scholar' ? 1.5 : 1);
  if (p.job && JOB[p.job].clothes > 0) { const t = clothesTier(p); if (t < JOB[p.job].clothes || (p.clothes[t] || 0) <= 1) u -= 12; }
  u += HOUSE_VAL[p.housing] * (p.persona === 'partier' ? 1.3 : 1);
  const sv = stockValue(p);
  if (p.persona === 'investor') {
    for (const k in p.shares) { const h = G.stocks[k].hist, n = h.length; const mom = n > 3 ? h[n - 1] / h[n - 4] - 1 : 0; u += p.shares[k] * G.stocks[k].price * (.006 + mom * .08); }
  } else u -= sv * .002;
  return u;
}
function aiAllowed(p, a) {
  if (AI_SKIP.test(a.id)) return false;
  const wage = p.job ? wageOf(p, JOB[p.job]) : 0, monthly = wage * 48 * 4;
  if (a.hkey) {
    if (HOUSING[a.hkey].own) return HOUSE_VAL[a.hkey] > HOUSE_VAL[p.housing] && monthly * .35 >= homePrice(a.hkey) * (1 - HOUSE_DOWN) * MORT_PAY * 4.3 && afford(p, a.cost + 600);
    if (HOUSE_VAL[a.hkey] <= HOUSE_VAL[p.housing]) return false;
    return monthly * .35 >= HOUSING[a.hkey].rent * G.econ && afford(p, a.cost + 400);
  }
  if (a.group === 'stocks' && p.persona !== 'investor' && a.id.startsWith('buy')) return false;
  if (a.id === 'dep100' || a.id === 'dep500') return false;
  return true;
}
function cpuChoose(p) {
  const u0 = utility(p);
  const noise = DIFFS[p.diff].noise;
  let best = null;
  for (let i = 0; i < NLOC; i++) {
    const t = travelTime(p, p.loc, i);
    if (t > p.hours) continue;
    const base = clone(p); base.loc = i; base.hours -= t;
    for (const a of actionsFor(base)) {
      if (!aiAllowed(base, a) || canDo(base, a)) continue;
      let score;
      if (a.id === 'espresso') score = p.hours >= 10 ? .9 : -1;
      else {
        const c = clone(base);
        const a2 = actionsFor(c).find(x => x.id === a.id);
        SIM = true;
        try { doAction(c, a2); } finally { SIM = false; }
        score = (utility(c) - u0) / (t + a.hours + .5);
      }
      if (noise) score *= 1 + noise * (rng() - .5) * 2;
      if (!best || score > best.score) best = { i, id:a.id, score, t, label:a.label };
    }
  }
  return best;
}
/* Picks the CPU's next step. Returns null when it decides to call it a week. */
function cpuNext(p) {
  if (p.diff === 'easy' && p.hours < 22 && rng() < .2) return null;
  const b = cpuChoose(p);
  if (!b || b.score < .03) return null;
  return b;
}
/* Headless turn, used for testing and instant simulation. */
function cpuTurnInstant(p) {
  for (let n = 0; n < 40; n++) {
    const b = cpuNext(p); if (!b) break;
    p.hours -= b.t; p.loc = b.i;
    const a = actionsFor(p).find(x => x.id === b.id);
    if (!a || canDo(p, a)) continue;
    addLog(p, doAction(p, a).replace('{n}', p.name));
  }
}
function cpuEventChoice(p) {
  const e = EVENTS[p.event]; if (!e || !e.choices) return undefined;
  return e.ai ? e.ai(p) : 0;
}
