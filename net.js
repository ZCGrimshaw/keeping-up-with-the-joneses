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
      do { code = Array.from({ length:6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join(''); } while (Object.values(db).some(g => g.code === code));
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
