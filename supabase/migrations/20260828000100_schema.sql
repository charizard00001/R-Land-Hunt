-- R-Land Hunt 2.0 — schema
-- Everything is UUID-keyed. No collection or table is ever named from user input.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─── tenancy ─────────────────────────────────────────────────────────────────

create table orgs (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

create type org_role as enum ('owner', 'organiser', 'marshal');

create table org_members (
  org_id  uuid not null references orgs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role    org_role not null default 'organiser',
  primary key (org_id, user_id)
);

create index org_members_user_idx on org_members (user_id);

-- ─── hunts ───────────────────────────────────────────────────────────────────

create type hunt_status as enum ('draft', 'published', 'live', 'paused', 'ended', 'archived');

create table hunts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs on delete cascade,
  name         text not null,
  join_code    char(6) not null unique,
  status       hunt_status not null default 'draft',
  duration_s   int not null default 3600 check (duration_s between 300 and 86400),
  -- Authoritative clock. Elapsed is derived, never accumulated (see hunt_elapsed).
  started_at   timestamptz,
  paused_at    timestamptz,
  paused_total interval not null default '0',
  -- Scoring knobs the organiser can tune per hunt.
  rules        jsonb not null default
               '{"decay_per_min": 1, "first_blood_bonus": 40, "finish_bonus": 300}'::jsonb,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index hunts_org_idx on hunts (org_id) where deleted_at is null;

-- ─── the clue graph ──────────────────────────────────────────────────────────

create type proof_policy as enum ('gps', 'gps_code', 'gps_photo', 'qr');

create table nodes (
  id            uuid primary key default gen_random_uuid(),
  hunt_id       uuid not null references hunts on delete cascade,
  label         text not null default 'Untitled mark',   -- organiser-facing only
  kind          text not null default 'riddle',          -- riddle | cipher | photo | gate | finish
  clue          text not null default '',
  -- [{ "tier": 1, "cost": 10, "text": "..." }, ...] ordered cheapest first
  hints         jsonb not null default '[]'::jsonb,
  -- Organisers edit lat/lng; PostGIS geometry is derived, so the two can never
  -- drift apart and the client never has to speak WKB.
  lat           double precision,
  lng           double precision,
  geom          geography(point, 4326) generated always as (
                  case when lat is null or lng is null then null
                       else st_setsrid(st_makepoint(lng, lat), 4326)::geography end
                ) stored,
  radius_m      int not null default 25 check (radius_m between 5 and 500),
  proof         proof_policy not null default 'gps',
  site_code     text,
  base_points   int not null default 100,
  is_start      boolean not null default false,
  is_terminal   boolean not null default false,
  seq           int not null default 0,
  created_at    timestamptz not null default now()
);

create index nodes_hunt_idx on nodes (hunt_id);
create index nodes_geom_idx on nodes using gist (geom);

create table edges (
  hunt_id     uuid not null references hunts on delete cascade,
  from_node   uuid not null references nodes on delete cascade,
  to_node     uuid not null references nodes on delete cascade,
  -- {"type":"all"} | {"type":"any_n","n":2}
  unlock_rule jsonb not null default '{"type":"all"}'::jsonb,
  primary key (from_node, to_node),
  check (from_node <> to_node)
);

create index edges_to_idx on edges (to_node);

-- ─── teams ───────────────────────────────────────────────────────────────────

create table teams (
  id          uuid primary key default gen_random_uuid(),
  hunt_id     uuid not null references hunts on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 40),
  -- SERVER-OWNED. There is no code path anywhere that lets a client write this.
  score       int not null default 0,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (hunt_id, name)
);

create index teams_hunt_idx on teams (hunt_id);

create table team_members (
  team_id      uuid not null references teams on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null default 'Crew member',
  is_captain   boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on team_members (user_id);

-- ─── progress: the only record of what a team has earned ─────────────────────

create type node_state as enum ('locked', 'active', 'solved', 'skipped');

create table progress (
  team_id        uuid not null references teams on delete cascade,
  node_id        uuid not null references nodes on delete cascade,
  state          node_state not null default 'locked',
  activated_at   timestamptz,
  solved_at      timestamptz,
  hints_taken    int not null default 0,
  points_awarded int not null default 0,
  primary key (team_id, node_id)
);

create index progress_team_state_idx on progress (team_id, state);

-- ─── append-only event log: drives the feed, replay, audit and analytics ─────

create table events (
  id       bigserial primary key,
  hunt_id  uuid not null references hunts on delete cascade,
  team_id  uuid references teams on delete cascade,
  actor_id uuid references auth.users on delete set null,
  kind     text not null,   -- arrival_ok | arrival_fail | hint | skip | flag
                            -- | clock | announce | intervention | join | finish
  data     jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now()
);

create index events_hunt_at_idx on events (hunt_id, at desc);
create index events_team_at_idx on events (team_id, at desc);

-- ─── position pings: live map, replay and plausibility checks ────────────────

create table pings (
  id         bigserial primary key,
  team_id    uuid not null references teams on delete cascade,
  geom       geography(point, 4326) not null,
  accuracy_m real,
  at         timestamptz not null default now()
);

create index pings_team_at_idx on pings (team_id, at desc);

-- ─── derived clock ───────────────────────────────────────────────────────────

-- Elapsed time is computed at read time from timestamps, so a refresh, a dead
-- phone, a pause and a reconnect all produce the same number.
create or replace function hunt_elapsed(h hunts) returns interval
language sql stable as $$
  select case
    when h.started_at is null then interval '0'
    when h.status = 'paused' and h.paused_at is not null
      then h.paused_at - h.started_at - h.paused_total
    else now() - h.started_at - h.paused_total
  end;
$$;

create or replace function hunt_remaining_s(h hunts) returns int
language sql stable as $$
  select greatest(0, h.duration_s - floor(extract(epoch from hunt_elapsed(h)))::int);
$$;
