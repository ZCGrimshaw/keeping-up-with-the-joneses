'use strict';
/* ===================== Keeping Up with the Joneses · core rules (no DOM) ===================== */
const HOURS = 60;
const WEALTH_UNIT = 200;            // $200 net worth = 1 wealth point → 100 pts = $20,000
const SAVE_KEY = 'kuwtj-save-v1';
let G = null;
let SIM = false;                    // true while the CPU imagines an action (no randomness)

/* ---------- the town ---------- */
const LOCS = [
  { id:'home',    name:'Home',                 sign:'HOME',          tag:'Your couch misses you.' },
  { id:'gulp',    name:'Gulp & Go',            sign:'GULP & GO',     tag:'Groceries, snacks and scratch-offs.' },
  { id:'byte',    name:'Byte Me Electronics',  sign:'BYTE ME',       tag:'Gadgets you absolutely need.' },
  { id:'thread',  name:'Threadbare & Co.',     sign:'THREADBARE',    tag:'Dress for the job you want.' },
  { id:'college', name:'Hollowbrook College',  sign:'HOLLOWBROOK',   tag:'Knowledge, now with tuition.' },
  { id:'hub',     name:'Hustle Hub',           sign:'HUSTLE HUB',    tag:'The job center. Every opening in town is posted here.' },
  { id:'bank',    name:'First Bank of Bucks',  sign:'BANK',          tag:'Savings, loans and the stonk market.' },
  { id:'mega',    name:'MegaCorp Tower',       sign:'MEGACORP',      tag:'Synergy lives on floor 40.' },
  { id:'burger',  name:'Burger Bunker',        sign:'BURGER BUNKER', tag:'Food-shaped food, fast.' },
  { id:'gym',     name:'Swole Patrol Gym',     sign:'SWOLE PATROL',  tag:'Lift heavy things. Put them down. Feel better.' },
  { id:'grind',   name:'The Daily Grind',      sign:'DAILY GRIND',   tag:'Coffee, Wi-Fi and a gig board.' },
  { id:'fun',     name:'Funplex',              sign:'FUNPLEX',       tag:'Bowling, arcade, karaoke and live music.' },
  { id:'casino',  name:'Lucky Loophole Casino', sign:'LUCKY LOOPHOLE', tag:'The house always wins. Probably.' },
  { id:'clinic',  name:'Dr. Goodvibes Clinic', sign:'CLINIC',        tag:'Checkups and therapy. No waiting-room magazines from 2009.' },
  { id:'realty',  name:'Shark & Sons Realty',  sign:'REALTY',        tag:'Rent it, buy it, regret it.' },
];
const ROAD = { x0:175, y0:215, x1:1425, y1:705 };
const RW = ROAD.x1 - ROAD.x0, RH = ROAD.y1 - ROAD.y0;
const PERIM = 2 * (RW + RH);
function perimS(pt) {
  if (pt.y === ROAD.y0) return pt.x - ROAD.x0;
  if (pt.x === ROAD.x1) return RW + (pt.y - ROAD.y0);
  if (pt.y === ROAD.y1) return RW + RH + (ROAD.x1 - pt.x);
  return 2 * RW + RH + (ROAD.y1 - pt.y);
}
function pointAt(s) {
  s = ((s % PERIM) + PERIM) % PERIM;
  if (s < RW) return { x: ROAD.x0 + s, y: ROAD.y0 }; s -= RW;
  if (s < RH) return { x: ROAD.x1, y: ROAD.y0 + s }; s -= RH;
  if (s < RW) return { x: ROAD.x1 - s, y: ROAD.y1 }; s -= RW;
  return { x: ROAD.x0, y: ROAD.y1 - s };
}
/* Town plan. Outer rows sit outside the ring road; inner rows sit in the infield, across the road from them.
   Every building's door is a stop on the road, and LOCS is sorted by those stops so neighbours are 1 step apart. */
const PLAN = {
  home:   { side:'top', x:290 },          gulp:{ side:'top', x:760 },          college:{ side:'top', x:1310 },
  byte:   { side:'top', x:525, inner:true }, thread:{ side:'top', x:1040, inner:true },
  hub:    { side:'right', y:360 },        bank:{ side:'right', y:560 },
  mega:   { side:'bottom', x:1310 },      burger:{ side:'bottom', x:1010 },     gym:{ side:'bottom', x:640 },   grind:{ side:'bottom', x:290 },
  casino: { side:'bottom', x:1150, inner:true }, fun:{ side:'bottom', x:500, inner:true },
  clinic: { side:'left', y:560 },         realty:{ side:'left', y:360 },
};
(function layout() {
  for (const l of LOCS) {
    const P = PLAN[l.id]; let d, b, ly;
    if (P.side === 'top') {
      d = { x:P.x, y:ROAD.y0 };
      if (P.inner) { b = { x:P.x - 105, y:272, w:210, h:150 }; ly = b.y + b.h + 12; }
      else { b = { x:P.x - 105, y:22, w:210, h:160 }; ly = 178; }
    } else if (P.side === 'bottom') {
      d = { x:P.x, y:ROAD.y1 };
      if (P.inner) { b = { x:P.x - 105, y:497, w:210, h:150 }; ly = b.y - 12; }
      else { b = { x:P.x - 105, y:740, w:210, h:150 }; ly = 748; }
    } else if (P.side === 'right') { d = { x:ROAD.x1, y:P.y }; b = { x:1462, y:P.y - 78, w:132, h:150 }; ly = b.y + b.h + 14; }
    else { d = { x:ROAD.x0, y:P.y }; b = { x:6, y:P.y - 78, w:132, h:150 }; ly = b.y + b.h + 14; }
    l.door = d; l.box = b; l.labelY = ly; l.inner = !!P.inner; l.s = perimS(d);
  }
  LOCS.sort((a, b) => a.s - b.s);
  const h = LOCS.findIndex(l => l.id === 'home');
  LOCS.push(...LOCS.splice(0, h));   // keep Home as index 0
})();
const LI = {}; LOCS.forEach((l, i) => LI[l.id] = i);
const NLOC = LOCS.length;

/* ---------- people & stuff ---------- */
const CLOTHES = [
  { name:'Ratty',    price:0,   weeks:0,  desc:'Holes in places that should not have holes.' },
  { name:'Casual',   price:60,  weeks:12, desc:'Hoodie, jeans, optimism.' },
  { name:'Business', price:240, weeks:10, desc:'A blazer that says "per my last email."' },
  { name:'Designer', price:750, weeks:10, desc:'Italian. Probably.' },
];
const DEG = {
  assoc:     { name:'Associate Degree',       pts:12, cost:350,  sessions:4,  pre:[], blurb:'The gateway degree. Opens most bachelor programs.' },
  itcert:    { name:'IT Certificate',         pts:8,  cost:250,  sessions:3,  pre:[], blurb:'Have you tried turning it off and on again?' },
  fitcert:   { name:'Personal Trainer Cert',  pts:8,  cost:220,  sessions:3,  pre:[], blurb:'Learn to yell "one more rep" with authority.' },
  bizcert:   { name:'Business Certificate',   pts:8,  cost:300,  sessions:3,  pre:[], blurb:'Spreadsheets, synergy and firm handshakes.' },
  relicense: { name:'Real Estate License',    pts:8,  cost:380,  sessions:3,  pre:[], blurb:'Describe closets as "cozy" legally.' },
  bcs:       { name:'B.Sc. Computer Science', pts:18, cost:1100, sessions:6,  pre:['assoc'], blurb:'Turn coffee into code.' },
  bbiz:      { name:'B.A. Business',          pts:18, cost:900,  sessions:6,  pre:['assoc'], blurb:'Management, marketing, middle management.' },
  bfin:      { name:'B.Sc. Finance',          pts:18, cost:1000, sessions:6,  pre:['assoc'], blurb:'Learn what a derivative is. Briefly.' },
  bsn:       { name:'B.Sc. Nursing',          pts:18, cost:1200, sessions:6,  pre:['assoc'], blurb:'The hospital will thank you. Eventually.' },
  mba:       { name:'MBA',                    pts:22, cost:2400, sessions:8,  pre:['bbiz','bfin'], blurb:'Unlocks the corner office. Requires Business or Finance.' },
  md:        { name:'Medical Degree',         pts:24, cost:4500, sessions:10, pre:['bsn'], blurb:'Doctor jobs. Requires Nursing.' },
  phd:       { name:'Ph.D. in Philosophy',    pts:22, cost:1800, sessions:10, pre:['bcs','bbiz','bfin','bsn'], blurb:'Ask "but what IS a job?" Requires any bachelor\'s.' },
};
const BACHELORS = ['bcs','bbiz','bfin','bsn'];

function J(id, loc, title, wage, edu, clothes, exp, prestige, extra) {
  return Object.assign({ id, loc, title, wage, edu, clothes, exp, prestige }, extra || {});
}
const JOBS = [
  J('fry_cook','burger','Fry Cook',9,null,1,0,1),
  J('burger_lead','burger','Shift Lead',13,null,1,40,2),
  J('burger_mgr','burger','Franchise Manager',21,'bizcert',2,120,4),
  J('cashier','gulp','Cashier',10,null,1,0,1),
  J('grocer_mgr','gulp','Store Manager',19,'assoc',2,90,3),
  J('sales_assoc','byte','Sales Associate',12,null,1,0,2),
  J('repair_tech','byte','Repair Tech',22,'itcert',1,30,3),
  J('stock_clerk','thread','Stock Clerk',9,null,1,0,1),
  J('stylist','thread','Personal Stylist',18,null,3,40,3),
  J('barista','grind','Barista',11,null,1,0,1),
  J('front_desk','gym','Front Desk',10,null,1,0,1),
  J('trainer','gym','Personal Trainer',24,'fitcert',1,20,4,{ minHealth:65 }),
  J('orderly','clinic','Orderly',12,null,1,0,2),
  J('nurse','clinic','Nurse',36,'bsn',1,0,6),
  J('doctor','clinic','Doctor',74,'md',2,60,9),
  J('teller','bank','Bank Teller',16,'assoc',2,0,3),
  J('analyst','bank','Financial Analyst',42,'bfin',2,80,6),
  J('bank_mgr','bank','Branch Manager',62,'mba',3,200,8),
  J('intern','mega','Intern',12,null,2,0,2),
  J('junior_dev','mega','Junior Developer',38,'bcs',1,0,6),
  J('mid_mgr','mega','Middle Manager',48,'bbiz',2,120,7),
  J('vp','mega','VP of Synergy',86,'mba',3,250,9),
  J('ceo','mega','CEO',140,'mba',3,450,10),
  J('janitor','college','Campus Janitor',11,null,1,0,1),
  J('ta','college','Teaching Assistant',19,'bachelor',1,0,4),
  J('professor','college','Professor',46,'phd',2,60,8),
  J('realtor','realty','Realtor',28,'relicense',2,0,5,{ commission:true }),
  J('ticket','fun','Ticket Taker',9,null,1,0,1),
  J('dj','fun','Resident DJ',25,null,3,40,4,{ minHappy:65 }),
  J('career_coach','hub','Career Coach',26,'bbiz',2,60,5),
  J('dealer','casino','Card Dealer',16,null,2,0,2),
  J('pit_boss','casino','Pit Boss',32,'bizcert',2,80,5),
];
const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));

const TRAITS = {
  hustler:   { name:'Hustler',          desc:'Earns 15% more from jobs and gigs.' },
  bookworm:  { name:'Bookworm',         desc:'Classes take 4 hours instead of 6.' },
  butterfly: { name:'Social Butterfly', desc:'Fun activities give 50% more happiness.' },
  gymrat:    { name:'Gym Rat',          desc:'Workouts give double health, and health drains slower.' },
  zen:       { name:'Zen Master',       desc:'Picks up 40% less stress.' },
  frugal:    { name:'Coupon Clipper',   desc:'Pays 15% less at shops, school, the gym and the clinic.' },
  trustfund: { name:'Trust Fund Kid',   desc:'Starts with $1,500 extra. Happiness fades faster each week.' },
};
const PERSONAS = {
  grinder:  { label:'The Grinder',      who:'Jordan Jones',  trait:'hustler',  blurb:'Calls weekends "unbilled hours."',
              w:{ wealth:1.2, happiness:.8, education:.85, career:1.5, health:.8 } },
  partier:  { label:'The Party Animal', who:'Jackie Jones',  trait:'butterfly', blurb:'Has a loyalty card at every bar in town.',
              w:{ wealth:.85, happiness:1.6, education:.75, career:.9, health:.9 } },
  investor: { label:'The Investor',     who:'Jasper Jones',  trait:'frugal',   blurb:'Explains index funds at birthday parties.',
              w:{ wealth:1.6, happiness:.8, education:.9, career:.95, health:.8 } },
  scholar:  { label:'The Scholar',      who:'Juniper Jones', trait:'bookworm', blurb:'Collects degrees like trading cards.',
              w:{ wealth:.85, happiness:.85, education:1.6, career:1.1, health:.9 } },
};
const DIFFS = { easy:{ label:'Easy', noise:.6 }, normal:{ label:'Normal', noise:.2 }, hard:{ label:'Hard', noise:0 } };

const ITEMS = {
  laptop:  { name:'Laptop',          price:650, desc:'Take online classes and laptop gigs from home.' },
  scooter: { name:'e-Scooter',       price:450, desc:'Halves travel time around town.' },
  console: { name:'Game Console',    price:380, desc:'Unlocks gaming at home. +1 happiness every week.' },
  phone:   { name:'uPhone 17 Ultra', price:999, desc:'+10 happiness right now, +1 every week. Fragile.' },
};
const HOUSING = {
  rust:  { name:'Rustbucket Studio', rent:320,  happy:-2, rest:0,  risk:.15, desc:'Cheap and leaky. The lock is mostly decorative.' },
  maple: { name:'Maple Court 1BR',   rent:760,  happy:0,  rest:4,  risk:.03, desc:'Clean, quiet, and the neighbors wave.' },
  pent:  { name:'Skyline Penthouse', rent:1900, happy:3,  rest:8,  risk:.01, desc:'Floor-to-ceiling windows. Floor-to-ceiling rent.' },
  loft:  { name:'Brickworks Loft',   rent:1150, happy:2,  rest:6,  risk:.02, office:true, desc:'Exposed brick, a home-office nook, and a rooftop with string lights.' },
  house: { name:'Starter Bungalow',  rent:0,    happy:3,  rest:7,  risk:.02, own:true, mult:1,   desc:'Your own place, with your own mortgage.' },
  craftsman: { name:'Hillcrest Craftsman', rent:0, happy:6, rest:11, risk:.01, own:true, mult:2.5, growth:.0015, desc:'A porch swing, a stone fireplace and a very large mortgage.' },
};
const RENTALS = ['rust', 'maple', 'loft', 'pent'], HOMES = ['house', 'craftsman'];
const UPGRADES = {
  kitchen:  { name:"Chef's kitchen",   cost:2500, desc:'Groceries last twice as long. Happiness +1 a week.' },
  office:   { name:'Home office',      cost:1800, desc:'Online classes and laptop gigs at home take 1 hour less.' },
  gym:      { name:'Home gym',         cost:2200, desc:'Work out at home without the trip to Swole Patrol.' },
  garden:   { name:'Backyard garden',  cost:900,  desc:'Grows a free week of groceries every other week.' },
  hottub:   { name:'Hot tub',          cost:3000, desc:'Melts away 8 stress every week.' },
  security: { name:'Security system',  cost:1200, desc:'Burglars give your place a wide berth.' },
};
const UPGRADE_KEEP = .7;   // share of an upgrade's cost added to the home's value
const isOwner = p => !!HOUSING[p.housing].own;
const hasUpg = (p, k) => isOwner(p) && !!(p.upgrades && p.upgrades[k]);
const hasOffice = p => HOUSING[p.housing].office || hasUpg(p, 'office');
function homePrice(k) { return Math.round(G.homeValue * HOUSING[k].mult * (k === 'craftsman' ? (G.craftBoost || 1) : 1)); }
function upgradesValue(p) { return isOwner(p) ? Object.keys(p.upgrades || {}).reduce((t, k) => t + UPGRADES[k].cost * UPGRADE_KEEP, 0) : 0; }
function homeValueOf(p) { return isOwner(p) ? homePrice(p.housing) + upgradesValue(p) : 0; }
const HOUSE_DOWN = .15, HOUSE_CLOSING = 600, MORT_PAY = .0055, MORT_RATE = .0009;

const STOCKS = [
  { id:'MEGA', name:'MegaCorp',          p:48,  vol:.06, drift:.004 },
  { id:'BURG', name:'Burger Bunker',     p:22,  vol:.08, drift:.002 },
  { id:'BYTE', name:'Byte Me',           p:35,  vol:.11, drift:.004 },
  { id:'GULP', name:'Gulp & Go',         p:15,  vol:.05, drift:.002 },
  { id:'HBIX', name:'Hollowbrook Index', p:100, vol:.02, drift:.003 },
];

const GIGS = [
  { id:'deliver',   name:'Deliver for DoorDish',            h:4, pay:55,  need:'scooter', tip:30 },
  { id:'dog',       name:'Walk a very large dog',           h:2, pay:30 },
  { id:'seo',       name:'Write 40 blog posts about mattresses', h:4, pay:75, need:'laptop' },
  { id:'website',   name:"Fix a dentist's website",         h:5, pay:190, need:'laptop', deg:['itcert','bcs'] },
  { id:'logo',      name:'Design a logo for a taco truck',  h:4, pay:110, need:'laptop' },
  { id:'furniture', name:'Assemble flat-pack furniture',    h:3, pay:60 },
  { id:'tutor',     name:'Tutor a kid in algebra',          h:3, pay:80,  deg:['assoc'] },
  { id:'taxes',     name:"Do a stranger's taxes",           h:4, pay:170, need:'laptop', deg:['bfin','bizcert'] },
  { id:'mystery',   name:'Mystery-shop Burger Bunker',      h:2, pay:25,  fed:true },
  { id:'line',      name:'Wait in line for limited sneakers', h:5, pay:70 },
];
const GIG = Object.fromEntries(GIGS.map(g => [g.id, g]));

const NEWS = [
  { t:'MegaCorp announces "synergy realignment." Stock pops anyway.', s:{ MEGA:.08 } },
  { t:"Burger Bunker's cricket burger flops in taste tests.", s:{ BURG:-.12 } },
  { t:"Byte Me's new phone case sells out in four minutes.", s:{ BYTE:.10 } },
  { t:'City declares "Treat Yourself Week." Prices creep up.', e:.04 },
  { t:'Gulp & Go recalls its Mystery Meat Monday special.', s:{ GULP:-.10 } },
  { t:'Economists agree the economy is "vibing."', e:.03, s:{ HBIX:.03 } },
  { t:'Squirrel bites a fiber line downtown. Markets jittery.', s:{ HBIX:-.04, BYTE:-.05 } },
  { t:'MegaCorp CEO buys a third yacht. Staff get a pizza party.', s:{ MEGA:.03 } },
  { t:'Burger Bunker mascot rebrand goes viral for the wrong reasons.', s:{ BURG:.10 } },
  { t:'Recession fears! Everyone suddenly downloads budgeting apps.', e:-.05, s:{ HBIX:-.06 } },
  { t:'Housing market heats up. Realtors spotted smiling.', h:.05 },
  { t:'Housing market cools. Realtors spotted sighing.', h:-.04 },
  { t:'Local man wins lottery, buys an entire e-scooter fleet.', s:{ BYTE:.04 } },
  { t:'Gulp & Go unveils self-checkout that sighs at you.', s:{ GULP:.05 } },
  { t:'Nineties revival sweeps town. Floppy disks trade at a premium.', s:{ BYTE:-.03 } },
  { t:'Analysts ask whether Byte Me is overvalued. (It is.)', s:{ BYTE:-.12 } },
  { t:'MegaCorp quarterly earnings "exceeded vibes expectations."', s:{ MEGA:.07 } },
  { t:'Supply chain hiccup: avocados are now a luxury good.', e:.03, s:{ GULP:.04 } },
  { t:'Interest rates nudged down. Shoppers rejoice.', e:-.02, s:{ HBIX:.04 } },
  { t:'MegaCorp replaces middle managers with a very confident chatbot.', s:{ MEGA:-.06 } },
  { t:'Funplex hosts record-setting karaoke night. Nobody sang well.' },
  { t:'Swole Patrol launches "Summer Bod 2027" challenge.' },
  { t:'Hollowbrook College renames library after a crypto donor.', s:{ HBIX:.01 } },
  { t:'Mild inflation reported. Wallets mildly concerned.', e:.03 },
  { t:'Prices dip as Gulp & Go starts a price war with nobody.', e:-.03, s:{ GULP:-.04 } },
  { t:'The Joneses are rumored to be getting a pool. Neighbors seethe.' },
];

/* ---------- utilities ---------- */
function rng() {
  let t = (G.seed = (G.seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss() { let u = 0; while (u === 0) u = rng(); const v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const roll = x => !SIM && rng() < x;
const pick = arr => arr[Math.floor(rng() * arr.length)];
function fmt$(n) { n = Math.round(n); return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US'); }
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- player math ---------- */
function clothesTier(p) { for (let t = 3; t >= 1; t--) if ((p.clothes[t] || 0) > 0) return t; return 0; }
function stockValue(p) { let v = 0; for (const k in p.shares) v += p.shares[k] * G.stocks[k].price; return Math.round(v); }
function homeEquity(p) { return isOwner(p) ? Math.round(homeValueOf(p) - p.mortgage) : 0; }
function netWorth(p) { return p.cash + p.bank + stockValue(p) + homeEquity(p) - p.loan; }
function hasDeg(p, d) { return d === 'bachelor' ? BACHELORS.some(b => p.degrees.includes(b)) : p.degrees.includes(d); }
function eduScore(p, partial) {
  let s = p.degrees.reduce((a, d) => a + DEG[d].pts, 0);
  if (partial && p.course) { const c = DEG[p.course.id]; s += c.pts * (.25 + .75 * p.course.prog / c.sessions); }
  return Math.min(100, s);
}
function careerScore(p) { if (!p.job) return 0; return Math.min(100, JOB[p.job].prestige * 9 + Math.min(10, Math.floor(p.jobHours / 20))); }
function scores(p, partial) {
  return { wealth: clamp(netWorth(p) / WEALTH_UNIT, 0, 100), happiness: p.happiness, education: eduScore(p, partial), career: careerScore(p), health: p.health };
}
const GOAL_META = {
  wealth:    { label:'Wealth',    color:'#2f9e55' },
  happiness: { label:'Happiness', color:'#ff6f59' },
  education: { label:'Education', color:'#7b4fd1' },
  career:    { label:'Career',    color:'#1a8fd6' },
  health:    { label:'Health',    color:'#18a99c' },
};
function goalKeys() { return ['wealth','happiness','education','career'].concat(G.goals.health ? ['health'] : []); }
function progress(p) { const s = scores(p); const ks = goalKeys(); return ks.reduce((t, k) => t + Math.min(1, s[k] / G.goals[k]), 0) / ks.length; }
function hasWon(p) { const s = scores(p); return goalKeys().every(k => s[k] >= G.goals[k]); }
function wageOf(p, j) { return Math.round(j.wage * (.7 + .3 * G.econ) * (p.trait === 'hustler' ? 1.15 : 1)); }
const WORK_REG = 30, WORK_MAX = 42, OT_PAY = 1.5, OT_STRESS = 2;   // weekly job hours: regular, then overtime, then sent home
function stressRate(j) { return .3 + j.prestige * .06; }
function jobFails(p, j, extraDeg) {
  const f = [];
  if (j.edu) {
    let ok = hasDeg(p, j.edu);
    if (!ok && extraDeg) ok = j.edu === extraDeg || (j.edu === 'bachelor' && BACHELORS.includes(extraDeg));
    if (!ok) f.push('Needs ' + (j.edu === 'bachelor' ? "any bachelor's degree" : DEG[j.edu].name));
  }
  if (clothesTier(p) < j.clothes) f.push(`Needs ${CLOTHES[j.clothes].name} clothes`);
  if (p.exp < j.exp) f.push(`Needs ${j.exp}h work experience (you have ${Math.floor(p.exp)}h)`);
  if (j.minHealth && p.health < j.minHealth) f.push(`Needs ${j.minHealth}+ health`);
  if (j.minHappy && p.happiness < j.minHappy) f.push(`Needs ${j.minHappy}+ happiness`);
  return f;
}

/* ---------- money & mood ---------- */
function earn(p, amt) { amt = Math.round(amt); p.cash += amt; p.ledger.earned += amt; }
function afford(p, amt) { return p.cash + p.bank >= amt; }
function spend(p, amt) { amt = Math.round(amt); p.ledger.spent += amt; const c = Math.min(Math.max(p.cash, 0), amt); p.cash -= c; p.bank -= amt - c; }
function payBill(p, amt, label, R) {
  amt = Math.round(amt);
  if (afford(p, amt)) { spend(p, amt); return true; }
  const have = Math.max(0, p.cash) + Math.max(0, p.bank);
  spend(p, have);
  const short = amt - have;
  p.loan += Math.ceil(short * 1.1);
  p.happiness -= 8;
  R && R.push([`Couldn't cover ${label}. ${fmt$(short)} went to collections and onto your loan.`, 'bad']);
  return false;
}
function addStress(p, x) { if (x > 0 && p.trait === 'zen') x *= .6; p.stress = clamp(p.stress + x, 0, 100); }
function addHappy(p, x, fun) { if (fun && x > 0 && p.trait === 'butterfly') x *= 1.5; p.happiness = clamp(p.happiness + x, 0, 100); }
function addHealth(p, x) { p.health = clamp(p.health + x, 0, 100); }
function funMult(p, id) { return 1 / (1 + (p.fun[id] || 0) * .7); }
function useFun(p, id) { const m = funMult(p, id); p.fun[id] = (p.fun[id] || 0) + 1; return m; }
function normalize(p) {
  p.happiness = clamp(p.happiness, 0, 100); p.health = clamp(p.health, 0, 100); p.stress = clamp(p.stress, 0, 100);
  p.cash = Math.round(p.cash); p.bank = Math.round(p.bank); p.loan = Math.max(0, Math.round(p.loan));
}
function steps(a, b) { const cw = (b - a + NLOC) % NLOC; return Math.min(cw, NLOC - cw); }
function travelTime(p, a, b) { const s = steps(a, b); return p.items.scooter ? Math.ceil(s / 2) : s; }
function loanLimit(p) { return Math.min(6000, 1000 + (p.job ? wageOf(p, JOB[p.job]) * 60 : 0)); }

/* ---------- actions ---------- */
function A(o) { return Object.assign({ hours:0, cost:0, fx:[], group:'do', desc:'' }, o); }
function fxH(x) { x = Math.round(x); return [`Happiness ${x >= 0 ? '+' : ''}${x}`, x >= 0 ? 'good' : 'bad']; }
function fxS(p, x) { if (x > 0 && p.trait === 'zen') x *= .6; x = Math.round(x); return [`Stress ${x >= 0 ? '+' : ''}${x}`, x > 0 ? 'bad' : 'good']; }
function fxHe(x) { x = Math.round(x); return [`Health ${x >= 0 ? '+' : ''}${x}`, x >= 0 ? 'good' : 'bad']; }
function canDo(p, a) {
  const r = a.check ? a.check() : '';
  if (r) return r;
  if (a.hours > p.hours + 1e-9) return `Needs ${a.hours}h. You have ${p.hours}h left.`;
  if (a.cost > 0 && !afford(p, a.cost)) return `Costs ${fmt$(a.cost)}. You have ${fmt$(p.cash + p.bank)}.`;
  return '';
}
function doAction(p, a) {
  if (a.cost) spend(p, a.cost);
  p.hours -= a.hours;
  const msg = a.run();
  normalize(p);
  return msg;
}
function classAction(p, online) {
  const c = p.course, d = DEG[c.id], hrs = (p.trait === 'bookworm' ? 4 : 6) - (online && hasOffice(p) ? 1 : 0);
  return A({ id: online ? 'online_class' : 'class', group:'school',
    label: online ? 'Take an online class' : 'Attend class',
    desc: `${d.name}: class ${c.prog + 1} of ${d.sessions}`, hours: hrs,
    fx: [[`Course ${c.prog + 1}/${d.sessions}`, 'good'], fxS(p, 4)],
    run: () => {
      c.prog++; addStress(p, 4);
      if (c.prog >= d.sessions) { p.degrees.push(c.id); p.course = null; addHappy(p, 8); return `{n} graduated with a ${d.name}! Education +${d.pts}.`; }
      return `{n} studied for ${d.name} (${c.prog}/${d.sessions}).`;
    } });
}
function gigActions(p, remoteOnly) {
  const out = [];
  for (const id of G.gigs) {
    const g = GIG[id];
    if (remoteOnly && g.need !== 'laptop') continue;
    const pay = Math.round(g.pay * (p.trait === 'hustler' ? 1.15 : 1));
    const gh = remoteOnly && hasOffice(p) ? Math.max(1, g.h - 1) : g.h;
    out.push(A({ id:'gig_' + id, group:'gigs', label:g.name, hours:gh,
      desc: [g.need ? `Needs ${ITEMS[g.need].name}` : 'No gear needed', g.deg ? `Needs ${g.deg.map(d => DEG[d].name).join(' or ')}` : ''].filter(Boolean).join(' · '),
      fx: [[`+${fmt$(pay)}${g.tip ? ' + tips' : ''}`, 'good'], fxS(p, g.h * .6)].concat(g.fed ? [['Free meal', 'good']] : []),
      check: () => p.gigsDone.includes(id) ? 'Already done this week' : (g.need && !p.items[g.need]) ? `Needs a ${ITEMS[g.need].name}` : (g.deg && !g.deg.some(d => p.degrees.includes(d))) ? `Needs ${g.deg.map(d => DEG[d].name).join(' or ')}` : '',
      run: () => {
        let amt = pay;
        if (g.tip) amt += SIM ? g.tip / 2 : Math.floor(rng() * g.tip);
        earn(p, amt); addStress(p, g.h * .6); p.gigsDone.push(id);
        if (g.fed) p.fed = true;
        return `{n} did a gig (${g.name}) for ${fmt$(amt)}.`;
      } }));
  }
  return out;
}
function jobAction(p, j) {
  const fails = jobFails(p, j), cur = p.job === j.id, w = wageOf(p, j);
  return A({ id:'apply_' + j.id, group:'jobs', job:j, label:j.title, hours:1, fails, cur,
    desc: `${fmt$(w)}/hour at ${LOCS[LI[j.loc]].name}`,
    check: () => cur ? 'This is your current job' : (fails.length ? fails[0] : ''),
    run: () => {
      const old = p.job; p.job = j.id; p.jobHours = 0; p.dressWarn = false;
      return `{n} got hired as ${j.title} at ${LOCS[LI[j.loc]].name}${old ? ` (left ${JOB[old].title})` : ''}.`;
    } });
}

function actionsFor(p) {
  const here = LOCS[p.loc].id, out = [];
  const add = o => out.push(A(o));
  const disc = p.trait === 'frugal' ? .85 : 1;
  const pr = base => Math.round(base * G.econ * disc);
  const fun = (id, label, desc, hours, cost, hap, str, extra) => {
    const m = funMult(p, id);
    add(Object.assign({ id, label, desc, hours, cost, group:'do',
      fx: [fxH(hap * m * (p.trait === 'butterfly' ? 1.5 : 1)), fxS(p, str)].concat(m < 1 ? [['Less fun on repeat', 'bad']] : []),
      run: () => { const mm = useFun(p, id); addHappy(p, hap * mm, true); addStress(p, str); extra && extra(); return `{n} ${desc0(label)}.`; } }, {}));
  };

  if (p.job && JOB[p.job].loc === here) {
    const j = JOB[p.job], w = wageOf(p, j);
    const unit = Math.max(1, Math.round(3 * stressRate(j)));   // stress per short shift; a full shift is exactly double
    const done = p.workHrs || 0, regLeft = Math.max(0, WORK_REG - done), totLeft = Math.max(0, WORK_MAX - done);
    const left = regLeft ? `Regular: ${regLeft}h left this week` : totLeft ? `Overtime: ${totLeft}h left this week` : 'Done for the week';
    for (const h of [6, 3]) {
      const full = h === 6, reg = Math.min(h, regLeft), ot = h - reg;
      const bonus = full ? 1.1 : 1, base = Math.round(w * (reg + ot * OT_PAY) * bonus);
      const xp = full ? 7 : 3, str = Math.round((full ? unit * 2 : unit) * (reg + ot * OT_STRESS) / h);
      add({ id:'work' + h, group:'work', label: full ? 'Work a full shift' : 'Work a short shift',
        desc: `${j.title} · ${fmt$(w)}/hour${full ? ' + 10% full-shift bonus' : ''} · ${left}`, hours:h,
        fx: [[`+${fmt$(base)}${j.commission ? ' (commission varies)' : ''}`, 'good'], fxS(p, str), [`+${xp}h experience`, 'good']]
          .concat(ot ? [[`${ot}h overtime: 1.5× pay`, 'good'], [`Health −${Math.round(ot * .5)}`, 'bad']] : []),
        check: () => done + h > WORK_MAX ? (totLeft ? `Only ${totLeft}h of work left this week` : 'Your manager sent you home. Go touch grass.') : '',
        run: () => {
          let pay = base;
          if (j.commission && !SIM) pay = Math.round(pay * (.4 + rng() * 1.6));
          earn(p, pay); p.exp += xp; p.jobHours += xp; addStress(p, str); addHealth(p, -h * .05 - ot * .5);
          p.workHrs = done + h;
          return `{n} worked ${h}h${ot ? ` (${ot}h overtime)` : ''} as ${j.title} and earned ${fmt$(pay)}.`;
        } });
    }
  }

  switch (here) {
    case 'home':
      fun('tv', 'Binge a streaming show', 'Three episodes. "Just one more."', 3, 0, 4, -10);
      if (p.items.console) fun('games', 'Play video games', 'Ranked matches. Mostly losses.', 3, 0, 8, -12);
      add({ id:'nap', label:'Take a power nap', desc:'Twenty minutes, they said.', hours:2, fx:[fxS(p, -7), fxHe(2)],
        run: () => { addStress(p, -7); addHealth(p, 2); return '{n} took a power nap.'; } });
      if (hasUpg(p, 'gym')) add({ id:'home_workout', label:'Work out in your home gym', desc:'No membership, no mirror selfies. Well, a few.', hours:3, fx:[fxHe(p.trait === 'gymrat' ? 12 : 6), fxS(p, -10)],
        run: () => { addHealth(p, p.trait === 'gymrat' ? 12 : 6); addStress(p, -10); return '{n} worked out in the home gym.'; } });
      if (hasUpg(p, 'hottub')) fun('hottub', 'Soak in the hot tub', 'Bubbles, steam, zero thoughts.', 1, 0, 4, -10);
      if (p.course && (p.items.laptop || hasOffice(p))) out.push(classAction(p, true));
      if (p.items.laptop) out.push(...gigActions(p, true));
      break;
    case 'gulp':
      add({ id:'groc1', group:'shop', label:'Weekly groceries', desc:'Feeds you for one week. Eaten automatically at home.', hours:1, cost:pr(50),
        fx:[['+1 week of food', 'good']], check: () => p.groceries >= 8 ? 'Your fridge is full' : '',
        run: () => { p.groceries++; return '{n} bought a week of groceries.'; } });
      add({ id:'groc4', group:'shop', label:'Bulk groceries', desc:'Four weeks of food. Cheaper per week.', hours:1, cost:pr(170),
        fx:[['+4 weeks of food', 'good']], check: () => p.groceries > 4 ? 'Not enough room in the fridge' : '',
        run: () => { p.groceries += 4; return '{n} bought a month of groceries in bulk.'; } });
      add({ id:'snack', group:'shop', label:'Gas-station sushi', desc:'Questionable. Delicious.', hours:0, cost:pr(7), fx:[fxH(1), fxHe(-1)],
        run: () => { addHappy(p, 1); addHealth(p, -1); return '{n} ate gas-station sushi. Bold.'; } });
      add({ id:'lotto', group:'shop', label:'Scratch-off ticket', desc:'1 in 250 chance of $1,000.', hours:0, cost:5, fx:[['Pure hope', 'good']],
        run: () => { if (roll(1 / 250)) { earn(p, 1000); addHappy(p, 15); return '{n} WON $1,000 on a scratch-off!'; } return '{n} scratched a ticket. Nothing.'; } });
      break;
    case 'byte':
      for (const k of ['laptop', 'scooter', 'console', 'phone']) {
        const it = ITEMS[k];
        add({ id:'buy_' + k, group:'shop', label:it.name, desc:it.desc, hours:1, cost:pr(it.price),
          fx: k === 'phone' ? [fxH(10)] : [], check: () => p.items[k] ? 'You already own one' : '',
          run: () => { p.items[k] = true; if (k === 'phone') addHappy(p, 10); return `{n} bought a ${it.name}.`; } });
      }
      break;
    case 'thread':
      for (let t = 1; t <= 3; t++) {
        const c = CLOTHES[t];
        add({ id:'clothes' + t, group:'shop', label:`${c.name} outfit`, desc:`${c.desc} Lasts ${c.weeks} weeks.`, hours:1, cost:pr(c.price),
          fx: t === 3 ? [fxH(4)] : [], check: () => (p.clothes[t] || 0) >= c.weeks - 1 ? 'Your current set is still fresh' : '',
          run: () => { p.clothes[t] = c.weeks; if (t === 3) addHappy(p, 4); return `{n} bought a ${c.name.toLowerCase()} outfit.`; } });
      }
      break;
    case 'college':
      if (p.course) {
        out.push(classAction(p, false));
        add({ id:'drop', group:'school', label:'Drop current course', desc:'No refunds. The college already spent it on a fountain.', hours:0,
          fx:[['Lose progress', 'bad']], run: () => { const n = DEG[p.course.id].name; p.course = null; return `{n} dropped ${n}.`; } });
      }
      for (const d in DEG) {
        const D = DEG[d];
        add({ id:'enroll_' + d, group:'courses', deg:d, label:D.name, desc:D.blurb, hours:1, cost:pr(D.cost),
          fx:[[`${D.sessions} classes`, 'time'], [`Education +${D.pts}`, 'good']],
          check: () => p.degrees.includes(d) ? 'Already earned' :
            p.course ? (p.course.id === d ? 'You are enrolled' : 'Finish or drop your current course first') :
            (D.pre.length && !D.pre.some(x => p.degrees.includes(x))) ? 'Requires ' + D.pre.map(x => DEG[x].name).join(' or ') : '',
          run: () => { p.course = { id:d, prog:0 }; return `{n} enrolled in ${D.name}.`; } });
      }
      break;
    case 'hub':
      if (p.job) add({ id:'quit', label:'Quit your job', desc:`Leave ${JOB[p.job].title}. Dramatic exit optional.`, hours:0, fx:[['Career resets', 'bad']],
        run: () => { const t = JOB[p.job].title; p.job = null; p.jobHours = 0; return `{n} quit as ${t}.`; } });
      break;
    case 'bank': {
      const dep = (id, label, amt) => add({ id, group:'bank', label, hours:0, check: () => p.cash < 1 ? 'Your wallet is empty' : '',
        run: () => { const a = Math.min(p.cash, amt()); p.cash -= a; p.bank += a; return `{n} deposited ${fmt$(a)}.`; } });
      const wd = (id, label, amt) => add({ id, group:'bank', label, hours:0, check: () => p.bank < 1 ? 'Your account is empty' : '',
        run: () => { const a = Math.min(p.bank, amt()); p.bank -= a; p.cash += a; return `{n} withdrew ${fmt$(a)}.`; } });
      dep('dep100', 'Deposit $100', () => 100); dep('dep500', 'Deposit $500', () => 500); dep('depall', 'Deposit all cash', () => p.cash);
      wd('wd100', 'Withdraw $100', () => 100); wd('wd500', 'Withdraw $500', () => 500); wd('wdall', 'Withdraw everything', () => p.bank);
      add({ id:'borrow', group:'loan', label:'Borrow $500', desc:'1% interest per week.', hours:0,
        check: () => p.loan + 500 > loanLimit(p) ? `Your limit is ${fmt$(loanLimit(p))}` : '',
        run: () => { p.loan += 500; p.cash += 500; return '{n} borrowed $500.'; } });
      add({ id:'repay', group:'loan', label:'Repay $500', hours:0, cost:0,
        check: () => p.loan < 1 ? 'No loan to repay' : !afford(p, Math.min(500, p.loan)) ? 'Not enough money' : '',
        run: () => { const a = Math.min(500, p.loan); spend(p, a); p.ledger.spent -= a; p.loan -= a; return `{n} repaid ${fmt$(a)} of the loan.`; } });
      add({ id:'repayall', group:'loan', label:'Repay entire loan', hours:0,
        check: () => p.loan < 1 ? 'No loan to repay' : !afford(p, p.loan) ? 'Not enough money' : '',
        run: () => { const a = p.loan; spend(p, a); p.ledger.spent -= a; p.loan = 0; return `{n} paid off the loan (${fmt$(a)}).`; } });
      for (const s of STOCKS) {
        const px = G.stocks[s.id].price;
        for (const n of [1, 10]) {
          add({ id:`buy${n}_${s.id}`, group:'stocks', ticker:s.id, label:`Buy ${n}`, hours:0, cost:Math.round(px * n),
            run: () => { p.basis = p.basis || {}; if (p.shares[s.id] && p.basis[s.id] == null) p.basis[s.id] = Math.round(p.shares[s.id] * px); p.basis[s.id] = (p.basis[s.id] || 0) + Math.round(px * n); p.shares[s.id] = (p.shares[s.id] || 0) + n; p.ledger.spent -= Math.round(px * n); return `{n} bought ${n} ${s.id} at ${fmt$(px)}.`; } });
          add({ id:`sell${n}_${s.id}`, group:'stocks', ticker:s.id, label:`Sell ${n}`, hours:0,
            check: () => (p.shares[s.id] || 0) < n ? `You own ${p.shares[s.id] || 0}` : '',
            run: () => { p.basis = p.basis || {}; const have = p.shares[s.id]; if (p.basis[s.id] != null) p.basis[s.id] = Math.round(p.basis[s.id] * (have - n) / have); p.shares[s.id] -= n; if (!p.shares[s.id]) { delete p.shares[s.id]; delete p.basis[s.id]; } p.cash += Math.round(px * n); return `{n} sold ${n} ${s.id} at ${fmt$(px)}.`; } });
        }
      }
      break;
    }
    case 'burger':
      add({ id:'meal', label:'Combo meal', desc:'Burger, fries, drink. Counts as eating this week.', hours:1, cost:pr(12), fx:[['Fed this week', 'good'], fxH(1)],
        run: () => { p.fed = true; addHappy(p, 1); return '{n} ate a combo meal.'; } });
      fun('feast', 'Bunker Mega Feast', 'Four patties. A cry for help.', 1, pr(26), 5, 0, () => { p.fed = true; addHealth(p, -2); });
      out[out.length - 1].fx.push(['Fed this week', 'good'], fxHe(-2));
      break;
    case 'gym':
      add({ id:'workout', label:'Work out', desc:'Lift, sweat, take a mirror selfie.', hours:3, cost:pr(12), fx:[fxHe(p.trait === 'gymrat' ? 12 : 6), fxS(p, -10)],
        run: () => { addHealth(p, p.trait === 'gymrat' ? 12 : 6); addStress(p, -10); return '{n} worked out.'; } });
      add({ id:'yoga', label:'Yoga class', desc:'Downward dog, upward mood.', hours:2, cost:pr(15), fx:[fxS(p, -16), fxH(2)],
        run: () => { addStress(p, -16); addHappy(p, 2); return '{n} did yoga.'; } });
      break;
    case 'grind':
      add({ id:'espresso', label:'Triple espresso', desc:'Buys you 3 extra hours this week. Once a week.', hours:0, cost:pr(7), fx:[['+3 hours', 'good'], fxS(p, 6)],
        check: () => p.espresso ? 'One per week. Your heart insists.' : '',
        run: () => { p.hours += 3; p.espresso = true; addStress(p, 6); return '{n} downed a triple espresso (+3h).'; } });
      out.push(...gigActions(p, false));
      break;
    case 'fun':
      fun('karaoke', 'Karaoke night', 'Power ballads, zero shame.', 2, pr(10), 6, -4);
      fun('arcade', 'Arcade', 'Chasing a high score from 1994.', 2, pr(14), 5, -6);
      fun('bowling', 'Bowling', 'Rented shoes, real joy.', 3, pr(22), 8, -8);
      fun('concert', 'Live concert', "A band you'll pretend you knew before.", 5, pr(85), 16, -14);
      break;
    case 'casino':
      add({ id:'game_slots', group:'games', opens:'slots', label:'Loophole Slots', desc:`Three reels, six symbols, one dream. Progressive jackpot: ${fmt$(Math.floor(G.jackpot ?? 250))}.`, hours:0,
        fx:[['6 min a pull (10 an hour)', 'time']], check: () => p.hours * 60 - (p.casMin || 0) < 6 ? 'Not enough time left this week' : '', run: () => '{n} sat down at the slot machines.' });
      add({ id:'game_bj', group:'games', opens:'bj', label:'Blackjack', desc:'Beat the dealer to 21. Blackjack pays 3 to 2. Dealer stands on 17.', hours:0,
        fx:[['12 min a hand (5 an hour)', 'time']], check: () => p.hours * 60 - (p.casMin || 0) < 12 ? 'Not enough time left this week' : '', run: () => '{n} sat down at the blackjack table.' });
      add({ id:'game_wheel', group:'games', opens:'wheel', label:'The Wheel of Somebody Else\'s Life', desc:'$100 a spin, one spin a week. Prizes may include other people\'s money, hours, moods and a goose.', hours:0,
        fx:[['Spin: $100 + 1h', 'cost'], ['Affects rivals', 'bad']], check: () => p.wheelSpun ? 'You already spun this week. The wheel needs to rest.' : '', run: () => '' });
      add({ id:'wheel_spin', group:'hidden', label:'Spin the wheel', hours:1, cost:100,
        check: () => p.wheelSpun ? 'One spin a week. The wheel needs to rest.' : '',
        run: () => { p.wheelSpun = true; const r = spinWheel(p); p.lastWheel = r.id; return r.msg; } });
      fun('lounge', 'Lounge singer show', 'Crooner covers and bottomless breadsticks.', 2, pr(20), 7, -6);
      break;
    case 'clinic':
      add({ id:'checkup', label:'Checkup', desc:'Cures sickness. The doctor says "hmm" a lot.', hours:2, cost:pr(70), fx:[fxHe(12), ['Cures sickness', 'good']],
        run: () => { p.sick = false; addHealth(p, 12); return '{n} got a checkup.'; } });
      add({ id:'therapy', label:'Therapy session', desc:'Talk it out. Cheaper than a sports car.', hours:2, cost:pr(95), fx:[fxS(p, -28), fxH(4)],
        run: () => { addStress(p, -28); addHappy(p, 4); return '{n} went to therapy.'; } });
      break;
    case 'realty':
      for (const k of RENTALS) {
        const H = HOUSING[k], rent = Math.round(H.rent * G.econ);
        add({ id:'move_' + k, group:'housing', hkey:k, label:H.name, desc:H.desc, hours:4, cost:rent,
          fx:[[`${fmt$(rent)}/month`, 'time'], [`Happiness ${H.happy >= 0 ? '+' : ''}${H.happy}/week`, H.happy >= 0 ? 'good' : 'bad'], ['First month due now', 'time']].concat(H.office ? [['Home office nook', 'good']] : []),
          check: () => p.housing === k ? 'You live here' : '',
          run: () => {
            let note = '';
            if (isOwner(p)) note = sellHouse(p);
            p.housing = k; p.rent = rent; p.rentDueIn = 4;
            return `{n} moved into ${H.name}.${note}`;
          } });
      }
      for (const k of HOMES) {
        const H = HOUSING[k], price = homePrice(k), down = Math.round(price * HOUSE_DOWN) + HOUSE_CLOSING * H.mult;
        const credit = isOwner(p) && p.housing !== k ? Math.round(homeValueOf(p) * .94 - p.mortgage) : 0;
        add({ id:'buy_' + (k === 'house' ? 'house' : k), group:'housing', hkey:k, label:`Buy the ${H.name}`, desc:`${H.desc} Price ${fmt$(price)}: 15% down plus closing, the rest is a mortgage.`, hours:4,
          cost: Math.max(0, down - Math.max(0, credit)),
          fx:[[`Mortgage ≈ ${fmt$(price * (1 - HOUSE_DOWN) * MORT_PAY)}/week`, 'time'], [`Happiness +${H.happy}/week`, 'good'], ['Builds equity', 'good'], ['Can be upgraded', 'good']]
            .concat(credit > 0 ? [[`Sells your current home first (+${fmt$(credit)})`, 'good']] : []),
          check: () => p.housing === k ? 'You own this home' : '',
          run: () => {
            let note = '';
            if (isOwner(p)) { note = sellHouse(p); p.cash -= Math.min(Math.max(0, credit), down); }   // part of the sale already covered the down payment
            p.housing = k; p.mortgage = Math.round(price * (1 - HOUSE_DOWN)); p.mortPay = Math.round(p.mortgage * MORT_PAY); p.rent = 0; p.upgrades = {};
            return `{n} bought the ${H.name}! Mortgage: ${fmt$(p.mortgage)}.${note}`;
          } });
      }
      if (isOwner(p)) {
        add({ id:'paydown', group:'housing', label:'Pay $1,000 toward mortgage', hours:0, cost:0,
          check: () => p.mortgage < 1 ? 'Mortgage is paid off' : !afford(p, Math.min(1000, p.mortgage)) ? 'Not enough money' : '',
          run: () => { const a = Math.min(1000, p.mortgage); spend(p, a); p.ledger.spent -= a; p.mortgage -= a; return `{n} paid ${fmt$(a)} toward the mortgage.`; } });
        for (const k in UPGRADES) {
          const U = UPGRADES[k], cost = Math.round(U.cost * G.econ);
          add({ id:'upg_' + k, group:'upgrades', img:`assets/upg/upg_${k}.webp`, label:U.name, desc:U.desc, hours:2, cost,
            fx:[[`Home value +${fmt$(U.cost * UPGRADE_KEEP)}`, 'good']],
            check: () => hasUpg(p, k) ? 'Already installed' : '',
            run: () => { p.upgrades = p.upgrades || {}; p.upgrades[k] = true; addHappy(p, 3); return `{n} installed a ${U.name.toLowerCase()} at the ${HOUSING[p.housing].name}.`; } });
        }
      }
      break;
  }
  const jobList = here === 'hub' ? JOBS : JOBS.filter(j => j.loc === here);
  for (const j of jobList) out.push(jobAction(p, j));
  return out;
}
function desc0(label) {
  const map = { 'Binge a streaming show':'binged a streaming show', 'Play video games':'played video games', 'Bunker Mega Feast':'conquered a Bunker Mega Feast',
    'Karaoke night':'sang karaoke', 'Arcade':'hit the arcade', 'Bowling':'went bowling', 'Live concert':'went to a live concert' };
  return map[label] || label.toLowerCase();
}
function sellHouse(p) {
  const name = HOUSING[p.housing].name;
  const proceeds = Math.round(homeValueOf(p) * .94 - p.mortgage);
  p.cash += proceeds; p.mortgage = 0; p.mortPay = 0; p.upgrades = {};
  if (p.cash < 0) { p.loan += -p.cash; p.cash = 0; }
  return ` Sold the ${name} for ${fmt$(proceeds)} after the mortgage and fees.`;
}

/* ---------- the wheel ---------- */
const WHEEL = [
  { id:'swap',    label:'WALLET SWAP',  w:1,   color:'#ff6f59', text:'Swap wallets with a random rival.' },
  { id:'nothing', label:'NOTHING',      w:3,   color:'#4a3f63', text:'Absolutely nothing happens. The wheel keeps your $100.' },
  { id:'thief',   label:'TIME THIEF',   w:2,   color:'#18a99c', text:'Steal 6 hours from a rival: you get them now, they lose them next week.' },
  { id:'regret',  label:'JACKPOT',      w:1,   color:'#f2a900', text:'Win $1,000. Also stress +30 and happiness -10, because jackpots are complicated.' },
  { id:'diploma', label:'MAIL DIPLOMA', w:1,   color:'#7b4fd1', text:'A diploma arrives in the mail. Nobody asks questions.' },
  { id:'goose',   label:'THE GOOSE',    w:2,   color:'#8fd46a', text:'A goose follows you home. Happiness +10. It eats all your groceries.' },
  { id:'mood',    label:'MOOD SWAP',    w:1.5, color:'#e0559c', text:'Swap happiness with a random rival.' },
  { id:'karma',   label:'KARMA TAX',    w:1.5, color:'#1a8fd6', text:'The richest player in town pays everyone else $100.' },
];
const CERTS = ['itcert', 'fitcert', 'bizcert', 'relicense', 'assoc'];
function spinWheel(p) {
  let tot = WHEEL.reduce((t, s) => t + s.w, 0), r = rng() * tot, seg = WHEEL[0];
  for (const s of WHEEL) { r -= s.w; if (r <= 0) { seg = s; break; } }
  const others = G.players.filter(q => q !== p);
  const rival = others.length ? others[Math.floor(rng() * others.length)] : null;
  let msg = '';
  switch (seg.id) {
    case 'swap':
      if (!rival) { msg = 'There was nobody to swap with. The wheel looks embarrassed.'; break; }
      [p.cash, rival.cash] = [rival.cash, p.cash];
      msg = `{n} swapped wallets with ${rival.name} and now holds ${fmt$(p.cash)} in cash (${rival.name} got ${fmt$(rival.cash)}).`; break;
    case 'thief':
      p.hours += 6;
      if (rival) rival.hourPenalty = (rival.hourPenalty || 0) + 6;
      msg = `{n} stole 6 hours${rival ? ` from ${rival.name}` : ' from the void'}. Time is money.`; break;
    case 'regret':
      earn(p, 1000); addStress(p, 30); addHappy(p, -10);
      msg = '{n} hit the JACKPOT: $1,000. Stress +30, happiness -10.'; break;
    case 'diploma': {
      if (p.course) {
        const d = DEG[p.course.id]; p.course.prog = Math.min(d.sessions, p.course.prog + 2);
        if (p.course.prog >= d.sessions) { p.degrees.push(p.course.id); p.course = null; msg = `A suspicious envelope finished {n}'s ${d.name}. Congratulations?`; }
        else msg = `A suspicious envelope gave {n} 2 free classes toward ${d.name}.`;
      } else {
        const opts = CERTS.filter(x => !p.degrees.includes(x));
        if (opts.length) { const x = opts[Math.floor(rng() * opts.length)]; p.degrees.push(x); msg = `{n} received a mail-order ${DEG[x].name}. Education +${DEG[x].pts}.`; }
        else { earn(p, 300); msg = '{n} already has every certificate, so the wheel paid $300 instead.'; }
      }
      break;
    }
    case 'goose':
      addHappy(p, 10); p.groceries = 0;
      msg = '{n} won a goose. Happiness +10. The goose ate every grocery in the fridge.'; break;
    case 'mood':
      if (!rival) { msg = 'No one to swap moods with.'; break; }
      [p.happiness, rival.happiness] = [rival.happiness, p.happiness];
      msg = `{n} swapped moods with ${rival.name}. Happiness is now ${Math.round(p.happiness)}.`; break;
    case 'karma': {
      const rich = G.players.slice().sort((a, b) => netWorth(b) - netWorth(a))[0];
      let paid = 0;
      for (const q of G.players) if (q !== rich) { payBill(rich, 100, 'the karma tax'); earn(q, 100); paid += 100; }
      msg = `KARMA TAX: ${rich === p ? '{n}' : rich.name} was the richest in town and paid ${fmt$(paid)} to everyone else.`; break;
    }
    default: msg = 'The wheel landed on NOTHING. It keeps the $100. It always keeps the $100.';
  }
  G.players.forEach(normalize);
  return { id:seg.id, msg };
}

/* ---------- events ---------- */
const EVENTS = {
  found:   { w:1,  text:"You found $20 in last winter's coat.", apply: p => { earn(p, 20); } },
  viral:   { w:1,  text:'Your cat video went mildly viral. Happiness +6.', apply: p => addHappy(p, 6) },
  refund:  { w:.7, text:'Surprise tax refund: $150!', apply: p => earn(p, 150) },
  grandma: { w:.8, text:'Grandma mailed a card with $50 inside. Happiness +3.', apply: p => { earn(p, 50); addHappy(p, 3); } },
  cold:    { w:.7, text:"You caught the office cold. You're sick until you get a checkup at the clinic.", ok: p => !p.sick, apply: p => { p.sick = true; } },
  heat:    { w:.6, text:'Heat wave! Everyone is cranky. Stress +8.', apply: p => addStress(p, 8) },
  mold:    { w:1.2, text:'Your landlord "discovered" mold. Happiness -5.', ok: p => p.housing === 'rust', apply: p => addHappy(p, -5) },
  network: { w:.8, text:'A coworker vouched for you. +10h work experience.', ok: p => !!p.job, apply: p => { p.exp += 10; } },
  bonus:   { w:.6, text:'Your boss noticed your hustle. $120 bonus!', ok: p => p.job && p.jobHours >= 30, apply: p => earn(p, 120) },
  ticket:  { w:.8, text:'Scooter parking ticket: $35.', ok: p => p.items.scooter, apply: p => payBill(p, 35, 'a parking ticket') },
  crypto:  { w:.9, text:'A friend swears $BURGERCOIN is going to the moon. Throw $200 at it?', ok: p => afford(p, 250),
    choices: [
      { label:'YOLO ($200)', run: p => { spend(p, 200); if (rng() < .45) { earn(p, 600); addHappy(p, 6); return 'It mooned! You cashed out $600.'; } addHappy(p, -4); return 'It rugged. The $200 is gone.'; } },
      { label:'Hard pass', run: p => 'You kept your $200. Wise.' } ],
    ai: p => (p.persona === 'partier' || p.persona === 'investor') ? 0 : 1 },
  crack:   { w:.8, text:'You dropped your uPhone. Screen repair is $120.', ok: p => p.items.phone,
    choices: [
      { label:'Repair it ($120)', run: p => { payBill(p, 120, 'a screen repair'); return 'Good as new.'; } },
      { label:'Live with the cracks', run: p => { addHappy(p, -4); return 'Every notification now looks haunted. Happiness -4.'; } } ],
    ai: p => afford(p, 400) ? 0 : 1 },
  couch:   { w:.9, text:'Your friend needs help moving a couch up four flights of stairs.',
    choices: [
      { label:'Grab a corner (-5h)', run: p => { p.hours = Math.max(0, p.hours - 5); addHappy(p, 6); return 'Pizza and gratitude. Happiness +6.'; } },
      { label:'"I have a thing"', run: p => { addHappy(p, -2); return 'You feel a little guilty. Happiness -2.'; } } ],
    ai: p => p.persona === 'partier' ? 0 : 1 },
  overtime:{ w:.7, text:'Your manager asks you to cover an extra shift this week for time-and-a-half.', ok: p => !!p.job,
    choices: [
      { label:'Take it (-6h, +pay)', run: p => { const w = wageOf(p, JOB[p.job]); const pay = Math.round(w * 6 * 1.5); p.hours = Math.max(0, p.hours - 6); earn(p, pay); p.exp += 6; p.jobHours += 6; p.workHrs = (p.workHrs || 0) + 6; addStress(p, 8); return `Earned ${fmt$(pay)}. Stress +8.`; } },
      { label:'Decline', run: p => 'Your manager sighs audibly.' } ],
    ai: p => (p.persona === 'grinder' || p.persona === 'investor') ? 0 : 1 },
};
function rollEvent(p) {
  if (rng() > .4) return null;
  const opts = Object.entries(EVENTS).filter(([, e]) => !e.ok || e.ok(p));
  let tot = opts.reduce((t, [, e]) => t + e.w, 0), r = rng() * tot;
  for (const [id, e] of opts) { r -= e.w; if (r <= 0) return id; }
  return null;
}
/* returns {text, result} — call when the turn begins; choice may be undefined for no-choice events */
function resolveEvent(p, choice) {
  const e = EVENTS[p.event]; if (!e) { p.event = null; return null; }
  let result = '';
  if (e.choices) result = e.choices[choice ?? 0].run(p) || '';
  else e.apply(p);
  normalize(p);
  p.event = null;
  return { text: e.text, result };
}

/* ---------- game setup ---------- */
function makePlayer(c, i) {
  const trait = c.kind === 'cpu' ? PERSONAS[c.persona].trait : c.trait;
  return {
    id:i, name:c.name, kind:c.kind, color:c.color, avatar:c.avatar || null, skin:c.skin, hair:c.hair, hairColor:c.hairColor,
    trait, persona: c.kind === 'cpu' ? c.persona : null, diff: c.diff || 'normal',
    loc:0, hours:HOURS, cash: 100 + (trait === 'trustfund' ? 1500 : 0), bank:200, loan:0, shares:{}, basis:{},
    job:null, jobHours:0, exp:0, degrees:[], course:null, clothes:{ 1:12 }, items:{},
    housing:'rust', rent:HOUSING.rust.rent, rentDueIn:4, mortgage:0, mortPay:0,
    groceries:1, fed:false, happiness:50, health:75, stress:20, sick:false, espresso:false,
    fun:{}, gigsDone:[], dressWarn:false, ledger:{ earned:0, spent:0 }, recap:null, event:null, eventMsg:null,
    hist:[], snap:null, done:false,
  };
}
function snapshot(p) { return { nw:netWorth(p), hap:p.happiness, hea:p.health, str:p.stress, edu:eduScore(p), car:careerScore(p) }; }
function recordHist(p, w) {
  p.hist.push({ w, nw:netWorth(p), hap:Math.round(p.happiness), edu:Math.round(eduScore(p)), car:careerScore(p), hea:Math.round(p.health), str:Math.round(p.stress) });
}
function rollGigs() { const ids = GIGS.map(g => g.id); const out = []; while (out.length < 4) { const g = pick(ids); if (!out.includes(g)) out.push(g); } G.gigs = out; }
function newGame(cfg) {
  G = { v:3, seed: (cfg.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0, week:1, turn:0, econ:1, homeValue:48000,
    goals:cfg.goals, weekLimit:cfg.weekLimit || 0, settings:cfg.settings || { speed:'normal', hints:true },
    players:[], stocks:{}, news:null, newsLog:[], gigs:[], log:[], over:null };
  STOCKS.forEach(s => G.stocks[s.id] = { price:s.p, hist:[s.p] });
  cfg.players.forEach((c, i) => G.players.push(makePlayer(c, i)));
  G.news = { t:'Welcome to Hollowbrook! Word is the Joneses just bought a second boat.', week:0, e:0 };
  G.newsLog.push(G.news);
  rollGigs();
  G.players.forEach(p => { p.snap = snapshot(p); recordHist(p, 0); });
  return G;
}

/* ---------- the week ---------- */
function weeklyUpkeep(p) {
  const R = [];
  const H = HOUSING[p.housing];
  if (hasUpg(p, 'garden') && G.week % 2 === 0 && p.groceries < 8) { p.groceries++; R.push(['Your garden grew a week of groceries.', 'note']); }
  if (!p.fed) {
    if (p.groceries > 0) {
      if (hasUpg(p, 'kitchen')) { p.kitchenHalf = !p.kitchenHalf; if (!p.kitchenHalf) p.groceries--; R.push(["Cooked at home in your chef's kitchen.", 'note']); }
      else { p.groceries--; R.push(['Ate groceries at home.', 'note']); }
    }
    else { addHealth(p, -12); p.happiness -= 6; addStress(p, 6); R.push(['You went hungry this week. Health -12, happiness -6.', 'bad']); }
  }
  if (isOwner(p)) {
    if (p.mortgage > 0) {
      const interest = p.mortgage * MORT_RATE;
      const pay = Math.min(Math.round(p.mortgage + interest), p.mortPay);
      p.mortgage = Math.max(0, Math.round(p.mortgage + interest - pay));
      payBill(p, pay, 'your mortgage', R) && R.push([`Mortgage payment: ${fmt$(pay)}.`, 'note']);
    }
  } else {
    p.rentDueIn--;
    if (p.rentDueIn <= 0) { p.rentDueIn = 4; payBill(p, p.rent, 'rent', R) && R.push([`Rent autopaid: ${fmt$(p.rent)}.`, 'note']); }
  }
  const t = clothesTier(p);
  if (t > 0) { p.clothes[t]--; if (p.clothes[t] <= 0) { delete p.clothes[t]; R.push([`Your ${CLOTHES[t].name.toLowerCase()} clothes wore out.`, 'bad']); } }
  if (p.job) {
    const j = JOB[p.job];
    if (clothesTier(p) < j.clothes) {
      if (p.dressWarn) { R.push([`Fired as ${j.title} for breaking the dress code.`, 'bad']); p.job = null; p.jobHours = 0; p.dressWarn = false; }
      else { p.dressWarn = true; R.push([`Dress code warning! Buy ${CLOTHES[j.clothes].name.toLowerCase()} clothes this week or lose your job.`, 'bad']); }
    } else p.dressWarn = false;
  }
  addHealth(p, p.trait === 'gymrat' ? -.5 : -1.5);
  if (p.stress > 70) addHealth(p, -4);
  if (p.sick) addHealth(p, -5);
  p.stress = clamp(p.stress - 10 - H.rest, 0, 100);
  let hap = -3 + H.happy + (hasUpg(p, 'kitchen') ? 1 : 0) + (p.items.console ? 1 : 0) + (p.items.phone ? 1 : 0) - (p.trait === 'trustfund' ? 2 : 0);
  if (p.stress > 70) hap -= 5;
  if (p.health < 30) hap -= 4;
  p.happiness += hap;
  if (!p.sick) {
    const c = .02 + Math.max(0, p.stress - 60) * .008 + Math.max(0, 50 - p.health) * .006;
    if (rng() < c) { p.sick = true; R.push(['You came down with something. Visit the clinic.', 'bad']); }
  }
  if (hasUpg(p, 'hottub')) addStress(p, -8);
  if (G.week >= 3 && p.cash > 80 && !hasUpg(p, 'security') && rng() < H.risk) { const lost = Math.floor(p.cash * .5); p.cash -= lost; R.push([`Burglars took ${fmt$(lost)} in cash from your place. Banks exist for a reason.`, 'bad']); }
  const intr = Math.floor(p.bank * .002); if (intr > 0) { p.bank += intr; p.ledger.earned += intr; }
  if (p.loan > 0) { const li = Math.ceil(p.loan * .01); p.loan += li; R.push([`Loan interest: ${fmt$(li)}.`, 'note']); }
  p.fed = false;
  normalize(p);
  return R;
}
function pickNews() {
  const recent = G.newsLog.slice(0, 8).map(n => n.t);
  let n; let guard = 0;
  do { n = pick(NEWS); } while (recent.includes(n.t) && guard++ < 30);
  return n;
}
function endWeek() {
  const lines = new Map();
  for (const p of G.players) lines.set(p.id, weeklyUpkeep(p));
  const n = pickNews();
  const prev = G.econ;
  G.econ = clamp(G.econ + (n.e || 0) + (rng() - .5) * .03 + (1 - G.econ) * .06, .85, 1.25);
  G.homeValue = Math.round(G.homeValue * (1 + .002 + (n.h || 0) + (rng() - .5) * .012));
  G.craftBoost = (G.craftBoost || 1) * (1 + HOUSING.craftsman.growth);
  for (const s of STOCKS) {
    const st = G.stocks[s.id];
    const shock = (n.s && n.s[s.id]) || 0;
    st.price = Math.max(1, Math.round(st.price * Math.exp(s.drift + s.vol * gauss() + shock + (G.econ - prev) * .5) * 100) / 100);
    st.hist.push(st.price); if (st.hist.length > 60) st.hist.shift();
  }
  G.news = { t:n.t, week:G.week, e:Math.round((G.econ - prev) * 1000) / 1000 };
  G.newsLog.unshift(G.news); if (G.newsLog.length > 40) G.newsLog.pop();
  const done = G.week;
  G.week++;
  rollGigs();
  for (const p of G.players) {
    recordHist(p, done);
    const now = snapshot(p);
    p.recap = { week:done, lines:lines.get(p.id), earned:p.ledger.earned, spent:p.ledger.spent,
      d:{ nw:now.nw - p.snap.nw, hap:now.hap - p.snap.hap, hea:now.hea - p.snap.hea, str:now.str - p.snap.str, edu:now.edu - p.snap.edu, car:now.car - p.snap.car } };
    p.snap = now;
    p.ledger = { earned:0, spent:0 }; p.gigsDone = []; p.fun = {}; p.workHrs = 0; p.espresso = false; p.done = false;
    p.hours = Math.max(10, HOURS - (p.sick ? 15 : 0) - (p.health < 25 ? 10 : 0) - (p.hourPenalty || 0));
    if (p.hourPenalty) p.recap.lines.push([`Someone at the casino stole ${p.hourPenalty} of your hours this week.`, 'bad']);
    p.hourPenalty = 0; p.wheelSpun = false; p.casMin = 0;
    p.event = rollEvent(p);
    p.loc = 0;
  }
  G.turn = 0;
  checkGameOver();
}
function standings() {
  return G.players.slice().sort((a, b) => (hasWon(b) - hasWon(a)) || (progress(b) - progress(a)) || (netWorth(b) - netWorth(a)));
}
function checkGameOver() {
  const winners = G.players.filter(hasWon);
  if (winners.length) G.over = { reason:'goals', ids: standings().filter(hasWon).map(p => p.id), week:G.week - 1 };
  else if (G.weekLimit && G.week > G.weekLimit) G.over = { reason:'limit', ids:[standings()[0].id], week:G.week - 1 };
}
/* Older saves were made before the casino joined the ring road; shift positions past it. */
const OLD_ORDER_V2 = ['home','gulp','byte','thread','college','hub','bank','mega','burger','gym','grind','fun','casino','clinic','realty'];
function migrateGame(g) {
  if (!g.v || g.v < 2) { for (const p of g.players) { if (p.loc >= 12) p.loc++; p.basis = p.basis || {}; } g.v = 2; }
  if (g.v < 3) { for (const p of g.players) p.loc = LI[OLD_ORDER_V2[p.loc]] ?? 0; g.v = 3; }
  return g;
}
const LOG_MAX = 1500;   // whole-game history; ~150 KB at the cap
function addLog(p, text, kind) {
  G.log.push({ w:G.week, pid: p ? p.id : -1, text, kind: kind || '' });
  if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
}
