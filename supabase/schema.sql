-- Keeping Up with the Joneses · online play schema
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- Players sign in anonymously (Authentication → Sign In / Providers → "Allow anonymous sign-ins").
-- Clients never write tables directly: every write goes through the functions below, which check
-- membership, whose turn it is and the version number, so a stale or out-of-turn move is refused.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.games (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  host            uuid not null,
  status          text not null default 'lobby' check (status in ('lobby', 'active', 'over')),
  lobby           jsonb not null,             -- seats, goals, week limit, turn timer
  state           jsonb,                      -- the full game state once started
  version         integer not null default 0, -- bumps on every accepted write
  turn_key        text,                       -- "week:turn" of the current turn
  turn_started_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.game_players (
  game_id   uuid not null references public.games (id) on delete cascade,
  user_id   uuid not null,
  seat      integer not null,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);

create index if not exists game_players_user_idx on public.game_players (user_id);

-- ---------- row level security: members can read their games; nobody writes directly ----------
alter table public.games enable row level security;
alter table public.game_players enable row level security;

create or replace function public.is_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_players where game_id = gid and user_id = auth.uid());
$$;

drop policy if exists "members read games" on public.games;
create policy "members read games" on public.games for select to authenticated using (public.is_member(id));

drop policy if exists "members read seats" on public.game_players;
create policy "members read seats" on public.game_players for select to authenticated using (public.is_member(game_id));

-- ---------- helpers ----------
create or replace function public.new_game_code()
returns text language plpgsql set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where code = c);
  end loop;
  return c;
end $$;

-- ---------- create a game (caller becomes host in seat 0) ----------
create or replace function public.create_game(p_lobby jsonb)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.games;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if jsonb_typeof(p_lobby -> 'seats') <> 'array' or jsonb_array_length(p_lobby -> 'seats') not between 1 and 4 then
    raise exception 'bad_lobby';
  end if;
  p_lobby := jsonb_set(p_lobby, '{seats,0,uid}', to_jsonb(me::text));
  insert into public.games (code, host, lobby) values (public.new_game_code(), me, p_lobby) returning * into g;
  insert into public.game_players (game_id, user_id, seat) values (g.id, me, 0);
  return query select g.id, g.code;
end $$;

-- ---------- join by invite code: takes the first open friend seat ----------
create or replace function public.join_game(p_code text, p_name text, p_trait text)
returns table (id uuid, seat integer) language plpgsql security definer set search_path = public as $$
declare
  me    uuid := auth.uid();
  g     public.games;
  s     integer;
  taken integer;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into g from public.games where code = upper(trim(p_code)) for update;
  if not found then raise exception 'no_such_game'; end if;

  select gp.seat into taken from public.game_players gp where gp.game_id = g.id and gp.user_id = me;
  if found then return query select g.id, taken; return; end if;   -- already in this game

  if g.status <> 'lobby' then raise exception 'already_started'; end if;

  select (e.ord - 1)::int into s
  from jsonb_array_elements(g.lobby -> 'seats') with ordinality as e(val, ord)
  where e.val ->> 'kind' = 'invite' and coalesce(e.val ->> 'uid', '') = ''
  order by e.ord limit 1;
  if s is null then raise exception 'game_full'; end if;

  g.lobby := jsonb_set(g.lobby, array['seats', s::text, 'uid'], to_jsonb(me::text));
  g.lobby := jsonb_set(g.lobby, array['seats', s::text, 'name'], to_jsonb(left(coalesce(nullif(trim(p_name), ''), 'Friend'), 16)));
  g.lobby := jsonb_set(g.lobby, array['seats', s::text, 'trait'], to_jsonb(coalesce(p_trait, 'hustler')));

  update public.games set lobby = g.lobby, version = version + 1, updated_at = now() where games.id = g.id;
  insert into public.game_players (game_id, user_id, seat) values (g.id, me, s);
  return query select g.id, s;
end $$;

-- ---------- host edits the lobby before starting (e.g. turn an open seat into a CPU) ----------
create or replace function public.update_lobby(p_game uuid, p_lobby jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or g.host <> auth.uid() then raise exception 'not_host'; end if;
  if g.status <> 'lobby' then raise exception 'already_started'; end if;
  -- seats that friends already claimed cannot be changed by the host
  if exists (
    select 1 from jsonb_array_elements(g.lobby -> 'seats') with ordinality as o(val, ord)
    where coalesce(o.val ->> 'uid', '') <> ''
      and coalesce((p_lobby -> 'seats' -> (o.ord - 1)::int) ->> 'uid', '') <> o.val ->> 'uid'
  ) then raise exception 'seat_taken'; end if;
  update public.games set lobby = p_lobby, version = version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

-- ---------- host starts the game with the first state ----------
create or replace function public.start_game(p_game uuid, p_state jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare g public.games;
begin
  select * into g from public.games where id = p_game for update;
  if not found or g.host <> auth.uid() then raise exception 'not_host'; end if;
  if g.status <> 'lobby' then raise exception 'already_started'; end if;
  update public.games
     set state = p_state, status = 'active', version = version + 1, updated_at = now(),
         turn_key = (p_state ->> 'week') || ':' || (p_state ->> 'turn'), turn_started_at = now()
   where id = p_game;
  return g.version + 1;
end $$;

-- ---------- submit a move ----------
-- Accepted when the caller is a member, the base version matches, and either
--   * the current seat belongs to the caller, or
--   * the current seat is a CPU (any member may drive CPU turns), or
--   * the turn timer for the current seat has run out.
create or replace function public.submit_state(p_game uuid, p_base integer, p_state jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  g        public.games;
  cur_seat jsonb;
  hours    numeric;
  new_key  text;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not public.is_member(p_game) then raise exception 'not_member'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if g.version <> p_base then raise exception 'conflict'; end if;

  cur_seat := g.state -> 'players' -> ((g.state ->> 'turn')::int);
  hours := coalesce((g.lobby ->> 'timerHours')::numeric, 0);
  if not (
       cur_seat ->> 'uid' = me::text
    or cur_seat ->> 'kind' = 'cpu'
    or (hours > 0 and g.turn_started_at + make_interval(secs => hours * 3600) < now())
  ) then raise exception 'not_your_turn'; end if;

  new_key := (p_state ->> 'week') || ':' || (p_state ->> 'turn');
  update public.games
     set state = p_state,
         version = version + 1,
         updated_at = now(),
         status = case when coalesce(p_state -> 'over', 'null'::jsonb) <> 'null'::jsonb then 'over' else 'active' end,
         turn_key = new_key,
         turn_started_at = case when new_key is distinct from g.turn_key then now() else g.turn_started_at end
   where id = p_game;
  return g.version + 1;
end $$;

-- ---------- my games, small enough for a list ----------
create or replace function public.my_games()
returns table (id uuid, code text, status text, lobby jsonb, week integer, turn_uid text, turn_name text,
               names text[], updated_at timestamptz, turn_started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.code, g.status, g.lobby,
         (g.state ->> 'week')::int,
         g.state -> 'players' -> ((g.state ->> 'turn')::int) ->> 'uid',
         g.state -> 'players' -> ((g.state ->> 'turn')::int) ->> 'name',
         case when g.state is null then null
              else array(select p ->> 'name' from jsonb_array_elements(g.state -> 'players') p) end,
         g.updated_at, g.turn_started_at
  from public.games g
  join public.game_players gp on gp.game_id = g.id and gp.user_id = auth.uid()
  order by g.updated_at desc
  limit 30;
$$;

-- ---------- permissions ----------
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.new_game_code() from public, anon, authenticated;
revoke all on function public.create_game(jsonb) from public, anon;
revoke all on function public.join_game(text, text, text) from public, anon;
revoke all on function public.update_lobby(uuid, jsonb) from public, anon;
revoke all on function public.start_game(uuid, jsonb) from public, anon;
revoke all on function public.submit_state(uuid, integer, jsonb) from public, anon;
revoke all on function public.my_games() from public, anon;
grant execute on function public.create_game(jsonb), public.join_game(text, text, text), public.update_lobby(uuid, jsonb),
  public.start_game(uuid, jsonb), public.submit_state(uuid, integer, jsonb), public.my_games(), public.is_member(uuid) to authenticated;

-- ---------- live updates ----------
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
