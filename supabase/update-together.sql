-- Keeping Up with the Joneses · update for "Everyone at once" play
-- Paste this whole file into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- (It adds new functions, switches invite codes to five-letter words, and replaces my_games(); nothing in your existing games is touched.)

-- ---------- invite codes ----------
-- Invite codes are five-letter words from the game's world; once the words run low it falls back to six random characters.
create or replace function public.new_game_code()
returns text language plpgsql set search_path = public as $$
declare
  words constant text[] := array['ATTIC', 'BLOCK', 'BLUFF', 'BOATS', 'BONUS', 'BOOKS', 'BOWLS', 'BREAK', 'BUCKS', 'CARDS', 'CHEER', 'CHIPS', 'CLASS', 'CLERK', 'COINS', 'CROWN', 'CYCLE', 'DAILY', 'DANCE', 'DEALS', 'DEALT', 'DEBTS', 'DECKS', 'DINER', 'EXAMS', 'FEAST', 'FENCE', 'FIRED', 'FRIES', 'FUNDS', 'GAMES', 'GOALS', 'GOOSE', 'GRADE', 'GRAND', 'HAPPY', 'HEADS', 'HIRED', 'HOMES', 'HOUSE', 'JOKER', 'JONES', 'LEARN', 'LEVEL', 'LIFTS', 'LOANS', 'LOFTS', 'LUCKY', 'LUNCH', 'MAJOR', 'MEALS', 'MONEY', 'MOODY', 'MOVIE', 'MUSIC', 'PAPER', 'PARKS', 'PARTY', 'PIZZA', 'PLAYS', 'POKER', 'PORCH', 'PRICE', 'PRIZE', 'QUEST', 'RAISE', 'RELAX', 'RENTS', 'RIVAL', 'ROADS', 'ROLLS', 'ROOMS', 'SCORE', 'SEVEN', 'SHARE', 'SHIFT', 'SHOPS', 'SIGNS', 'SKILL', 'SLEEP', 'SLOTS', 'SMILE', 'SNACK', 'SPINS', 'STAKE', 'STOCK', 'STUDY', 'SUSHI', 'SWEAT', 'TAXES', 'TOWNS', 'TRADE', 'TREAT', 'TREND', 'TURNS', 'TUTOR', 'WAGES', 'WEEKS', 'WHEEL', 'YARDS'];
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  tries integer := 0;
begin
  loop
    tries := tries + 1;
    if tries <= 40 then
      c := words[1 + floor(random() * array_length(words, 1))::int];
    else
      c := '';
      for i in 1..6 loop
        c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
    end if;
    exit when not exists (select 1 from public.games where code = c);
  end loop;
  return c;
end $$;

-- ---------- my games, small enough for a list ----------
drop function if exists public.my_games();
create function public.my_games()
returns table (id uuid, code text, status text, lobby jsonb, week integer, turn_uid text, turn_name text,
               names text[], updated_at timestamptz, turn_started_at timestamptz,
               mode text, pending integer, my_done boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.code, g.status, g.lobby,
         (g.state ->> 'week')::int,
         g.state -> 'players' -> ((g.state ->> 'turn')::int) ->> 'uid',
         g.state -> 'players' -> ((g.state ->> 'turn')::int) ->> 'name',
         case when g.state is null then null
              else array(select p ->> 'name' from jsonb_array_elements(g.state -> 'players') p) end,
         g.updated_at, g.turn_started_at,
         coalesce(g.lobby ->> 'mode', 'turns'),
         case when g.state is null then null
              else (select count(*)::int from jsonb_array_elements(g.state -> 'players') p where coalesce((p ->> 'done')::boolean, false) = false) end,
         coalesce((g.state -> 'players' -> gp.seat ->> 'done')::boolean, false)
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.user_id = auth.uid()
  order by g.updated_at desc
  limit 30;
$$;

-- =====================================================================================
-- "Everyone at once" mode (lobby.mode = 'together'). Each player plays their own week and saves only
-- their own seat; the week rolls over when every seat is done (or the week timer has run out).
-- =====================================================================================

-- cheap probe so the client can tell whether this database has the simultaneous-play functions
create or replace function public.together_ready() returns boolean language sql stable as $$ select true $$;

-- save my own seat (or a CPU seat) during the week
create or replace function public.submit_seat(p_game uuid, p_seat integer, p_week integer, p_player jsonb, p_log jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.games;
  cur jsonb;
  st jsonb;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if coalesce(g.lobby ->> 'mode', 'turns') <> 'together' then raise exception 'not_together'; end if;
  if (g.state ->> 'week')::int <> p_week then raise exception 'conflict'; end if;
  cur := g.state -> 'players' -> p_seat;
  if cur is null then raise exception 'bad_seat'; end if;
  if not (cur ->> 'uid' = me::text or cur ->> 'kind' = 'cpu') then raise exception 'not_your_turn'; end if;
  if (p_player ->> 'uid') is distinct from (cur ->> 'uid') then raise exception 'bad_seat'; end if;
  st := jsonb_set(g.state, array['players', p_seat::text], p_player);
  if p_log is not null and jsonb_typeof(p_log) = 'array' and jsonb_array_length(p_log) > 0 then
    st := jsonb_set(st, '{log}', coalesce(st -> 'log', '[]'::jsonb) || p_log);
  end if;
  update public.games set state = st, version = version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

-- roll the week over: allowed once every seat is done, or when the week timer has run out
create or replace function public.advance_week(p_game uuid, p_base integer, p_state jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  hours numeric;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if coalesce(g.lobby ->> 'mode', 'turns') <> 'together' then raise exception 'not_together'; end if;
  if g.version <> p_base then raise exception 'conflict'; end if;
  if (p_state ->> 'week')::int <> (g.state ->> 'week')::int + 1 then raise exception 'conflict'; end if;
  hours := coalesce((g.lobby ->> 'timerHours')::numeric, 0);
  if not (hours > 0 and g.turn_started_at + make_interval(secs => hours * 3600) < now())
     and exists (select 1 from jsonb_array_elements(g.state -> 'players') p where coalesce((p ->> 'done')::boolean, false) = false)
  then raise exception 'not_ready'; end if;
  update public.games
     set state = p_state, version = version + 1, updated_at = now(),
         status = case when coalesce(p_state -> 'over', 'null'::jsonb) <> 'null'::jsonb then 'over' else 'active' end,
         turn_key = (p_state ->> 'week') || ':0', turn_started_at = now()
   where id = p_game;
  return g.version + 1;
end $$;

-- the wheel: spinning pauses the table while the other players may buy insurance
create or replace function public.wheel_start(p_game uuid, p_seat integer, p_player jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.games;
  cur jsonb;
  st jsonb;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if coalesce(g.lobby ->> 'mode', 'turns') <> 'together' then raise exception 'not_together'; end if;
  cur := g.state -> 'players' -> p_seat;
  if cur is null or cur ->> 'uid' is distinct from me::text then raise exception 'not_your_turn'; end if;
  if g.state -> 'wheel' ->> 'status' = 'open' then raise exception 'wheel_busy'; end if;
  st := jsonb_set(g.state, array['players', p_seat::text], p_player);
  st := jsonb_set(st, '{wheel}', jsonb_build_object(
          'id', gen_random_uuid()::text, 'status', 'open', 'by', p_seat,
          'at', extract(epoch from now())::bigint, 'window', 30,
          'insured', '{}'::jsonb, 'passed', '[]'::jsonb));
  update public.games set state = st, version = version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

-- another player buys insurance against one outcome (p_outcome) or passes (null)
create or replace function public.wheel_choice(p_game uuid, p_seat integer, p_outcome text, p_player jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.games;
  cur jsonb;
  w  jsonb;
  st jsonb;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  w := g.state -> 'wheel';
  if w is null or w ->> 'status' <> 'open' then raise exception 'wheel_closed'; end if;
  cur := g.state -> 'players' -> p_seat;
  if cur is null or cur ->> 'uid' is distinct from me::text or (w ->> 'by')::int = p_seat then raise exception 'not_your_turn'; end if;
  if (w -> 'insured') ? p_seat::text or (w -> 'passed') @> to_jsonb(p_seat) then return g.version; end if;   -- already chose
  if p_outcome is not null then
    if p_outcome not in ('swap', 'thief', 'mood', 'karma') then raise exception 'bad_lobby'; end if;
    st := jsonb_set(g.state, array['players', p_seat::text], p_player);
    st := jsonb_set(st, array['wheel', 'insured', p_seat::text], to_jsonb(p_outcome));
  else
    st := jsonb_set(g.state, '{wheel,passed}', (w -> 'passed') || to_jsonb(p_seat));
  end if;
  update public.games set state = st, version = version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

-- the spinner (or, if they vanish, anyone after the window) settles the wheel
create or replace function public.wheel_finish(p_game uuid, p_base integer, p_state jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.games;
  w  jsonb;
  spinner jsonb;
  stale boolean;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if g.version <> p_base then raise exception 'conflict'; end if;
  w := g.state -> 'wheel';
  if w is null or w ->> 'status' <> 'open' then raise exception 'wheel_closed'; end if;
  spinner := g.state -> 'players' -> (w ->> 'by')::int;
  stale := extract(epoch from now()) > (w ->> 'at')::bigint + (w ->> 'window')::int + 20;
  if not (spinner ->> 'uid' = me::text or stale) then raise exception 'not_your_turn'; end if;
  if p_state -> 'wheel' ->> 'status' <> 'done' or p_state -> 'wheel' ->> 'id' <> w ->> 'id' then raise exception 'conflict'; end if;
  update public.games set state = p_state, version = version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

revoke all on function public.together_ready() from public, anon;
revoke all on function public.submit_seat(uuid, integer, integer, jsonb, jsonb) from public, anon;
revoke all on function public.advance_week(uuid, integer, jsonb) from public, anon;
revoke all on function public.wheel_start(uuid, integer, jsonb) from public, anon;
revoke all on function public.wheel_choice(uuid, integer, text, jsonb) from public, anon;
revoke all on function public.wheel_finish(uuid, integer, jsonb) from public, anon;
grant execute on function public.together_ready(), public.submit_seat(uuid, integer, integer, jsonb, jsonb), public.advance_week(uuid, integer, jsonb),
  public.wheel_start(uuid, integer, jsonb), public.wheel_choice(uuid, integer, text, jsonb), public.wheel_finish(uuid, integer, jsonb) to authenticated;


revoke all on function public.my_games() from public, anon;
grant execute on function public.my_games() to authenticated;
