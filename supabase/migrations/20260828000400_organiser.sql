-- Organiser side: authoring, the authoritative clock, and race control.
-- Every mutation checks membership. None of them drop anything.

-- ─── bootstrap ───────────────────────────────────────────────────────────────

create or replace function bootstrap_org(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org orgs;
  v_slug text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  select o.* into v_org from orgs o join org_members m on m.org_id = o.id
   where m.user_id = v_uid limit 1;

  if v_org.id is not null then
    return jsonb_build_object('ok', true, 'org_id', v_org.id, 'name', v_org.name);
  end if;

  v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  if v_slug = '' or v_slug is null then v_slug := 'club'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);

  insert into orgs (slug, name) values (v_slug, btrim(p_name)) returning * into v_org;
  insert into org_members (org_id, user_id, role) values (v_org.id, v_uid, 'owner');

  return jsonb_build_object('ok', true, 'org_id', v_org.id, 'name', v_org.name);
end;
$$;

create or replace function create_hunt(p_org uuid, p_name text, p_duration_s int default 3600)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hunt hunts;
begin
  if not is_org_editor(p_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  insert into hunts (org_id, name, join_code, duration_s)
  values (p_org, btrim(p_name), gen_join_code(), p_duration_s)
  returning * into v_hunt;
  return jsonb_build_object('ok', true, 'hunt_id', v_hunt.id, 'join_code', v_hunt.join_code);
end;
$$;

-- ─── the clock ───────────────────────────────────────────────────────────────

create or replace function set_hunt_status(p_hunt uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hunt hunts;
begin
  if not edits_hunt(p_hunt) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into v_hunt from hunts where id = p_hunt;

  if p_action = 'publish' and v_hunt.status = 'draft' then
    if not exists (select 1 from nodes where hunt_id = p_hunt and is_start) then
      return jsonb_build_object('ok', false, 'reason', 'no_start_node');
    end if;
    if exists (select 1 from nodes where hunt_id = p_hunt and lat is null) then
      return jsonb_build_object('ok', false, 'reason', 'node_without_location');
    end if;
    update hunts set status = 'published' where id = p_hunt;

  elsif p_action = 'unpublish' and v_hunt.status = 'published' then
    update hunts set status = 'draft' where id = p_hunt;

  elsif p_action = 'start' and v_hunt.status = 'published' then
    update hunts set status = 'live', started_at = now(),
                     paused_at = null, paused_total = '0' where id = p_hunt;
    -- Everyone already registered gets their opening clue.
    perform ensure_activated(t.id) from teams t where t.hunt_id = p_hunt;

  elsif p_action = 'pause' and v_hunt.status = 'live' then
    update hunts set status = 'paused', paused_at = now() where id = p_hunt;

  elsif p_action = 'resume' and v_hunt.status = 'paused' then
    update hunts set status = 'live',
                     paused_total = paused_total + (now() - paused_at),
                     paused_at = null
     where id = p_hunt;

  elsif p_action = 'end' and v_hunt.status in ('live', 'paused') then
    -- Ending keeps every row. The replay, the report and the results page all
    -- read from events and pings, so nothing here is destroyed.
    update hunts set status = 'ended' where id = p_hunt;

  else
    return jsonb_build_object('ok', false, 'reason', 'bad_transition',
                              'from', v_hunt.status, 'action', p_action);
  end if;

  insert into events (hunt_id, actor_id, kind, data)
  values (p_hunt, auth.uid(), 'clock', jsonb_build_object('action', p_action));

  select * into v_hunt from hunts where id = p_hunt;
  return jsonb_build_object('ok', true, 'status', v_hunt.status,
                            'remaining_s', hunt_remaining_s(v_hunt));
end;
$$;

-- ─── race control ────────────────────────────────────────────────────────────

create or replace function control_state(p_hunt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hunt hunts;
  v_crews jsonb;
  v_alerts jsonb;
  v_feed jsonb;
begin
  if not owns_hunt(p_hunt) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into v_hunt from hunts where id = p_hunt;

  select coalesce(jsonb_agg(row order by row->>'score' desc), '[]'::jsonb) into v_crews from (
    select jsonb_build_object(
      'team_id', t.id,
      'name', t.name,
      'score', team_display_score(t.id),
      'solved', (select count(*) from progress p
                  where p.team_id = t.id and p.state in ('solved','skipped')),
      'hints', (select coalesce(sum(p.hints_taken),0) from progress p where p.team_id = t.id),
      'finished', t.finished_at is not null,
      'lat', (select st_y(pg.geom::geometry) from pings pg
               where pg.team_id = t.id order by pg.at desc limit 1),
      'lng', (select st_x(pg.geom::geometry) from pings pg
               where pg.team_id = t.id order by pg.at desc limit 1),
      'last_seen_s', (select round(extract(epoch from (now() - pg.at)))::int from pings pg
                       where pg.team_id = t.id order by pg.at desc limit 1),
      'idle_s', (select round(extract(epoch from (now() - coalesce(
                    (select max(e.at) from events e
                      where e.team_id = t.id and e.kind in ('arrival_ok','hint','join')),
                    t.created_at))))::int),
      'trail', (select coalesce(jsonb_agg(jsonb_build_object(
                         'lat', st_y(q.geom::geometry), 'lng', st_x(q.geom::geometry)) order by q.at), '[]'::jsonb)
                 from (select geom, at from pings where team_id = t.id
                        order by at desc limit 24) q)
    ) as row
    from teams t where t.hunt_id = p_hunt
  ) s;

  -- Advisory only. A human decides; the system never disqualifies anyone.
  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_alerts from (
    select jsonb_build_object(
      'kind', 'TELEPORT FLAG', 'team_id', e.team_id,
      'team', (select name from teams where id = e.team_id),
      'ago_s', round(extract(epoch from (now() - e.at)))::int,
      'body', 'Jumped at ' || (e.data->>'speed_ms') || ' m/s with no pings between.'
    ) as row
    from events e where e.hunt_id = p_hunt and e.kind = 'flag'
      and e.at > now() - interval '2 hours'
    order by e.at desc limit 4
  ) s;

  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_feed from (
    select jsonb_build_object(
      'kind', e.kind,
      'team', (select name from teams where id = e.team_id),
      'label', e.data->>'label',
      'points', e.data->>'points',
      'ago_s', round(extract(epoch from (now() - e.at)))::int
    ) as row
    from events e where e.hunt_id = p_hunt
      and e.kind in ('arrival_ok','hint','finish','flag','announce','clock')
    order by e.at desc limit 20
  ) s;

  return jsonb_build_object(
    'ok', true,
    'hunt', jsonb_build_object('id', v_hunt.id, 'name', v_hunt.name,
              'status', v_hunt.status, 'remaining_s', hunt_remaining_s(v_hunt),
              'join_code', v_hunt.join_code),
    'crews', v_crews, 'alerts', v_alerts, 'feed', v_feed
  );
end;
$$;

-- ─── intervention (always logged, always disclosed to the team) ──────────────

create or replace function intervene(p_team uuid, p_action text, p_node uuid default null,
                                     p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hunt uuid;
  v_node uuid := p_node;
begin
  select hunt_id into v_hunt from teams where id = p_team;
  if v_hunt is null or not edits_hunt(v_hunt) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if v_node is null then
    select node_id into v_node from progress
     where team_id = p_team and state = 'active' limit 1;
  end if;
  if v_node is null then
    return jsonb_build_object('ok', false, 'reason', 'nothing_active');
  end if;

  if p_action = 'free_hint' then
    update progress set hints_taken = least(
      hints_taken + 1,
      (select jsonb_array_length(hints) from nodes where id = v_node))
     where team_id = p_team and node_id = v_node;

  elsif p_action = 'force_unlock' then
    update progress set state = 'skipped', solved_at = now()
     where team_id = p_team and node_id = v_node;
    perform unlock_successors(p_team, v_node);

  else
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;

  insert into events (hunt_id, team_id, actor_id, kind, data)
  values (v_hunt, p_team, auth.uid(), 'intervention',
          jsonb_build_object('action', p_action, 'node_id', v_node, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'action', p_action);
end;
$$;

create or replace function announce(p_hunt uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not edits_hunt(p_hunt) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  insert into events (hunt_id, actor_id, kind, data)
  values (p_hunt, auth.uid(), 'announce', jsonb_build_object('text', btrim(p_text)));
  return jsonb_build_object('ok', true);
end;
$$;

-- ─── the public results page / big screen ────────────────────────────────────

create or replace function public_board(p_hunt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hunt hunts;
begin
  select * into v_hunt from hunts
   where id = p_hunt and status in ('live','paused','ended') and deleted_at is null;
  if v_hunt.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_public');
  end if;

  return jsonb_build_object(
    'ok', true,
    'hunt', jsonb_build_object('name', v_hunt.name, 'status', v_hunt.status,
              'remaining_s', hunt_remaining_s(v_hunt),
              'crews', (select count(*) from teams where hunt_id = p_hunt)),
    'board', leaderboard(p_hunt),
    'feed', (
      select coalesce(jsonb_agg(row), '[]'::jsonb) from (
        select jsonb_build_object(
          'team', (select name from teams where id = e.team_id),
          'label', e.data->>'label',
          'points', e.data->>'points',
          'kind', e.kind,
          'ago_s', round(extract(epoch from (now() - e.at)))::int
        ) as row
        from events e where e.hunt_id = p_hunt and e.kind in ('arrival_ok','finish','announce')
        order by e.at desc limit 12
      ) s),
    'per_clue', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'label', n.label, 'seq', n.seq,
               'solved', (select count(*) from progress p
                           where p.node_id = n.id and p.state = 'solved')
             ) order by n.seq), '[]'::jsonb)
      from nodes n where n.hunt_id = p_hunt)
  );
end;
$$;

grant execute on function bootstrap_org(text)                    to authenticated;
grant execute on function create_hunt(uuid, text, int)           to authenticated;
grant execute on function set_hunt_status(uuid, text)            to authenticated;
grant execute on function control_state(uuid)                    to authenticated;
grant execute on function intervene(uuid, text, uuid, text)      to authenticated;
grant execute on function announce(uuid, text)                   to authenticated;
grant execute on function public_board(uuid)                     to authenticated, anon;
