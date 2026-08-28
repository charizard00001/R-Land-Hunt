-- Row Level Security.
--
-- The whole integrity model of the app is this file plus the RPCs in the next
-- migration. The rule that matters most:
--
--   A player cannot SELECT from `nodes`. Not "it is hidden by the UI" — the
--   database refuses the read for their JWT. Clue text, hint text, site codes
--   and coordinates leave the database only through SECURITY DEFINER functions
--   that first check the team has earned them.

-- ─── helpers (SECURITY DEFINER so they don't re-trigger RLS) ─────────────────

create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function is_org_editor(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and m.role in ('owner', 'organiser')
  );
$$;

create or replace function owns_hunt(p_hunt uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hunts h join org_members m on m.org_id = h.org_id
    where h.id = p_hunt and m.user_id = auth.uid()
  );
$$;

create or replace function edits_hunt(p_hunt uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hunts h join org_members m on m.org_id = h.org_id
    where h.id = p_hunt and m.user_id = auth.uid()
      and m.role in ('owner', 'organiser')
  );
$$;

create or replace function in_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members tm
    where tm.team_id = p_team and tm.user_id = auth.uid()
  );
$$;

create or replace function my_hunt_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct t.hunt_id from team_members tm join teams t on t.id = tm.team_id
  where tm.user_id = auth.uid();
$$;

-- ─── enable ──────────────────────────────────────────────────────────────────

alter table orgs         enable row level security;
alter table org_members  enable row level security;
alter table hunts        enable row level security;
alter table nodes        enable row level security;
alter table edges        enable row level security;
alter table teams        enable row level security;
alter table team_members enable row level security;
alter table progress     enable row level security;
alter table events       enable row level security;
alter table pings        enable row level security;

-- ─── orgs ────────────────────────────────────────────────────────────────────

create policy orgs_read on orgs for select
  using (is_org_member(id));

create policy orgs_insert on orgs for insert
  with check (auth.uid() is not null);

create policy org_members_read on org_members for select
  using (user_id = auth.uid() or is_org_member(org_id));

create policy org_members_write on org_members for all
  using (is_org_editor(org_id)) with check (is_org_editor(org_id));

-- ─── hunts ───────────────────────────────────────────────────────────────────
-- Organisers see their org's hunts in full. Players see only the hunts they are
-- playing, and only ever read the public-facing columns from the app.

create policy hunts_read_org on hunts for select
  using (owns_hunt(id));

create policy hunts_read_player on hunts for select
  using (id in (select my_hunt_ids()));

-- Anyone can read a hunt that is live or ended, for the public spectator screen.
create policy hunts_read_public on hunts for select
  using (status in ('live', 'paused', 'ended') and deleted_at is null);

create policy hunts_write on hunts for all
  using (edits_hunt(id)) with check (edits_hunt(id));

create policy hunts_insert on hunts for insert
  with check (is_org_editor(org_id));

-- ─── nodes and edges — ORGANISERS ONLY ───────────────────────────────────────
-- There is deliberately no player-facing SELECT policy here. This single
-- omission is what makes clue text unreadable to the people playing.

create policy nodes_org_all on nodes for all
  using (owns_hunt(hunt_id)) with check (edits_hunt(hunt_id));

create policy edges_org_all on edges for all
  using (owns_hunt(hunt_id)) with check (edits_hunt(hunt_id));

-- ─── teams ───────────────────────────────────────────────────────────────────
-- Name and score are public (that is the leaderboard). Nothing is client-writable:
-- score has no UPDATE policy at all, so only the SECURITY DEFINER RPCs move it.

create policy teams_read on teams for select using (true);

create policy teams_org_write on teams for all
  using (edits_hunt(hunt_id)) with check (edits_hunt(hunt_id));

create policy team_members_read on team_members for select
  using (in_team(team_id) or exists (
    select 1 from teams t where t.id = team_id and owns_hunt(t.hunt_id)
  ));

-- ─── progress ────────────────────────────────────────────────────────────────
-- Readable by your own team (so the UI can show "4 of 7 cleared") and by the
-- organiser. Never writable by anyone: RPCs only.

create policy progress_read on progress for select
  using (in_team(team_id) or exists (
    select 1 from teams t where t.id = team_id and owns_hunt(t.hunt_id)
  ));

-- ─── events ──────────────────────────────────────────────────────────────────

create policy events_read_team on events for select
  using (team_id is not null and in_team(team_id));

create policy events_read_org on events for select
  using (owns_hunt(hunt_id));

-- The public feed on the spectator screen: arrivals and finishes only.
create policy events_read_public on events for select
  using (kind in ('arrival_ok', 'finish', 'announce') and exists (
    select 1 from hunts h
    where h.id = hunt_id and h.status in ('live', 'paused', 'ended')
  ));

-- ─── pings ───────────────────────────────────────────────────────────────────
-- A player may insert their own team's position and read it back. Organisers
-- read every ping in their hunt, which is what draws the live map.

create policy pings_insert on pings for insert
  with check (in_team(team_id));

create policy pings_read on pings for select
  using (in_team(team_id) or exists (
    select 1 from teams t where t.id = team_id and owns_hunt(t.hunt_id)
  ));
