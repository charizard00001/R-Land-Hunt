-- Demo data, so the app has something to play the moment it boots.
--
--   Organiser login   demo@rlandhunt.test / huntmaster
--   Hunt join code    RLAND1
--
-- Coordinates sit on the IIT Roorkee campus. Change them in Hunt Studio, or use
-- the simulator on the play screen to walk the hunt from your desk.

set search_path = public, extensions;

-- ─── demo organiser ──────────────────────────────────────────────────────────

-- The token columns must be '' rather than NULL: the auth service scans them
-- into non-nullable strings and a NULL turns every sign-in into an opaque
-- "Database error querying schema".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'demo@rlandhunt.test',
  crypt('huntmaster', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, false, false,
  '', '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@rlandhunt.test","email_verified":true}'::jsonb,
  'email', now(), now(), now()
) on conflict do nothing;

-- ─── org, hunt, clues ────────────────────────────────────────────────────────

insert into orgs (id, slug, name)
values ('22222222-2222-4222-8222-222222222222', 'mdg-space', 'MDG Space')
on conflict (id) do nothing;

insert into org_members (org_id, user_id, role)
values ('22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111', 'owner')
on conflict do nothing;

insert into hunts (id, org_id, name, join_code, status, duration_s, rules)
values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'Monsoon Reckoning',
  'RLAND1',
  'published',
  3600,
  '{"decay_per_min": 1, "first_blood_bonus": 40, "finish_bonus": 300}'::jsonb
) on conflict (id) do nothing;

insert into nodes (id, hunt_id, label, kind, clue, hints, lat, lng, radius_m,
                   proof, site_code, base_points, is_start, is_terminal, seq)
values
  ('44444444-0001-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333',
   'Cast off', 'riddle',
   'Gather where the road gives up and the lawn begins. The chart opens when the bell sounds.',
   '[{"cost":10,"text":"The main gate. Stand on the grass, not the tarmac."}]'::jsonb,
   29.86500, 77.89660, 40, 'gps', null, 50, true, false, 1),

  ('44444444-0002-4000-8000-000000000002',
   '33333333-3333-4333-8333-333333333333',
   'The iron bird', 'riddle',
   'The iron bird has kept her watch above the quadrangle since forty-seven. Count the steps beneath her wing.',
   '[{"cost":10,"text":"You are looking too high. Bring your eyes down to the ground."},
     {"cost":30,"text":"It is a plaque, not a building. Brass, and older than the paint around it."},
     {"cost":60,"text":"North face of the Civil block, left of the arch, at knee height."}]'::jsonb,
   29.86610, 77.89540, 25, 'gps_code', 'ELEVEN', 100, false, false, 2),

  ('44444444-0003-4000-8000-000000000003',
   '33333333-3333-4333-8333-333333333333',
   'The sundial', 'cipher',
   'The old stone tells the hour without a hand. Stand where its shadow points when the day turns.',
   '[{"cost":10,"text":"South of the library, on the raised bed."},
     {"cost":30,"text":"The shadow at four o clock falls west-north-west."}]'::jsonb,
   29.86390, 77.89780, 25, 'gps', null, 100, false, false, 3),

  ('44444444-0004-4000-8000-000000000004',
   '33333333-3333-4333-8333-333333333333',
   'Any 2 of 3', 'gate',
   'Two marks of three will open the far water. You have done enough — keep going.',
   '[]'::jsonb,
   29.86520, 77.89900, 60, 'gps', null, 50, false, false, 4),

  ('44444444-0005-4000-8000-000000000005',
   '33333333-3333-4333-8333-333333333333',
   'The water tower', 'photo',
   'Climb no higher than the fence. The tower has seen every crew that came before you.',
   '[{"cost":30,"text":"North-east corner of the campus, past the workshops."}]'::jsonb,
   29.86750, 77.90050, 35, 'gps_photo', null, 140, false, false, 5),

  ('44444444-0006-4000-8000-000000000006',
   '33333333-3333-4333-8333-333333333333',
   'The reckoning', 'finish',
   'Return to where you cast off. Bring everything you took.',
   '[]'::jsonb,
   29.86500, 77.89660, 40, 'gps', null, 200, false, true, 6)
on conflict (id) do nothing;

insert into edges (hunt_id, from_node, to_node, unlock_rule) values
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0001-4000-8000-000000000001', '44444444-0002-4000-8000-000000000002',
   '{"type":"all"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0001-4000-8000-000000000001', '44444444-0003-4000-8000-000000000003',
   '{"type":"all"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0002-4000-8000-000000000002', '44444444-0004-4000-8000-000000000004',
   '{"type":"any_n","n":1}'::jsonb),
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0003-4000-8000-000000000003', '44444444-0004-4000-8000-000000000004',
   '{"type":"any_n","n":1}'::jsonb),
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0004-4000-8000-000000000004', '44444444-0005-4000-8000-000000000005',
   '{"type":"all"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333',
   '44444444-0005-4000-8000-000000000005', '44444444-0006-4000-8000-000000000006',
   '{"type":"all"}'::jsonb)
on conflict do nothing;
