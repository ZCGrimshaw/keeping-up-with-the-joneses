/* ---------- sound: music and effects, all made with Web Audio (no sound files) ----------
   Three original tunes and a set of small effects are synthesized in the browser. Browsers only allow audio after
   the player has clicked or tapped once, so the first interaction wakes the audio engine up. */
let AUDIO = null;
function audioCtx() {
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!AUDIO) AUDIO = new C(); if (AUDIO.state === 'suspended') AUDIO.resume(); return AUDIO; } catch (e) { return null; }
}

/* ----- music notation helpers ----- */
const NOTE_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const midiOf = n => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
/* "E5:2 G5:2 R:4" -> notes with a start step and a length in steps (R is a rest) */
function noteLine(str) {
  let step = 0; const out = [];
  for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(':'); if (n !== 'R') out.push({ step, midi: midiOf(n), len: +l }); step += +l; }
  return out;
}
const CHORD_Q = { '':[0, 4, 7], m:[0, 3, 7], '7':[0, 4, 7, 10], maj7:[0, 4, 7, 11], m7:[0, 3, 7, 10] };
function chordOf(sym) {
  const m = /^([A-G][b#]?)(.*)$/.exec(sym), pc = midiOf(m[1] + '4') % 12, iv = CHORD_Q[m[2]];
  const top = 60 + pc - (pc > 6 ? 12 : 0);               // chord voicing sits between G3 and F#4 and climbs from there
  return { pc, iv, tones: iv.map(i => top + i) };
}
const bassMidi = pc => 40 + ((pc - 4 + 12) % 12);       // bass notes live between E2 and D#3

/* ----- instruments ----- */
function tone(ac, dest, o) {
  const t = o.t, a = o.a ?? .006, r = o.r ?? .07, dur = Math.max(.02, o.dur), vol = o.vol ?? .1;
  const osc = ac.createOscillator(); osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
  const dec = o.decay ? Math.min(o.decay, dur - a - .005) : 0;
  if (dec > .01) g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol * (o.sus ?? .3)), t + a + dec);
  g.gain.setTargetAtTime(.0001, t + dur, r / 3);
  let node = osc;
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = .5; osc.connect(f); node = f; }
  node.connect(g); g.connect(dest);
  if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + dur + r + .1); }
  osc.start(t); osc.stop(t + dur + r + .1);
}
function noiseBuf(ac) {
  if (!ac._nb) { const n = (ac.sampleRate * 1.5) | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let s = 1234567; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; } ac._nb = b; }
  return ac._nb;
}
function noise(ac, dest, o) {
  const src = ac.createBufferSource(); src.buffer = noiseBuf(ac); src.loop = true;
  const f = ac.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, o.t); f.Q.value = o.q || .7;
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, o.t + o.dur);
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, o.t); g.gain.linearRampToValueAtTime(o.vol ?? .05, o.t + .003); g.gain.exponentialRampToValueAtTime(.0002, o.t + o.dur);
  src.connect(f); f.connect(g); g.connect(dest); src.start(o.t, (o.t * 7.13) % 1); src.stop(o.t + o.dur + .02);
}
const DRUM = {
  kick(ac, d, t, v = .3) { tone(ac, d, { t, f:140, to:45, slide:.12, dur:.15, type:'sine', vol:v, a:.002, r:.05 }); },
  snare(ac, d, t, v = .12) { noise(ac, d, { t, f:1900, type:'bandpass', q:.8, dur:.14, vol:v }); tone(ac, d, { t, f:210, to:150, slide:.08, dur:.08, type:'triangle', vol:v * .6, a:.002, r:.03 }); },
  hat(ac, d, t, v = .04, open) { noise(ac, d, { t, f:7500, dur: open ? .14 : .04, vol:v }); },
  brush(ac, d, t, v = .05) { noise(ac, d, { t, f:3200, type:'bandpass', q:.5, dur:.16, vol:v }); },
};
/* soft electric-piano note: a warm sine with a quick bright "tine" on top */
function epiano(ac, d, t, midi, dur, v) {
  const f = hz(midi);
  tone(ac, d, { t, f, dur, type:'sine', vol:v, a:.004, r:.3, decay:.7, sus:.25 });
  tone(ac, d, { t, f:f * 2, dur:dur * .5, type:'sine', vol:v * .3, a:.003, r:.1, decay:.2, sus:.05 });
}

/* ----- track 1: Hollowbrook Hustle (bouncy, C major, 126 bpm) ----- */
const HUSTLE_CH = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G'];
const HUSTLE_ML = [
  'E5:2 G5:2 C6:3 G5:1 E5:2 G5:2 E5:4', 'A5:2 C6:2 E6:3 C6:1 A5:2 C6:2 A5:4',
  'A5:2 C6:2 F6:3 C6:1 A5:2 C6:2 A5:4', 'B5:2 D6:2 G6:4 R:2 D6:2 B5:2 G5:2',
  'E6:3 C6:1 E6:2 G6:2 E6:4 C6:2 R:2', 'B5:2 E6:2 G6:3 E6:1 B5:2 E6:2 B5:4',
  'A5:2 C6:2 F6:2 E6:2 D6:2 C6:2 A5:4', 'D6:2 B5:2 G5:2 B5:2 D6:4 R:2 G5:2',
  'C6:2 F6:2 A6:3 F6:1 C6:2 F6:2 C6:4', 'D6:2 G6:2 B6:3 G6:1 D6:2 G6:2 D6:4',
  'E6:2 G6:2 B6:3 G6:1 E6:2 G6:2 B6:4', 'E6:2 A6:2 C7:3 A6:1 E6:2 A6:2 C6:4',
  'A5:2 C6:2 F6:2 A6:2 G6:2 F6:2 E6:2 D6:2', 'D6:2 G6:2 B6:2 D7:2 B6:2 G6:2 D6:4',
  'E6:2 G6:2 C7:4 B6:2 G6:2 E6:4', 'B5:2 D6:2 G6:4 F6:2 D6:2 B5:2 G5:2',
].map(noteLine);
function hustleBar(ac, d, b, t0, sd, pass) {
  const ch = chordOf(HUSTLE_CH[b]), T = s => t0 + s * sd + (s % 2 ? .14 * sd : 0), sq = pass % 2 === 0;
  for (const n of HUSTLE_ML[b]) tone(ac, d, { t:T(n.step), f:hz(n.midi), dur:n.len * sd * .9, type: sq ? 'square' : 'triangle', vol: sq ? .05 : .11, lp:3200, a:.01, r:.05, vib: n.len >= 3 ? [5.5, 9] : null });
  const br = bassMidi(ch.pc);
  [[0, br], [4, br + 7], [8, br], [12, br + 7]].forEach(([s, m]) => tone(ac, d, { t:T(s), f:hz(m), dur:sd * 3, type:'triangle', vol:.22, a:.006, r:.05, decay:.2, sus:.6 }));
  [2, 6, 10, 14].forEach(s => ch.tones.forEach(m => tone(ac, d, { t:T(s), f:hz(m), dur:sd * 1.3, type:'square', vol:.02, lp:2200, a:.004, r:.04, decay:.08, sus:.2 })));
  DRUM.kick(ac, d, T(0)); DRUM.kick(ac, d, T(8)); if (b % 2) DRUM.kick(ac, d, T(10), .22);
  DRUM.snare(ac, d, T(4)); DRUM.snare(ac, d, T(12));
  for (let s = 0; s < 16; s += 2) DRUM.hat(ac, d, T(s), s % 4 ? .026 : .042);
  if (b % 8 === 7) [13, 14, 15].forEach((s, k) => DRUM.snare(ac, d, T(s), .07 + k * .03));
}

/* ----- track 2: Sunday Errands (mellow, F major, 92 bpm) ----- */
const ERR_CH = ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Am7', 'Bbmaj7', 'C7', 'Bbmaj7', 'C7', 'Am7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'C7'];
const ERR_ML = [
  'A5:4 C6:4 A5:2 G5:2 F5:4', 'D5:4 F5:4 A5:6 R:2', 'G5:2 A5:2 C6:4 D6:4 C6:4', 'C6:4 A5:2 G5:2 E5:4 R:4',
  'A5:4 C6:4 D6:2 C6:2 A5:4', 'E5:2 G5:2 A5:4 C6:6 R:2', 'D6:4 C6:2 A5:2 F5:4 A5:4', 'G5:4 E5:2 G5:2 C5:8',
  'F6:4 D6:4 C6:2 D6:2 F6:4', 'E6:4 C6:4 G5:4 C6:4', 'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4', 'D6:4 A5:2 F5:2 D5:4 F5:4',
  'G5:2 Bb5:2 D6:4 C6:2 Bb5:2 G5:4', 'C6:4 E6:4 G6:4 E6:2 C6:2', 'A5:4 C6:2 A5:2 F5:8', 'G5:4 E5:2 G5:2 C6:8',
].map(noteLine);
function errandsBar(ac, d, b, t0, sd, pass) {
  const ch = chordOf(ERR_CH[b]), T = s => t0 + s * sd + (s % 2 ? .2 * sd : 0);
  for (const n of ERR_ML[b]) {
    const f = hz(n.midi), dur = n.len * sd * .95;
    tone(ac, d, { t:T(n.step), f, dur, type:'triangle', vol:.1, lp:2600, a:.03, r:.15, vib: n.len >= 4 ? [5, 7] : null });
    tone(ac, d, { t:T(n.step), f:f * 2, dur:dur * .6, type:'sine', vol:.018, a:.03, r:.1 });
  }
  ch.tones.forEach(m => epiano(ac, d, T(0), m, sd * 5, .045));
  ch.tones.slice(1).forEach(m => epiano(ac, d, T(6), m, sd * 3.5, .03));
  ch.tones.slice(2).forEach(m => epiano(ac, d, T(10), m + 12, sd * 3, .024));
  const r = bassMidi(ch.pc);
  [[0, r, 6], [8, r + 7, 4], [12, r + 12, 3]].forEach(([s, m, l]) => tone(ac, d, { t:T(s), f:hz(m), dur:sd * l, type:'triangle', vol:.24, a:.01, r:.1, decay:.3, sus:.5 }));
  DRUM.kick(ac, d, T(0), .16); DRUM.kick(ac, d, T(10), .12);
  DRUM.brush(ac, d, T(4)); DRUM.brush(ac, d, T(12));
  [2, 6, 10, 14].forEach(s => DRUM.hat(ac, d, T(s), .024));
}

/* ----- track 3: Lucky Loophole Lounge (swinging, D minor, 108 bpm, eighth-note grid) ----- */
const LNG_CH = ['Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'G7'];
const LNG_ML = [
  'F5:3 A5:1 D6:2 C6:2', 'B5:2 D6:2 F6:3 R:1', 'E6:3 C6:1 G5:2 E5:2', 'C#6:2 E6:2 G6:2 E6:2',
  'F6:3 D6:1 A5:2 F5:2', 'G5:2 B5:2 D6:2 F6:2', 'E6:4 D6:2 C6:2', 'B5:2 G5:2 D6:2 R:2',
].map(noteLine);
function loungeBar(ac, d, b, t0, sd) {
  const ch = chordOf(LNG_CH[b]), T = s => t0 + s * sd + (s % 2 ? .33 * sd : 0);
  for (const n of LNG_ML[b]) tone(ac, d, { t:T(n.step), f:hz(n.midi), dur:n.len * sd * .92, type:'sawtooth', vol:.04, lp:1500, a:.03, r:.12, vib: n.len >= 3 ? [5, 12] : null });
  const r = bassMidi(ch.pc), nx = bassMidi(chordOf(LNG_CH[(b + 1) % 8]).pc);
  [r, r + ch.iv[1], r + ch.iv[2], nx + (b % 2 ? 1 : -1)].forEach((m, k) => {
    tone(ac, d, { t:T(k * 2), f:hz(m), dur:sd * 1.8, type:'triangle', vol:.3, a:.006, r:.08, decay:.3, sus:.5 });
    tone(ac, d, { t:T(k * 2), f:hz(m), dur:sd * 1.4, type:'sine', vol:.14, a:.006, r:.06 });
  });
  [0, 3].forEach(s => ch.tones.slice(1).forEach(m => epiano(ac, d, T(s), m, sd * 2, .04)));
  [0, 2, 3, 4, 6, 7].forEach(s => DRUM.hat(ac, d, T(s), s % 2 ? .02 : .028));
  DRUM.hat(ac, d, T(2), .04); DRUM.hat(ac, d, T(6), .04);
  DRUM.kick(ac, d, T(0), .1); DRUM.kick(ac, d, T(4), .08);
}
const TRACKS = {
  hustle:  { title:'Hollowbrook Hustle',       bpm:126, spb:4, bars:16, loops:2,  after:'errands', bar:hustleBar, trim:1 },
  errands: { title:'Sunday Errands',           bpm:92,  spb:4, bars:16, loops:1,  after:'hustle',  bar:errandsBar, trim:1.15 },
  lucky:   { title:'Lucky Loophole Lounge',    bpm:108, spb:2, bars:8,  loops:99, after:'lucky',   bar:loungeBar, trim:.62 },
};
for (const k in TRACKS) { const t = TRACKS[k]; t.sd = 60 / (t.bpm * t.spb); t.barDur = t.sd * t.spb * 4; }

/* ----- sound effects ----- */
const coinBlip = (ac, d, t, f, v = .07) => { tone(ac, d, { t, f, dur:.06, type:'square', vol:v, a:.002, r:.02, lp:5000 }); tone(ac, d, { t:t + .06, f:f * 1.335, dur:.22, type:'square', vol:v, a:.002, r:.15, lp:5000, decay:.15, sus:.2 }); };
const SFX = {
  tap(ac, d, t)    { tone(ac, d, { t, f:880, to:660, slide:.04, dur:.04, type:'square', vol:.035, a:.002, r:.02, lp:3000 }); },
  pop(ac, d, t)    { tone(ac, d, { t, f:420, to:760, slide:.07, dur:.07, type:'sine', vol:.1, a:.003, r:.04 }); },
  step(ac, d, t)   { noise(ac, d, { t, f:900, type:'bandpass', q:1, dur:.05, vol:.16 }); },
  coin(ac, d, t)   { coinBlip(ac, d, t, 987.77); },
  spend(ac, d, t)  { tone(ac, d, { t, f:520, to:330, slide:.12, dur:.12, type:'triangle', vol:.12, a:.003, r:.06 }); noise(ac, d, { t, f:2500, dur:.03, vol:.05 }); },
  good(ac, d, t)   { [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, d, { t:t + i * .06, f, dur:.12, type:'triangle', vol:.08, a:.004, r:.1 })); },
  bad(ac, d, t)    { tone(ac, d, { t, f:170, to:110, slide:.22, dur:.24, type:'sawtooth', vol:.07, a:.005, r:.08, lp:900 }); },
  levelup(ac, d, t){ [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { tone(ac, d, { t:t + i * .07, f, dur:.12, type:'square', vol:.03, a:.003, r:.1, lp:4500 }); tone(ac, d, { t:t + i * .07, f, dur:.2, type:'triangle', vol:.06, a:.003, r:.2 }); }); },
  week(ac, d, t)   { noise(ac, d, { t, type:'bandpass', f:300, to:2600, q:1.2, dur:.45, vol:.06 }); [392, 523.25, 659.25].forEach(f => tone(ac, d, { t:t + .32, f, dur:.4, type:'triangle', vol:.08, a:.01, r:.35, decay:.3, sus:.4 })); },
  tick(ac, d, t)   { tone(ac, d, { t, f:1900, dur:.012, type:'square', vol:.05, a:.001, r:.01 }); },
  thunk(ac, d, t)  { tone(ac, d, { t, f:190, to:90, slide:.08, dur:.1, type:'sine', vol:.16, a:.002, r:.05 }); noise(ac, d, { t, f:1200, dur:.03, vol:.05 }); },
  win(ac, d, t)    { [0, .1, .2, .3, .4].forEach((o, i) => coinBlip(ac, d, t + o, 880 * Math.pow(1.122, i), .06)); },
  jackpot(ac, d, t){ [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => { tone(ac, d, { t:t + i * .085, f, dur:.14, type:'square', vol:.05, a:.003, r:.1, lp:5000 }); tone(ac, d, { t:t + i * .085, f:f / 2, dur:.2, type:'triangle', vol:.1, a:.003, r:.15 }); }); [0, .12, .24, .36, .48, .6].forEach((o, i) => coinBlip(ac, d, t + .7 + o, 1046 + i * 90, .05)); },
  lose(ac, d, t)   { tone(ac, d, { t, f:330, to:196, slide:.28, dur:.3, type:'triangle', vol:.1, a:.005, r:.1 }); },
  card(ac, d, t)   { noise(ac, d, { t, type:'bandpass', f:2500, q:.8, dur:.06, vol:.1 }); },
  reveal(ac, d, t) { tone(ac, d, { t, f:600, to:1200, slide:.15, dur:.16, type:'sine', vol:.1, a:.005, r:.1 }); [784, 988, 1175].forEach((f, i) => tone(ac, d, { t:t + .15 + i * .07, f, dur:.2, type:'triangle', vol:.09, a:.004, r:.2 })); },
  victory(ac, d, t){
    [[523.25, 0, .14], [523.25, .16, .14], [523.25, .32, .14], [659.25, .48, .3], [783.99, .8, .18], [1046.5, 1.0, .9]].forEach(([f, o, l]) => {
      tone(ac, d, { t:t + o, f, dur:l, type:'square', vol:.05, a:.004, r:.12, lp:4200 });
      tone(ac, d, { t:t + o, f:f / 2, dur:l, type:'triangle', vol:.12, a:.004, r:.15 });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach(f => tone(ac, d, { t:t + 1.0, f, dur:1.1, type:'triangle', vol:.05, a:.01, r:.5 }));
  },
};

/* ----- live engine ----- */
const SND = { ac:null, music:null, sfx:null, cur:null, scene:'town', last:{}, townNext:'hustle', timer:0, mute:false };
function sndInit() {
  const ac = audioCtx(); if (!ac) return null;
  if (SND.ac !== ac) {
    SND.ac = ac;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2;
    comp.connect(ac.destination);
    SND.music = ac.createGain(); SND.music.connect(comp);
    SND.sfx = ac.createGain(); SND.sfx.connect(comp);
  }
  sndVolumes(); return SND;
}
function sndVolumes() {
  if (!SND.ac) return; const t = SND.ac.currentTime;
  SND.music.gain.setTargetAtTime(prefs.music ? (prefs.musicVol ?? .6) * .9 : 0, t, .05);
  SND.sfx.gain.setTargetAtTime(prefs.sfx ? (prefs.sfxVol ?? .8) * 1.3 : 0, t, .02);
}
function sfx(name) {
  if (!prefs.sfx) return;
  try {
    const s = sndInit(), f = SFX[name]; if (!s || !f) return;
    const n = performance.now(); if (n - (SND.last[name] || 0) < 30) return; SND.last[name] = n;
    f(s.ac, s.sfx, s.ac.currentTime + .005);
  } catch (e) {}
}
function sfxAction(delta) { sfx(delta > 0 ? 'coin' : delta < 0 ? 'spend' : 'pop'); }
function musicStop(P, at, fade) {
  P.dead = true; clearInterval(P.timer);
  const g = P.g.gain; g.cancelScheduledValues(at); g.setTargetAtTime(.0001, at, fade / 3);
  setTimeout(() => { try { P.g.disconnect(); } catch (e) {} }, Math.max(0, (at - SND.ac.currentTime + fade + .8) * 1000));
}
function musicStart(name, at, playlist) {
  const ac = SND.ac, tr = TRACKS[name], g = ac.createGain();
  g.gain.setValueAtTime(.0001, at); g.gain.linearRampToValueAtTime(tr.trim || 1, at + (playlist ? .15 : 1.2));
  g.connect(SND.music);
  const P = { name, g, playlist, bar:0, next:at, loops:0, dead:false, timer:0 };
  const pump = () => {
    if (P.dead) return;
    while (P.next < ac.currentTime + .6) {
      if (P.bar > 0 && P.bar % tr.bars === 0) {
        P.loops++;
        if (playlist && P.loops >= tr.loops) { SND.townNext = tr.after; musicStop(P, P.next, .4); SND.cur = musicStart(tr.after, P.next, true); return; }
      }
      tr.bar(ac, g, P.bar % tr.bars, P.next, tr.sd, Math.floor(P.bar / tr.bars));
      P.next += tr.barDur; P.bar++;
    }
  };
  P.timer = setInterval(pump, 80); pump(); return P;
}
/* scene: 'town' plays the Hustle and Errands tunes in turn; 'casino' plays the lounge */
function musicScene(scene) {
  SND.scene = scene;
  if (!prefs.music || document.hidden) return;
  const s = sndInit(); if (!s) return;
  const c = SND.cur;
  if (c && !c.dead && ((scene === 'casino' && c.name === 'lucky') || (scene === 'town' && c.playlist))) return;
  const at = s.ac.currentTime + .05;
  if (c) musicStop(c, at, 1);
  SND.cur = scene === 'casino' ? musicStart('lucky', at, false) : musicStart(SND.townNext, at, true);
}
function musicOff() { if (SND.cur && SND.ac) { musicStop(SND.cur, SND.ac.currentTime, .4); SND.cur = null; } }
function musicSync() {
  clearTimeout(SND.timer);
  SND.timer = setTimeout(() => {
    if (!prefs.music) { musicOff(); return; }
    const inCasino = (typeof CAS !== 'undefined' && !!CAS) || (typeof LI !== 'undefined' && openLoc === LI.casino && !$('#modal').hidden);
    musicScene(inCasino ? 'casino' : 'town');
  }, 150);
}
function soundOn() { return !!(prefs.music || prefs.sfx); }
function applySound() { savePrefs(); sndInit(); sndVolumes(); musicSync(); renderSoundBtn(); }
function renderSoundBtn() { const b = document.getElementById('btn-sound'); if (b) { b.textContent = soundOn() ? '🔊 Sound on' : '🔇 Sound off'; b.setAttribute('aria-pressed', soundOn()); } }

/* the first tap or key press wakes the engine; hidden tabs stop the music so it never plays to an empty room */
document.addEventListener('pointerdown', () => { if (prefs.sound || soundOn()) { audioCtx(); if (prefs.music && !SND.cur) musicSync(); } }, { passive:true });
document.addEventListener('keydown', () => { if (prefs.sound || soundOn()) { audioCtx(); if (prefs.music && !SND.cur) musicSync(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) musicOff(); else musicSync(); });
document.addEventListener('click', e => {
  if (!prefs.sfx) return;
  const b = e.target.closest && e.target.closest('button, a.btn');
  if (b && !b.disabled && !b.classList.contains('act')) sfx('tap');
}, true);
