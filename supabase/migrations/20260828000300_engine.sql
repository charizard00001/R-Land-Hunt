-- The game engine.
--
-- Every rule that decides a score or unlocks a clue runs here, inside one
-- transaction, next to the data. The client sends a latitude and a longitude
-- and receives a verdict. It never sends a score, and there is no code path
-- anywhere that would accept one.

-- ─── small helpers ───────────────────────────────────────────────────────────

create or replace function gen_join_code() returns char(6)
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I O 0 1
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from hunts where join_code = code);
  end loop;
  return code;
end;
$$;

-- Displayed score = points earned, less the time decay everyone pays equally.
create or replace function team_display_score(p_team uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, t.score - floor(
           extract(epoch from hunt_elapsed(h)) / 60.0
           * coalesce((h.rules->>'decay_per_min')::numeric, 1)
         )::int)
  from teams t join hunts h on h.id = t.hunt_id
  where t.id = p_team;
$$;

-- ─── unlocking ───────────────────────────────────────────────────────────────

-- After a node is solved, open every successor whose unlock rule is now met.
create or replace function unlock_successors(p_team uuid, p_node uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
  needed int;
  got int;
  total int;
begin
  for e in select distinct to_node, unlock_rule from edges where from_node = p_node loop
    select count(*) into total from edges where to_node = e.to_node;
    select count(*) into got
      from edges ed
      join progress p on p.node_id = ed.from_node and p.team_id = p_team
      where ed.to_node = e.to_node and p.state in ('solved', 'skipped');

    needed := case
      when e.unlock_rule->>'type' = 'any_n' then coalesce((e.unlock_rule->>'n')::int, 1)
      else total
    end;

    if got >= needed then
      insert into progress (team_id, node_id, state, activated_at)
      values (p_team, e.to_node, 'active', now())
      on conflict (team_id, node_id) do update
        set state = case when progress.state = 'locked' then 'active' else progress.state end,
            activated_at = coalesce(progress.activated_at, now());
    end if;
  end loop;
end;
$$;

-- Idempotent: give a team its opening clues once the hunt is running.
create or replace function ensure_activated(p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hunt uuid;
  v_status hunt_status;
begin
  select t.hunt_id, h.status into v_hunt, v_status
    from teams t join hunts h on h.id = t.hunt_id where t.id = p_team;

  if v_status not in ('live', 'paused') then return; end if;

  insert into progress (team_id, node_id, state, activated_at)
  select p_team, n.id, 'active', now()
    from nodes n
   where n.hunt_id = v_hunt and n.is_start
  on conflict (team_id, node_id) do nothing;
end;
$$;

-- ─── join ────────────────────────────────────────────────────────────────────

create or replace function join_hunt(
  p_join_code  text,
  p_team_name  text,
  p_display_name text default 'Crew member'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hunt hunts;
  v_team teams;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select * into v_hunt from hunts
   where join_code = upper(btrim(p_join_code)) and deleted_at is null;

  if v_hunt.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_such_hunt');
  end if;
  if v_hunt.status = 'draft' then
    return jsonb_build_object('ok', false, 'reason', 'not_open_yet');
  end if;
  if v_hunt.status in ('ended', 'archived') then
    return jsonb_build_object('ok', false, 'reason', 'hunt_over');
  end if;

  -- Already on a team in this hunt? Go straight back to it.
  select t.* into v_team from teams t
    join team_members tm on tm.team_id = t.id
   where t.hunt_id = v_hunt.id and tm.user_id = v_uid
   limit 1;

  if v_team.id is null then
    select * into v_team from teams
     where hunt_id = v_hunt.id and lower(name) = lower(btrim(p_team_name));

    if v_team.id is null then
      -- Registration closes when the hunt starts.
      if v_hunt.status <> 'published' then
        return jsonb_build_object('ok', false, 'reason', 'registration_closed');
      end if;
      insert into teams (hunt_id, name) values (v_hunt.id, btrim(p_team_name))
      returning * into v_team;

      insert into team_members (team_id, user_id, display_name, is_captain)
      values (v_team.id, v_uid, p_display_name, true);
    else
      insert into team_members (team_id, user_id, display_name)
      values (v_team.id, v_uid, p_display_name)
      on conflict (team_id, user_id) do nothing;
    end if;

    insert into events (hunt_id, team_id, actor_id, kind, data)
    values (v_hunt.id, v_team.id, v_uid, 'join',
            jsonb_build_object('display_name', p_display_name));
  end if;

  perform ensure_activated(v_team.id);

  return jsonb_build_object(
    'ok', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'hunt_id', v_hunt.id,
    'hunt_name', v_hunt.name,
    'status', v_hunt.status
  );
end;
$$;

-- ─── what the player is allowed to see ───────────────────────────────────────

-- Returns the team's state and the text of every clue they have EARNED.
-- Target coordinates are deliberately absent: distance and bearing are computed
-- server-side in record_ping, so the answer never reaches the device.
create or replace function game_state(p_team uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hunt hunts;
  v_team teams;
  v_active jsonb;
  v_total int;
  v_solved int;
begin
  if not in_team(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_team');
  end if;

  select * into v_team from teams where id = p_team;
  select * into v_hunt from hunts where id = v_team.hunt_id;

  perform ensure_activated(p_team);

  select count(*) into v_total from nodes where hunt_id = v_hunt.id;
  select count(*) into v_solved from progress
   where team_id = p_team and state in ('solved', 'skipped');

  select coalesce(jsonb_agg(x order by x->>'seq'), '[]'::jsonb) into v_active from (
    select jsonb_build_object(
      'node_id', n.id,
      'kind', n.kind,
      'seq', n.seq,
      'clue', n.clue,
      'proof', n.proof,
      'needs_code', n.proof in ('gps_code', 'qr'),
      'wants_photo', n.proof = 'gps_photo',
      'is_terminal', n.is_terminal,
      'base_points', n.base_points,
      'hints_taken', p.hints_taken,
      -- Hint text appears only for tiers already bought. The rest are prices.
      'hints', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'tier', (h.ord)::int,
                 'cost', (h.val->>'cost')::int,
                 'bought', (h.ord) <= p.hints_taken,
                 'text', case when (h.ord) <= p.hints_taken then h.val->>'text' else null end
               ) order by h.ord), '[]'::jsonb)
        from jsonb_array_elements(n.hints) with ordinality as h(val, ord)
      )
    ) as x
    from progress p join nodes n on n.id = p.node_id
    where p.team_id = p_team and p.state = 'active'
  ) s;

  return jsonb_build_object(
    'ok', true,
    'team', jsonb_build_object(
      'id', v_team.id, 'name', v_team.name,
      'score', team_display_score(p_team),
      'finished_at', v_team.finished_at),
    'hunt', jsonb_build_object(
      'id', v_hunt.id, 'name', v_hunt.name, 'status', v_hunt.status,
      'remaining_s', hunt_remaining_s(v_hunt), 'total_nodes', v_total),
    'solved', v_solved,
    'active', v_active
  );
end;
$$;

-- ─── position: distance and bearing without ever sending the target ──────────

create or replace function record_ping(
  p_team uuid, p_lat double precision, p_lng double precision,
  p_accuracy real default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pt geography;
  v_out jsonb;
  v_guide text;
begin
  if not in_team(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_team');
  end if;

  -- How much help the organiser chose to give. 'bearing' guides hardest;
  -- 'distance' leaves a circle rather than a point; 'none' only says hot/cold.
  select coalesce(h.rules->>'guidance', 'bearing') into v_guide
    from hunts h join teams t on t.hunt_id = h.id where t.id = p_team;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  insert into pings (team_id, geom, accuracy_m) values (p_team, v_pt, p_accuracy);

  select coalesce(jsonb_agg(jsonb_build_object(
           'node_id', n.id,
           'distance_m', case when v_guide = 'none' then null
                              else round(st_distance(v_pt, n.geom))::int end,
           'bearing_deg', case when v_guide = 'bearing'
                               then round(mod(degrees(st_azimuth(v_pt, n.geom))::numeric + 360, 360))::int
                               else null end,
           'in_range', st_dwithin(v_pt, n.geom, n.radius_m)
         )), '[]'::jsonb)
    into v_out
    from progress p join nodes n on n.id = p.node_id
   where p.team_id = p_team and p.state = 'active' and n.geom is not null;

  return jsonb_build_object('ok', true, 'guidance', v_guide, 'targets', v_out);
end;
$$;

-- ─── the referee ─────────────────────────────────────────────────────────────

create or replace function verify_arrival(
  p_team uuid,
  p_node uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy real default null,
  p_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hunt hunts;
  v_node nodes;
  v_prog progress;
  v_pt geography;
  v_dist int;
  v_first boolean;
  v_award int;
  v_bonus int := 0;
  v_last_ping pings;
  v_speed numeric;
begin
  -- 1 · authorise
  if not in_team(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_team');
  end if;

  select h.* into v_hunt from hunts h join teams t on t.hunt_id = h.id where t.id = p_team;
  if v_hunt.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason',
      case when v_hunt.status = 'paused' then 'paused' else 'not_running' end);
  end if;
  if hunt_remaining_s(v_hunt) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'time_up');
  end if;

  select * into v_prog from progress where team_id = p_team and node_id = p_node;
  if v_prog.state is distinct from 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  select * into v_node from nodes where id = p_node;
  if v_node.geom is null then
    return jsonb_build_object('ok', false, 'reason', 'no_location_set');
  end if;

  v_pt := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_dist := round(st_distance(v_pt, v_node.geom))::int;

  -- 2 · a bad fix is not a failure, it is a "hold on"
  if p_accuracy is not null and p_accuracy > 50 then
    return jsonb_build_object('ok', false, 'reason', 'weak_fix',
                              'accuracy_m', p_accuracy, 'distance_m', v_dist);
  end if;

  -- 3 · the geofence. Metres, on a spheroid, against the radius the organiser set.
  if not st_dwithin(v_pt, v_node.geom, v_node.radius_m) then
    insert into events (hunt_id, team_id, actor_id, kind, data)
    values (v_hunt.id, p_team, auth.uid(), 'arrival_fail',
            jsonb_build_object('node_id', p_node, 'distance_m', v_dist));
    return jsonb_build_object('ok', false, 'reason', 'too_far',
                              'distance_m', v_dist, 'radius_m', v_node.radius_m);
  end if;

  -- 4 · secondary proof, where the organiser asked for one
  if v_node.proof in ('gps_code', 'qr') then
    if p_code is null or upper(btrim(p_code)) is distinct from upper(btrim(coalesce(v_node.site_code, ''))) then
      insert into events (hunt_id, team_id, actor_id, kind, data)
      values (v_hunt.id, p_team, auth.uid(), 'arrival_fail',
              jsonb_build_object('node_id', p_node, 'bad_code', true));
      return jsonb_build_object('ok', false, 'reason', 'bad_code', 'distance_m', v_dist);
    end if;
  end if;

  -- 5 · plausibility. Advisory only — it flags, it never blocks (see §8 of the plan).
  select * into v_last_ping from pings
   where team_id = p_team and at > now() - interval '10 minutes'
   order by at desc limit 1;
  if v_last_ping.id is not null then
    v_speed := st_distance(v_pt, v_last_ping.geom)
               / greatest(1, extract(epoch from (now() - v_last_ping.at)));
    if v_speed > 12 then
      insert into events (hunt_id, team_id, kind, data)
      values (v_hunt.id, p_team, 'flag',
              jsonb_build_object('type', 'teleport', 'speed_ms', round(v_speed, 1)));
    end if;
  end if;

  -- 6 · award
  select not exists (
    select 1 from progress p2 join teams t2 on t2.id = p2.team_id
    where p2.node_id = p_node and p2.state = 'solved' and t2.hunt_id = v_hunt.id
  ) into v_first;

  v_award := v_node.base_points;
  if v_first then
    v_bonus := coalesce((v_hunt.rules->>'first_blood_bonus')::int, 0);
    v_award := v_award + v_bonus;
  end if;

  update progress set state = 'solved', solved_at = now(), points_awarded = v_award
   where team_id = p_team and node_id = p_node;

  update teams set score = score + v_award where id = p_team;

  insert into pings (team_id, geom, accuracy_m) values (p_team, v_pt, p_accuracy);

  insert into events (hunt_id, team_id, actor_id, kind, data)
  values (v_hunt.id, p_team, auth.uid(), 'arrival_ok',
          jsonb_build_object('node_id', p_node, 'label', v_node.label,
                             'points', v_award, 'first_blood', v_first));

  -- 7 · open what this unlocks
  perform unlock_successors(p_team, p_node);

  -- 8 · terminal
  if v_node.is_terminal then
    v_bonus := coalesce((v_hunt.rules->>'finish_bonus')::int, 0);
    update teams set score = score + v_bonus, finished_at = coalesce(finished_at, now())
     where id = p_team;
    insert into events (hunt_id, team_id, kind, data)
    values (v_hunt.id, p_team, 'finish', jsonb_build_object('bonus', v_bonus));
  end if;

  return jsonb_build_object(
    'ok', true,
    'points', v_award,
    'first_blood', v_first,
    'finished', v_node.is_terminal,
    'finish_bonus', case when v_node.is_terminal then v_bonus else 0 end,
    'score', team_display_score(p_team)
  );
end;
$$;

-- ─── the hint ladder ─────────────────────────────────────────────────────────

create or replace function buy_hint(p_team uuid, p_node uuid, p_tier int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hunt hunts;
  v_node nodes;
  v_prog progress;
  v_hint jsonb;
  v_cost int;
begin
  if not in_team(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_team');
  end if;

  select h.* into v_hunt from hunts h join teams t on t.hunt_id = h.id where t.id = p_team;
  if v_hunt.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason', 'not_running');
  end if;

  select * into v_prog from progress where team_id = p_team and node_id = p_node;
  if v_prog.state is distinct from 'active' then
    return jsonb_build_object('ok', false, 'reason', 'not_active');
  end if;

  -- The ladder is strictly ordered: you cannot skip to the cheap answer.
  if p_tier <> v_prog.hints_taken + 1 then
    return jsonb_build_object('ok', false, 'reason', 'wrong_tier');
  end if;

  select * into v_node from nodes where id = p_node;
  v_hint := v_node.hints -> (p_tier - 1);
  if v_hint is null then
    return jsonb_build_object('ok', false, 'reason', 'no_such_hint');
  end if;

  v_cost := coalesce((v_hint->>'cost')::int, 0);

  update progress set hints_taken = p_tier where team_id = p_team and node_id = p_node;
  update teams set score = score - v_cost where id = p_team;

  insert into events (hunt_id, team_id, actor_id, kind, data)
  values (v_hunt.id, p_team, auth.uid(), 'hint',
          jsonb_build_object('node_id', p_node, 'tier', p_tier, 'cost', v_cost));

  return jsonb_build_object('ok', true, 'tier', p_tier, 'cost', v_cost,
                            'text', v_hint->>'text', 'score', team_display_score(p_team));
end;
$$;

-- ─── the leaderboard (public: this is what the big screen reads) ─────────────

create or replace function leaderboard(p_hunt uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row order by row->>'rank'), '[]'::jsonb) from (
    select jsonb_build_object(
      'rank', rank() over (order by t.score desc, t.finished_at nulls last, t.created_at),
      'team_id', t.id,
      'name', t.name,
      'score', greatest(0, t.score - floor(
                 extract(epoch from hunt_elapsed(h)) / 60.0
                 * coalesce((h.rules->>'decay_per_min')::numeric, 1))::int),
      'solved', (select count(*) from progress p
                  where p.team_id = t.id and p.state in ('solved','skipped')),
      'hints', (select coalesce(sum(p.hints_taken), 0) from progress p where p.team_id = t.id),
      'finished', t.finished_at is not null
    ) as row
    from teams t join hunts h on h.id = t.hunt_id
    where t.hunt_id = p_hunt
  ) s;
$$;

-- ─── permissions ─────────────────────────────────────────────────────────────

grant execute on function join_hunt(text, text, text)            to authenticated;
grant execute on function game_state(uuid)                       to authenticated;
grant execute on function record_ping(uuid, double precision, double precision, real) to authenticated;
grant execute on function verify_arrival(uuid, uuid, double precision, double precision, real, text) to authenticated;
grant execute on function buy_hint(uuid, uuid, int)              to authenticated;
grant execute on function leaderboard(uuid)                      to authenticated, anon;
grant execute on function team_display_score(uuid)               to authenticated, anon;
