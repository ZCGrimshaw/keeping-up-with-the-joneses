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


/* ---------- know-how: doing things often makes them quicker ---------- */
const SKILLS = {
  scholar: { name:'Scholar',  icon:'📚', what:'classes',                      lines:['Highlighters are now a personality.', 'You skim textbooks like menus.', 'Professors ask YOU the questions.'] },
  hustler: { name:'Hustler',  icon:'💼', what:'gigs and job applications',    lines:['You can smell a good gig from across town.', 'Your handshake has a reputation.', 'Clients ask for you by name.'] },
  shopper: { name:'Shopper',  icon:'🛍️', what:'shopping and house hunting',   lines:['You know where the good aisles are.', 'Coupons fear you.', 'Cashiers wave you through.'] },
  wellness:{ name:'Wellness', icon:'🧘', what:'workouts, yoga and checkups',  lines:['Your warm-up is now a warm-down.', 'You stretch like it is a sport.', 'Doctors ask for your tips.'] },
  fun:     { name:'Fun',      icon:'🎉', what:'nights out and downtime',      lines:['You know all the good seats.', 'You skip the lines and keep the laughs.', 'You are the plus-one everyone wants.'] },
};
const SKILL_AT = [8, 20, 38], SKILL_CUT = [.12, .24, .35], SKILL_CAP = 6;   // uses for each level, share of time saved, max hours saved a week
const SKILL_IDS = [[/^(online_)?class$/, 'scholar'], [/^(gig_|apply_)/, 'hustler'], [/^(groc[14]|meal|clothes\d|move_|buy_|upg_)/, 'shopper'],
  [/^(workout|yoga|home_workout|nap|checkup|therapy|hottub)$/, 'wellness'], [/^(tv|games|feast|karaoke|arcade|bowling|concert|lounge)$/, 'fun']];
const skillOf = id => { for (const [re, k] of SKILL_IDS) if (re.test(id)) return k; return null; };
const skillUses = (p, k) => (p.skill && p.skill[k]) || 0;
const skillLv = (p, k) => { const n = skillUses(p, k); return n >= SKILL_AT[2] ? 3 : n >= SKILL_AT[1] ? 2 : n >= SKILL_AT[0] ? 1 : 0; };
function skillProgress(p, k) {   // 0..1 toward the next level (1 when maxed)
  const n = skillUses(p, k), lv = skillLv(p, k); if (lv >= 3) return 1;
  const lo = lv ? SKILL_AT[lv - 1] : 0; return (n - lo) / (SKILL_AT[lv] - lo);
}
/* Trims an action's hours by the player's know-how, to the half hour, never under 30 minutes, and never past the weekly cap. */
function applyKnowHow(p, a) {
  const k = skillOf(a.id); if (!k || !(a.hours > 0)) return a;
  a.skill = k;
  const lv = skillLv(p, k); if (!lv) return a;
  const base = a.hours + (k === 'scholar' && p.trait === 'bookworm' ? 2 : 0);   // the bookworm's discount and know-how don't stack: the better one counts
  let h = Math.min(a.hours, Math.max(.5, Math.round(base * (1 - SKILL_CUT[lv - 1]) * 2) / 2));
  let saved = a.hours - h;
  const room = Math.max(0, SKILL_CAP - (p.skillSaved || 0));
  if (saved > room) { saved = Math.floor(room * 2) / 2; h = a.hours - saved; }
  if (saved > 0) { a.saved = saved; a.hours = h; }
  return a;
}
function gainSkill(p, k) {
  const before = skillLv(p, k);
  p.skill = p.skill || {}; p.skill[k] = (p.skill[k] || 0) + 1;
  const now = skillLv(p, k);
  if (now > before) {
    const S = SKILLS[k];
    p.newSkills = p.newSkills || []; p.newSkills.push({ k, lv:now });
    if (!SIM) addLog(p, `${p.name} levelled up ${S.name} (level ${now}): ${Math.round(SKILL_CUT[now - 1] * 100)}% less time on ${S.what}. ${S.lines[now - 1]}`);
  }
}

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
  if (a.saved) p.skillSaved = (p.skillSaved || 0) + a.saved;
  const msg = a.run();
  if (a.skill) gainSkill(p, a.skill);
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
        add({ id:'drop', group:'school', confirm:'Drop it? Progress is lost.', label:'Drop current course', desc:'No refunds. The college already spent it on a fountain.', hours:0,
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
      if (p.job) add({ id:'quit', confirm:'Quit? Your career resets.', label:'Quit your job', desc:`Leave ${JOB[p.job].title}. Dramatic exit optional.`, hours:0, fx:[['Career resets', 'bad']],
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
        run: () => { p.wheelSpun = true; if (G.together) return '{n} put $100 on the wheel.'; const r = spinWheel(p); p.lastWheel = r.id; return r.msg; } });
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
  for (const a of out) applyKnowHow(p, a);
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
/* Insurance (everyone-at-once games): while the table is paused, each rival may pay a premium against ONE outcome
   that could hit them. If the wheel lands there and they're the target, the effect is blocked. */
const INSURANCE_RATE = .15;
const INSURABLE = {
  swap:  { label:'Wallet swap', text:'Your wallet is swapped with the spinner\'s.' },
  thief: { label:'Time thief',  text:'You lose 6 hours next week.' },
  mood:  { label:'Mood swap',   text:'Your happiness is swapped with the spinner\'s.' },
  karma: { label:'Karma tax',   text:'You pay everyone else $100 (only if you are the richest).' },
};
const insurancePremium = p => Math.round(Math.max(0, p.cash + p.bank) * INSURANCE_RATE);
function spinWheel(p, insured) {
  let tot = WHEEL.reduce((t, s) => t + s.w, 0), r = rng() * tot, seg = WHEEL[0];
  for (const s of WHEEL) { r -= s.w; if (r <= 0) { seg = s; break; } }
  const others = G.players.filter(q => q !== p);
  const rival = others.length ? others[Math.floor(rng() * others.length)] : null;
  const shielded = q => !!(q && insured && insured[q.id] === seg.id);
  const blocked = [];
  let msg = '';
  switch (seg.id) {
    case 'swap':
      if (!rival) { msg = 'There was nobody to swap with. The wheel looks embarrassed.'; break; }
      if (shielded(rival)) { blocked.push(rival.id); msg = `{n} landed on WALLET SWAP, but ${rival.name}'s insurance paid out and blocked it.`; break; }
      [p.cash, rival.cash] = [rival.cash, p.cash];
      msg = `{n} swapped wallets with ${rival.name} and now holds ${fmt$(p.cash)} in cash (${rival.name} got ${fmt$(rival.cash)}).`; break;
    case 'thief':
      if (rival && shielded(rival)) { blocked.push(rival.id); msg = `{n} landed on TIME THIEF, but ${rival.name}'s insurance paid out and blocked it.`; break; }
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
      if (shielded(rival)) { blocked.push(rival.id); msg = `{n} landed on MOOD SWAP, but ${rival.name}'s insurance paid out and blocked it.`; break; }
      [p.happiness, rival.happiness] = [rival.happiness, p.happiness];
      msg = `{n} swapped moods with ${rival.name}. Happiness is now ${Math.round(p.happiness)}.`; break;
    case 'karma': {
      const rich = G.players.slice().sort((a, b) => netWorth(b) - netWorth(a))[0];
      if (shielded(rich)) { blocked.push(rich.id); msg = `KARMA TAX: ${rich.name} was the richest in town, but their insurance paid out and blocked it.`; break; }
      let paid = 0;
      for (const q of G.players) if (q !== rich) { payBill(rich, 100, 'the karma tax'); earn(q, 100); paid += 100; }
      msg = `KARMA TAX: ${rich === p ? '{n}' : rich.name} was the richest in town and paid ${fmt$(paid)} to everyone else.`; break;
    }
    default: msg = 'The wheel landed on NOTHING. It keeps the $100. It always keeps the $100.';
  }
  G.players.forEach(normalize);
  return { id:seg.id, msg, blocked };
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
    hist:[], snap:null, done:false, skill:{}, skillSaved:0, newSkills:[],
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
    p.ledger = { earned:0, spent:0 }; p.gigsDone = []; p.fun = {}; p.workHrs = 0; p.skillSaved = 0; p.espresso = false; p.done = false;
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
  const entry = { w:G.week, pid: p ? p.id : -1, text, kind: kind || '' };
  G.log.push(entry);
  if (typeof ONLINE !== 'undefined' && ONLINE && G.together && ONLINE.pendingLog) ONLINE.pendingLog.push(entry);   // sent with the next seat save
  if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
}

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

/* ===================== Online play: backends ===================== */
/* Two interchangeable backends with the same interface:
     Supabase  — the real thing, configured in config.js (window.KUWTJ_CONFIG)
     Local     — a same-browser test double (?backend=local); each tab is a different player.
   Interface (all async):
     init() -> uid · createGame(lobby) -> {id, code} · joinGame(code, name, trait) -> {id, seat}
     getGame(id) -> row · myGames() -> rows · updateLobby(id, lobby) · startGame(id, state) -> version
     submit(id, baseVersion, state) -> version (throws Error('conflict' | 'not_your_turn' | ...))
     subscribe(id, onChange) -> unsubscribe
   Everyone-at-once games add: togetherReady() · submitSeat(id, seat, week, player, log) · advanceWeek(id, base, state)
     wheelStart(id, seat, player) · wheelChoice(id, seat, outcome|null, player) · wheelFinish(id, base, state)   */

/* Invite codes are five-letter words from the game's world (the database has the same list). */
const CODE_WORDS = ["ATTIC", "BLOCK", "BLUFF", "BOATS", "BONUS", "BOOKS", "BOWLS", "BREAK", "BUCKS", "CARDS", "CHEER", "CHIPS", "CLASS", "CLERK", "COINS", "CROWN", "CYCLE", "DAILY", "DANCE", "DEALS", "DEALT", "DEBTS", "DECKS", "DINER", "EXAMS", "FEAST", "FENCE", "FIRED", "FRIES", "FUNDS", "GAMES", "GOALS", "GOOSE", "GRADE", "GRAND", "HAPPY", "HEADS", "HIRED", "HOMES", "HOUSE", "JOKER", "JONES", "LEARN", "LEVEL", "LIFTS", "LOANS", "LOFTS", "LUCKY", "LUNCH", "MAJOR", "MEALS", "MONEY", "MOODY", "MOVIE", "MUSIC", "PAPER", "PARKS", "PARTY", "PIZZA", "PLAYS", "POKER", "PORCH", "PRICE", "PRIZE", "QUEST", "RAISE", "RELAX", "RENTS", "RIVAL", "ROADS", "ROLLS", "ROOMS", "SCORE", "SEVEN", "SHARE", "SHIFT", "SHOPS", "SIGNS", "SKILL", "SLEEP", "SLOTS", "SMILE", "SNACK", "SPINS", "STAKE", "STOCK", "STUDY", "SUSHI", "SWEAT", "TAXES", "TOWNS", "TRADE", "TREAT", "TREND", "TURNS", "TUTOR", "WAGES", "WEEKS", "WHEEL", "YARDS"];
const NETCFG = (typeof window !== 'undefined' && window.KUWTJ_CONFIG) || {};

function netErr(e) {
  const m = String((e && (e.message || e.msg || e.error_description)) || e || 'error');
  const known = ['conflict', 'not_your_turn', 'no_such_game', 'game_full', 'already_started', 'not_host', 'not_member', 'not_active', 'seat_taken', 'not_signed_in', 'bad_lobby', 'not_together', 'bad_seat', 'wheel_busy', 'wheel_closed', 'not_ready'];
  let k = known.find(x => m.includes(x));
  if (!k && /Could not find the function|schema cache|does not exist/i.test(m)) k = 'needs_update';
  const err = new Error(k || m); err.code = k || 'network'; return err;
}
const NET_MSG = {
  no_such_game: "There's no game with that code. Check the letters and try again.",
  game_full: 'That game has no open seats left.',
  already_started: 'That game has already started without you.',
  not_your_turn: "It isn't your turn anymore. The game refreshed.",
  conflict: 'The game changed on another device. It refreshed.',
  network: "Couldn't reach the game server. Check your connection and try again.",
  seat_taken: 'A friend already took that seat, so it can\'t be changed. The lobby refreshed.',
  not_host: 'Only the host can change the game.',
  needs_update: 'Everyone-at-once play needs a one-time update to the game database. Ask whoever set up the game to run the latest supabase/schema.sql.',
  not_together: "That game isn't set up for everyone-at-once play.",
  bad_seat: "That seat isn't yours.",
  wheel_busy: 'The wheel is already spinning.',
  wheel_closed: 'The wheel has already been settled.',
  not_ready: "Someone is still playing their week.",
  not_signed_in: "Couldn't sign you in. Check that anonymous sign-ins are turned on in Supabase.",
};

/* Same rule the server enforces in submit_state(), shared by the local backend. */
function turnAllowed(row, uid, now) {
  const st = row.state; if (!st) return false;
  const p = st.players[st.turn];
  if (!p) return false;
  if (p.uid === uid || p.kind === 'cpu') return true;
  const h = +((row.lobby || {}).timerHours || 0);
  return h > 0 && row.turn_started_at && (new Date(row.turn_started_at).getTime() + h * 3600e3 < now);
}

/* ---------- Supabase ---------- */
function SupabaseBackend(url, key) {
  const sb = window.supabase.createClient(url, key, { auth:{ persistSession:true, autoRefreshToken:true } });
  let uid = null;
  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw netErr(error); return data; };
  return {
    kind:'supabase',
    async init() {
      let { data:{ session } } = await sb.auth.getSession();
      if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw netErr('not_signed_in'); session = r.data.session; }
      uid = session.user.id; return uid;
    },
    uid: () => uid,
    async createGame(lobby) { const d = await rpc('create_game', { p_lobby:lobby }); return d[0]; },
    async joinGame(code, name, trait) { const d = await rpc('join_game', { p_code:code, p_name:name, p_trait:trait }); return d[0]; },
    async getGame(id) {
      const { data, error } = await sb.from('games').select('*').eq('id', id).maybeSingle();
      if (error) throw netErr(error); if (!data) throw netErr('no_such_game'); return data;
    },
    async getVersion(id) { const { data, error } = await sb.from('games').select('version').eq('id', id).maybeSingle(); if (error) throw netErr(error); return data ? data.version : -1; },
    async myGames() { return (await rpc('my_games', {})) || []; },
    async updateLobby(id, lobby) { return rpc('update_lobby', { p_game:id, p_lobby:lobby }); },
    async startGame(id, state) { return rpc('start_game', { p_game:id, p_state:state }); },
    async submit(id, base, state) { return rpc('submit_state', { p_game:id, p_base:base, p_state:state }); },
    async togetherReady() { return rpc('together_ready', {}); },
    async submitSeat(id, seat, week, player, log) { return rpc('submit_seat', { p_game:id, p_seat:seat, p_week:week, p_player:player, p_log:log || [] }); },
    async advanceWeek(id, base, state) { return rpc('advance_week', { p_game:id, p_base:base, p_state:state }); },
    async wheelStart(id, seat, player) { return rpc('wheel_start', { p_game:id, p_seat:seat, p_player:player }); },
    async wheelChoice(id, seat, outcome, player) { return rpc('wheel_choice', { p_game:id, p_seat:seat, p_outcome:outcome, p_player:player || {} }); },
    async wheelFinish(id, base, state) { return rpc('wheel_finish', { p_game:id, p_base:base, p_state:state }); },
    subscribe(id, onChange) {
      const ch = sb.channel('game-' + id)
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'games', filter:'id=eq.' + id }, () => onChange())
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch (e) {} };
    },
  };
}

/* ---------- Local test double (same browser, one player per tab) ---------- */
function LocalBackend() {
  const KEY = 'kuwtj-local-net';
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kuwtj-local-net') : null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const store = db => { localStorage.setItem(KEY, JSON.stringify(db)); };
  let uid = null;
  const touch = (db, g) => { g.version++; g.updated_at = new Date().toISOString(); store(db); bc && bc.postMessage(g.id); };
  const later = v => new Promise(r => setTimeout(() => r(v), 30));
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return {
    kind:'local',
    async init() {
      uid = sessionStorage.getItem('kuwtj-local-uid');
      if (!uid) { uid = 'u-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('kuwtj-local-uid', uid); }
      return uid;
    },
    uid: () => uid,
    async createGame(lobby) {
      const db = load(); let code;
      let tries = 0;
      do { code = tries++ < 40 ? CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] : Array.from({ length:6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join(''); } while (Object.values(db).some(g => g.code === code));
      const id = 'g-' + Math.random().toString(36).slice(2, 10);
      lobby = JSON.parse(JSON.stringify(lobby)); lobby.seats[0].uid = uid;
      db[id] = { id, code, host:uid, status:'lobby', lobby, state:null, version:0, members:{ [uid]:0 }, turn_key:null, turn_started_at:null, updated_at:new Date().toISOString() };
      store(db); return later({ id, code });
    },
    async joinGame(code, name, trait) {
      const db = load(); const g = Object.values(db).find(x => x.code === String(code).trim().toUpperCase());
      if (!g) throw netErr('no_such_game');
      if (g.members[uid] != null) return later({ id:g.id, seat:g.members[uid] });
      if (g.status !== 'lobby') throw netErr('already_started');
      const s = g.lobby.seats.findIndex(x => x.kind === 'invite' && !x.uid);
      if (s < 0) throw netErr('game_full');
      Object.assign(g.lobby.seats[s], { uid, name:(String(name || '').trim() || 'Friend').slice(0, 16), trait:trait || 'hustler' });
      g.members[uid] = s; touch(db, g); return later({ id:g.id, seat:s });
    },
    async getGame(id) { const g = load()[id]; if (!g || g.members[uid] == null) throw netErr('no_such_game'); return later(JSON.parse(JSON.stringify(g))); },
    async getVersion(id) { const g = load()[id]; return g ? g.version : -1; },
    async myGames() {
      return later(Object.values(load()).filter(g => g.members[uid] != null).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(g => {
        const t = g.state && g.state.players[g.state.turn];
        return { id:g.id, code:g.code, status:g.status, lobby:g.lobby, week:g.state && g.state.week, turn_uid:t && t.uid, turn_name:t && t.name,
          names:g.state && g.state.players.map(p => p.name), updated_at:g.updated_at, turn_started_at:g.turn_started_at,
          mode:g.lobby.mode || 'turns', pending:g.state ? g.state.players.filter(p => !p.done).length : null,
          my_done:!!(g.state && g.state.players[g.members[uid]] && g.state.players[g.members[uid]].done) };
      }));
    },
    async updateLobby(id, lobby) {
      const db = load(), g = db[id]; if (!g || g.host !== uid) throw netErr('not_host'); if (g.status !== 'lobby') throw netErr('already_started');
      if (g.lobby.seats.some((s, i) => s.uid && (!lobby.seats[i] || lobby.seats[i].uid !== s.uid))) throw netErr('seat_taken');
      g.lobby = lobby; touch(db, g); return later(g.version);
    },
    async startGame(id, state) {
      const db = load(), g = db[id]; if (!g || g.host !== uid) throw netErr('not_host'); if (g.status !== 'lobby') throw netErr('already_started');
      g.state = state; g.status = 'active'; g.turn_key = state.week + ':' + state.turn; g.turn_started_at = new Date().toISOString(); touch(db, g); return later(g.version);
    },
    async submit(id, base, state) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      if (g.status !== 'active') throw netErr('not_active');
      if (g.version !== base) throw netErr('conflict');
      if (!turnAllowed(g, uid, Date.now())) throw netErr('not_your_turn');
      const key = state.week + ':' + state.turn;
      if (key !== g.turn_key) { g.turn_key = key; g.turn_started_at = new Date().toISOString(); }
      g.state = state; g.status = state.over ? 'over' : 'active'; touch(db, g); return later(g.version);
    },
    async togetherReady() { return later(true); },
    async submitSeat(id, seat, week, player, log) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      if (g.status !== 'active') throw netErr('not_active');
      if ((g.lobby.mode || 'turns') !== 'together') throw netErr('not_together');
      if (g.state.week !== week) throw netErr('conflict');
      const cur = g.state.players[seat]; if (!cur) throw netErr('bad_seat');
      if (!(cur.uid === uid || cur.kind === 'cpu')) throw netErr('not_your_turn');
      if ((player.uid || null) !== (cur.uid || null)) throw netErr('bad_seat');
      g.state.players[seat] = player;
      if (log && log.length) g.state.log = (g.state.log || []).concat(log);
      touch(db, g); return later(g.version);
    },
    async advanceWeek(id, base, state) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      if (g.status !== 'active') throw netErr('not_active');
      if ((g.lobby.mode || 'turns') !== 'together') throw netErr('not_together');
      if (g.version !== base) throw netErr('conflict');
      if (state.week !== g.state.week + 1) throw netErr('conflict');
      const h = +(g.lobby.timerHours || 0), expired = h > 0 && g.turn_started_at && new Date(g.turn_started_at).getTime() + h * 3600e3 < Date.now();
      if (!expired && g.state.players.some(p => !p.done)) throw netErr('not_ready');
      g.state = state; g.status = state.over ? 'over' : 'active'; g.turn_key = state.week + ':0'; g.turn_started_at = new Date().toISOString();
      touch(db, g); return later(g.version);
    },
    async wheelStart(id, seat, player) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      if (g.status !== 'active') throw netErr('not_active');
      if ((g.lobby.mode || 'turns') !== 'together') throw netErr('not_together');
      const cur = g.state.players[seat]; if (!cur || cur.uid !== uid) throw netErr('not_your_turn');
      if (g.state.wheel && g.state.wheel.status === 'open') throw netErr('wheel_busy');
      g.state.players[seat] = player;
      g.state.wheel = { id:'w-' + Math.random().toString(36).slice(2, 9), status:'open', by:seat, at:Math.floor(Date.now() / 1000), window:30, insured:{}, passed:[] };
      touch(db, g); return later(g.version);
    },
    async wheelChoice(id, seat, outcome, player) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      const w = g.state && g.state.wheel; if (!w || w.status !== 'open') throw netErr('wheel_closed');
      const cur = g.state.players[seat]; if (!cur || cur.uid !== uid || w.by === seat) throw netErr('not_your_turn');
      if (w.insured[seat] || w.passed.includes(seat)) return later(g.version);
      if (outcome) { g.state.players[seat] = player; w.insured[seat] = outcome; } else w.passed.push(seat);
      touch(db, g); return later(g.version);
    },
    async wheelFinish(id, base, state) {
      const db = load(), g = db[id];
      if (!g || g.members[uid] == null) throw netErr('not_member');
      if (g.version !== base) throw netErr('conflict');
      const w = g.state && g.state.wheel; if (!w || w.status !== 'open') throw netErr('wheel_closed');
      const stale = Date.now() / 1000 > w.at + w.window + 20;
      if (!(g.state.players[w.by].uid === uid || stale)) throw netErr('not_your_turn');
      if (!state.wheel || state.wheel.status !== 'done' || state.wheel.id !== w.id) throw netErr('conflict');
      g.state = state; touch(db, g); return later(g.version);
    },
    subscribe(id, onChange) {
      const h = e => { if (e.data === id) onChange(); };
      bc && bc.addEventListener('message', h);
      const s = e => { if (e.key === KEY) onChange(); };
      window.addEventListener('storage', s);
      return () => { bc && bc.removeEventListener('message', h); window.removeEventListener('storage', s); };
    },
  };
}

function pickBackend() {
  let q = '';
  try { q = new URLSearchParams(location.search).get('backend') || ''; } catch (e) {}
  if (q === 'local') return LocalBackend();
  if (NETCFG.supabaseUrl && NETCFG.supabaseKey && typeof window !== 'undefined' && window.supabase) return SupabaseBackend(NETCFG.supabaseUrl, NETCFG.supabaseKey);
  return null;
}

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
  if (state === 'open') turnChime('ins:' + w.id);
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
let prefs = { seenHelp:false, speed:'normal', hints:true, jobFilter:false, sound:false };
let setup = null;

/* A short two-note chime made with Web Audio (no sound files). Browsers only allow audio after the player has clicked
   or tapped once, so the first interaction wakes the audio engine up. */
let AUDIO = null, lastChime = '';
function audioCtx() {
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!AUDIO) AUDIO = new C(); if (AUDIO.state === 'suspended') AUDIO.resume(); return AUDIO; } catch (e) { return null; }
}
function chime() {
  const ac = audioCtx(); if (!ac) return;
  const t0 = ac.currentTime + .02;
  [[659.25, 0], [880, .17]].forEach(([f, d]) => {      // E5 then A5
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(.22, t0 + d + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + d + .7);
    o.connect(g); g.connect(ac.destination); o.start(t0 + d); o.stop(t0 + d + .75);
  });
}
function turnChime(key) { if (prefs.sound && key !== lastChime) { lastChime = key; chime(); } }
document.addEventListener('pointerdown', () => { if (prefs.sound) audioCtx(); }, { passive:true });
document.addEventListener('keydown', () => { if (prefs.sound) audioCtx(); });
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
  $('#opt-mode-row').hidden = !setup.online; $('#opt-mode').value = setup.mode || 'turns';
  const tg = setup.mode === 'together';
  $('#opt-timer-row > span').textContent = tg ? 'Week timer' : 'Turn timer';
  [...$('#opt-timer').options].forEach(o => { o.text = +o.value ? (+o.value === 72 ? '3 days' : o.value + ' hours') + (tg ? ' per week' : ' per turn') : tg ? 'No week timer' : 'No turn timer'; });
  $('#opt-timer-row p').textContent = tg ? 'When time is up, any player can skip the stragglers and start the next week.' : 'When someone runs out of time, any other player can skip their week.';
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
    else if (t.id === 'opt-mode') { setup.mode = t.value; renderSetup(); }
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
      <span class="ring" style="--p:${pc}"><span>${pc}</span></span><span class="nm">${esc(p.name)}</span>${G.together && p.done ? '<span class="tick" title="Done for the week">✓</span>' : ''}</button>`;
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
function knowHowRows(p) {
  return `<div class="khow">${Object.keys(SKILLS).map(k => {
    const S = SKILLS[k], lv = skillLv(p, k), pr = Math.round(skillProgress(p, k) * 100);
    const tip = lv ? `Level ${lv}: ${Math.round(SKILL_CUT[lv - 1] * 100)}% less time on ${S.what}` : `Do more ${S.what} and you'll get quicker at them`;
    return `<div class="kh" title="${esc(tip)}"><span class="ki">${S.icon}</span><span class="kn">${S.name}</span><span class="pips">${[1, 2, 3].map(n => `<i class="${n <= lv ? 'on' : ''}"></i>`).join('')}</span><span class="kbar"><i style="width:${lv >= 3 ? 100 : Math.max(6, pr)}%"></i></span></div>`;
  }).join('')}</div>`;
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
    <div class="card sbox"><h3>Know-how</h3>${knowHowRows(p)}</div>
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
  if (a.saved) c.push(`<span class="chip good" title="${esc(SKILLS[a.skill].name)} know-how">⚡ ${a.saved}h faster</span>`);
  if (a.cost) c.push(`<span class="chip cost">${fmt$(a.cost)}</span>`);
  for (const [t, k] of a.fx) c.push(`<span class="chip ${k}">${esc(t)}</span>`);
  return c.join('');
}
function actCard(p, a) {
  const why = canDo(p, a);
  return `<button class="act${a.img ? ' has-img' : ''}" data-act="${a.id}" ${a.confirm ? `data-confirm="${esc(a.confirm)}"` : ''} ${why ? 'disabled' : ''}>${a.img ? `<img class="act-img" src="${a.img}" alt="">` : ''}<span class="act-t">${esc(a.label)}</span>${a.desc ? `<span class="act-d">${esc(a.desc)}</span>` : ''}<span class="chips">${chipsFor(p, a)}</span>${why ? `<span class="why">${esc(why)}</span>` : ''}</button>`;
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
function disarm(b) {
  clearTimeout(b._t); delete b.dataset.armed; b.classList.remove('armed');
  for (const sel of ['.act-t', '.act-d']) { const el = b.querySelector(sel); if (el && el.dataset.was != null) { el.textContent = el.dataset.was; delete el.dataset.was; } }
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
  const lvBefore = (p.newSkills || []).length;
  const msg = doAction(p, a);
  addLog(p, named(p, msg));
  toast(you(msg), /graduated|WON|hired|bought the Starter/.test(msg) ? 'good' : '');
  const fresh = (p.newSkills || []).slice(lvBefore);
  if (fresh.length) setTimeout(() => toast(`⚡ ${SKILLS[fresh[0].k].name} level ${fresh[0].lv}! You'll see the details next week.`, 'good'), 700);
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
  if (together()) { tgEndWeek(); return; }
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
  if (ONLINE || multi) turnChime(G.week + ':' + (G.together ? p.id : G.turn));
  if (ONLINE && !G.together) { G.turnKey = turnKey(); save(); }
  let eventHTML = '';
  let needChoice = false, evImg = '';
  if (p.event) {
    const e = EVENTS[p.event];
    evImg = `<img class="evimg" id="evimg" src="assets/evt/evt_${p.event}.webp" alt="">`;
    if (e.choices) { needChoice = true; eventHTML = `<div class="eventbox">${evImg}<span class="eyebrow">Something came up</span><span class="ev">${esc(e.text)}</span><div class="choices">${e.choices.map((c, k) => `<button class="btn sm ${k ? 'alt' : ''}" data-evc="${k}">${esc(c.label)}</button>`).join('')}</div></div>`; }
    else { const r = resolveEvent(p); addLog(p, `${p.name}: ${r.text}`); eventHTML = `<div class="eventbox">${evImg}<span class="eyebrow">Something happened</span><span class="ev">${esc(r.text)}</span></div>`; }
  }
  let knowHTML = '';
  if ((p.newSkills || []).length) {
    knowHTML = `<section class="lvlup"><span class="eyebrow">⚡ New know-how</span>${p.newSkills.map(n => { const S = SKILLS[n.k]; return `<div class="lvl"><span class="ki">${S.icon}</span><span><b>${S.name} level ${n.lv}</b><br>${esc(S.lines[n.lv - 1])} ${Math.round(SKILL_CUT[n.lv - 1] * 100)}% less time on ${esc(S.what)}.</span></div>`; }).join('')}</section>`;
    p.newSkills = [];
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
  const cmp = G.together ? compareHTML() : '';
  const standingHTML = cmp ? '' : G.players.length > 1 ? `<section class="grp"><h3>The race</h3><div class="standing">${st.map(q => `<div>${portrait(q, 28)}<span style="min-width:0"><span style="display:block;font-size:.8rem;font-weight:600">${esc(q.name)}</span><span class="gbar" style="--gc:${q.color};display:block"><i style="width:${Math.round(progress(q) * 100)}%"></i></span></span><b class="num">${Math.round(progress(q) * 100)}%</b></div>`).join('')}</div></section>` : '';
  const html = `<div class="mhead intro-head"><div class="intro-hero">${portrait(p, 64)}<div><span class="eyebrow">Week ${G.week}${G.weekLimit ? ` of ${G.weekLimit}` : ''}</span><h2>${multi ? `Pass the device to ${esc(p.name)}` : `Your week, ${esc(p.name)}`}</h2></div></div></div>
    <div class="mbody">
      ${eventHTML}
      ${knowHTML}
      <div class="newsbox"><div class="nh">HOLLOWBROOK HERALD</div><p>${esc(G.news.t)}</p></div>
      ${recap}
      ${cmp}${standingHTML}
    </div>
    <div class="mfoot"><span style="margin-right:auto;align-self:center;font-weight:600">${p.hours}h this week${p.hours < HOURS ? ' (sick or worn out)' : ''}</span><button class="btn go" id="btn-startweek" data-autofocus ${needChoice ? 'disabled' : ''}>Start week</button></div>`;
  openModal(html, { locked:true, cls:G.together ? '' : 'narrow', label:'Start of week' });
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
    if (G.together) p.introWeek = G.week;
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
      ${G && G.together ? S('Everyone at once', 'In this game all players take their week at the same time. When you end your week you wait for the others, then everyone sees the week compared. If someone spins the casino wheel, the game pauses so rivals can buy insurance first.') : ''}
      ${S('Know-how', 'The more you do something, the quicker you get. Classes, gigs, shopping, workouts and nights out each build a skill, and every so often you level up and those activities take less time. The most any week can save you is 6 hours.')}
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
      <div class="opt-row"><label class="check"><input type="checkbox" id="menu-sound" ${prefs.sound ? 'checked' : ''}> Play a sound when it's my turn</label><button class="btn sm alt" id="menu-sound-test" ${prefs.sound ? '' : 'hidden'}>Play sample</button></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn alt" id="menu-title">${ONLINE ? 'Back to your games' : 'Save and exit to title'}</button>${ONLINE ? '' : '<button class="btn warn" id="menu-new">Start a new game</button>'}</div>
      <p id="menu-confirm" style="margin:0;font-weight:600;color:var(--bad)" hidden>Starting over ends this game. Press again to confirm.</p>
    </div>`, { cls:'narrow', label:'Menu' });
  $('#menu-speed').onclick = e => { const b = e.target.closest('[data-mspeed]'); if (!b) return; G.settings.speed = b.dataset.mspeed; prefs.speed = b.dataset.mspeed; savePrefs(); save(); showMenu(); renderHUD(); };
  $('#menu-sound').onchange = e => { prefs.sound = e.target.checked; savePrefs(); $('#menu-sound-test').hidden = !prefs.sound; if (prefs.sound) chime(); };
  $('#menu-sound-test').onclick = chime;
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
    const b = e.target.closest('[data-act]');
    m.querySelectorAll('[data-armed]').forEach(x => { if (x !== b) disarm(x); });
    if (b && !b.disabled) {
      if (b.dataset.confirm && b.dataset.armed !== '1') {   // first tap only asks; second tap does it
        b.dataset.armed = '1'; b.classList.add('armed');
        b.querySelector('.act-t').dataset.was = b.querySelector('.act-t').textContent;
        b.querySelector('.act-t').textContent = 'Tap again to confirm';
        const d = b.querySelector('.act-d'); if (d) { d.dataset.was = d.textContent; d.textContent = b.dataset.confirm; }
        b._t = setTimeout(() => disarm(b), 5000); return;
      }
      humanAct(b.dataset.act);
    }
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
