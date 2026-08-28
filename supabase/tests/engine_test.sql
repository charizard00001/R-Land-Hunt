-- pgTAP tests for the rules that decide a score.
--
-- The game lives in SQL, so the rules get SQL tests. Run against a running
-- local stack with:  npx supabase test db

begin;
set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ─── fixtures ────────────────────────────────────────────────────────────────
-- A player and a two-clue hunt, 25 m fences, on the demo campus.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, is_anonymous)
values ('00000000-0000-0000-0000-000000000000',
        '99999999-9999-4999-8999-999999999999',
        'authenticated', 'authenticated', 'tester@example.test',
        crypt('x', gen_salt('bf')), now(), now(), now(), true);

insert into orgs (id, slug, name)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'test-club', 'Test Club');

insert into hunts (id, org_id, name, join_code, status, duration_s, started_at, rules)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'Test Hunt', 'TEST01', 'live', 3600, now() - interval '5 minutes',
        '{"decay_per_min":1,"first_blood_bonus":40,"finish_bonus":300}'::jsonb);

insert into nodes (id, hunt_id, label, clue, hints, lat, lng, radius_m,
                   proof, site_code, base_points, is_start, is_terminal, seq)
values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'One', 'first clue',
   '[{"cost":10,"text":"a nudge"},{"cost":30,"text":"a hint"}]'::jsonb,
   29.86500, 77.89660, 25, 'gps', null, 100, true, false, 1),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Two', 'second clue', '[]'::jsonb,
   29.86610, 77.89540, 25, 'gps_code', 'ELEVEN', 100, false, true, 2);

insert into edges (hunt_id, from_node, to_node)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000002');

insert into teams (id, hunt_id, name)
values ('dddddddd-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000001', 'Testers');

insert into team_members (team_id, user_id, is_captain)
values ('dddddddd-0000-4000-8000-000000000001',
        '99999999-9999-4999-8999-999999999999', true);

-- Act as that player for the rest of the file.
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';

-- ─── the trust boundary ──────────────────────────────────────────────────────

select is(
  (select count(*)::int from nodes),
  0,
  'a player cannot read ANY row of nodes — clue text is unreadable, not merely hidden'
);

select is(
  ((game_state('dddddddd-0000-4000-8000-000000000001')->'active'->0->>'clue')),
  'first clue',
  'the opening clue is delivered through the RPC once it is active'
);

select is(
  ((game_state('dddddddd-0000-4000-8000-000000000001')->'active'->0->'hints'->0->>'text')),
  null,
  'an unbought hint returns its price but never its text'
);

-- ─── the geofence ────────────────────────────────────────────────────────────

select is(
  (verify_arrival('dddddddd-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000001',
                  29.87500, 77.89660, 8)->>'reason'),
  'too_far',
  'a fix a kilometre away is rejected'
);

select is(
  (verify_arrival('dddddddd-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000001',
                  29.86500, 77.89660, 90)->>'reason'),
  'weak_fix',
  'a 90 m accuracy reading is held, not failed'
);

select is(
  (select score from teams where id = 'dddddddd-0000-4000-8000-000000000001'),
  0,
  'a failed arrival awards nothing'
);

-- ─── the hint ladder ─────────────────────────────────────────────────────────

select is(
  (buy_hint('dddddddd-0000-4000-8000-000000000001',
            'cccccccc-0000-4000-8000-000000000001', 2)->>'reason'),
  'wrong_tier',
  'the ladder cannot be skipped'
);

select is(
  (buy_hint('dddddddd-0000-4000-8000-000000000001',
            'cccccccc-0000-4000-8000-000000000001', 1)->>'text'),
  'a nudge',
  'buying rung one returns the text'
);

select is(
  (select score from teams where id = 'dddddddd-0000-4000-8000-000000000001'),
  -10,
  'the hint is charged to the team'
);

-- ─── a real arrival ──────────────────────────────────────────────────────────

select is(
  (verify_arrival('dddddddd-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000001',
                  29.86502, 77.89662, 8)->>'ok'),
  'true',
  'standing inside the fence clears the mark'
);

select is(
  (select score from teams where id = 'dddddddd-0000-4000-8000-000000000001'),
  130,
  '100 base + 40 first blood - 10 hint = 130'
);

select is(
  (select state::text from progress
    where team_id = 'dddddddd-0000-4000-8000-000000000001'
      and node_id = 'cccccccc-0000-4000-8000-000000000002'),
  'active',
  'clearing a mark unlocks its successor'
);

-- ─── secondary proof ─────────────────────────────────────────────────────────

select is(
  (verify_arrival('dddddddd-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000002',
                  29.86610, 77.89540, 8, 'WRONG')->>'reason'),
  'bad_code',
  'being in the right place with the wrong code is not enough'
);

select is(
  (verify_arrival('dddddddd-0000-4000-8000-000000000001',
                  'cccccccc-0000-4000-8000-000000000002',
                  29.86610, 77.89540, 8, 'eleven')->>'finished'),
  'true',
  'the terminal mark is verified like any other, and finishes the hunt'
);

select * from finish();
rollback;
