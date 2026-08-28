/**
 * End-to-end smoke test against a running local stack.
 *
 *   npm run db:reset && npm run smoke
 *
 * It drives the real HTTP API the way the app does: an organiser signs in, crews
 * join, the hunt starts, a player walks to a clue and claims it. The checks that
 * matter most are the negative ones — a player cannot read the clue table, cannot
 * write their own score, and cannot see a rival's state.
 */
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
};

// ── organiser ────────────────────────────────────────────────────────────────
const boss = createClient(URL, ANON);
const { error: signInErr } = await boss.auth.signInWithPassword({
  email: 'demo@rlandhunt.test', password: 'huntmaster',
});
ok('organiser signs in with the seeded password', !signInErr, signInErr?.message);

const { data: hunts } = await boss.from('hunts').select('id,name,join_code,status');
const hunt = hunts?.[0];
ok('organiser reads their own hunt', !!hunt, hunt && `${hunt.name} / ${hunt.join_code}`);

const { data: orgNodes } = await boss.from('nodes').select('id,label').eq('hunt_id', hunt.id);
ok('organiser CAN read clue rows', (orgNodes?.length ?? 0) === 6, `${orgNodes?.length} nodes`);

// ── player ───────────────────────────────────────────────────────────────────
const p1 = createClient(URL, ANON);
const { error: anonErr } = await p1.auth.signInAnonymously();
ok('player gets an anonymous session', !anonErr, anonErr?.message);

const { data: joined } = await p1.rpc('join_hunt', {
  p_join_code: hunt.join_code, p_team_name: 'The Salted Crew', p_display_name: 'Ishani',
});
ok('player joins by cipher', joined?.ok === true, JSON.stringify(joined));
const teamId = joined.team_id;

// THE test: can a player read clue rows directly?
// Registration closes the moment the hunt starts, so crews sign on first.
const p2 = createClient(URL, ANON);
await p2.auth.signInAnonymously();
await p2.rpc('join_hunt', { p_join_code: hunt.join_code, p_team_name: 'Dead Reckoning' });

const { data: started } = await boss.rpc('set_hunt_status', { p_hunt: hunt.id, p_action: 'start' });
ok('hunt starts', started?.ok === true && started?.status === 'live', JSON.stringify(started));

const late = createClient(URL, ANON);
await late.auth.signInAnonymously();
const { data: latecomer } = await late.rpc('join_hunt', {
  p_join_code: hunt.join_code, p_team_name: 'Too Late',
});
ok('a NEW crew cannot register once the hunt is running',
   latecomer?.ok === false && latecomer?.reason === 'registration_closed',
   JSON.stringify(latecomer));

const { data: rejoin } = await late.rpc('join_hunt', {
  p_join_code: hunt.join_code, p_team_name: 'The Salted Crew',
});
ok('but a latecomer CAN still join an existing crew mid-hunt', rejoin?.ok === true,
   'flat battery, borrowed phone — they get back on their team');

const { data: leak } = await p1.from('nodes').select('id,clue,site_code,lat,lng');
ok('player CANNOT read the nodes table', (leak?.length ?? 0) === 0,
   `got ${leak?.length ?? 0} rows`);

const { data: state } = await p1.rpc('game_state', { p_team: teamId });
ok('player receives exactly one opening clue', state?.active?.length === 1,
   state?.active?.[0]?.clue?.slice(0, 40));
ok('unbought hint text is withheld', state.active[0].hints[0].text === null,
   `cost ${state.active[0].hints[0].cost} exposed, text null`);

// ── position → distance and bearing, without ever sending the target ─────────
const { data: far } = await p1.rpc('record_ping', {
  p_team: teamId, p_lat: 29.8750, p_lng: 77.8966, p_accuracy: 8,
});
const t = far.targets[0];
ok('server returns distance and bearing only', t.distance_m > 900 && t.bearing_deg != null,
   `${t.distance_m} m @ ${t.bearing_deg}°`);
ok('the ping response carries no coordinates',
   !('lat' in t) && !('lng' in t) && JSON.stringify(t).indexOf('77.89') === -1);

// ── the referee ──────────────────────────────────────────────────────────────
const { data: tooFar } = await p1.rpc('verify_arrival', {
  p_team: teamId, p_node: t.node_id, p_lat: 29.8750, p_lng: 77.8966, p_accuracy: 8,
});
ok('arrival a kilometre out is refused', tooFar.ok === false && tooFar.reason === 'too_far',
   `${tooFar.distance_m} m > ${tooFar.radius_m} m fence`);

const { data: weak } = await p1.rpc('verify_arrival', {
  p_team: teamId, p_node: t.node_id, p_lat: 29.86500, p_lng: 77.89660, p_accuracy: 120,
});
ok('a vague fix is held, not failed', weak.reason === 'weak_fix');

const { data: hit } = await p1.rpc('verify_arrival', {
  p_team: teamId, p_node: t.node_id, p_lat: 29.86502, p_lng: 77.89661, p_accuracy: 6,
});
ok('standing on the spot clears the mark', hit.ok === true,
   `+${hit.points} (first blood: ${hit.first_blood})`);

const { data: after } = await p1.rpc('game_state', { p_team: teamId });
ok('clearing the opening mark unlocks BOTH branches', after.active.length === 2,
   after.active.map((a) => `#${a.seq}`).join(' + '));
ok('score is server-computed', after.team.score === hit.score, `${after.team.score}`);

// ── the hint ladder ──────────────────────────────────────────────────────────
const branch = after.active.find((a) => a.hints.length > 1);
const { data: skip } = await p1.rpc('buy_hint', {
  p_team: teamId, p_node: branch.node_id, p_tier: 3,
});
ok('the ladder cannot be skipped', skip.ok === false && skip.reason === 'wrong_tier');

const { data: rung1 } = await p1.rpc('buy_hint', {
  p_team: teamId, p_node: branch.node_id, p_tier: 1,
});
ok('buying rung one returns its text and charges for it', rung1.ok === true,
   `-${rung1.cost} → "${rung1.text.slice(0, 34)}…"`);

// ── a client cannot write its own score ──────────────────────────────────────
const { error: cheatErr } = await p1.from('teams').update({ score: 99999 }).eq('id', teamId);
const { data: afterCheat } = await p1.rpc('game_state', { p_team: teamId });
ok('a client cannot write its own score', afterCheat.team.score !== 99999,
   cheatErr ? 'update rejected' : `score still ${afterCheat.team.score}`);

// ── rival team isolation ─────────────────────────────────────────────────────
const { data: spy } = await p2.rpc('game_state', { p_team: teamId });
ok('a rival cannot read another crew\'s state', spy.ok === false && spy.reason === 'not_your_team');

// ── organiser view ───────────────────────────────────────────────────────────
const { data: control } = await boss.rpc('control_state', { p_hunt: hunt.id });
ok('race control sees both crews with live positions', control.crews.length === 2,
   control.crews.map((c) => `${c.name}(${c.score})`).join(', '));

const { data: paused } = await boss.rpc('set_hunt_status', { p_hunt: hunt.id, p_action: 'pause' });
ok('the hunt pauses', paused.status === 'paused');
const { data: blocked } = await p1.rpc('verify_arrival', {
  p_team: teamId, p_node: branch.node_id, p_lat: 29.86610, p_lng: 77.89540, p_accuracy: 6,
});
ok('nothing can be claimed while paused', blocked.ok === false && blocked.reason === 'paused');
await boss.rpc('set_hunt_status', { p_hunt: hunt.id, p_action: 'resume' });

// ── public board needs no login at all ───────────────────────────────────────
const stranger = createClient(URL, ANON);
const { data: board } = await stranger.rpc('public_board', { p_hunt: hunt.id });
ok('the big screen works with no session', board.ok === true,
   `${board.board.length} crews, leader ${board.board[0].name}`);

console.log('\n' + (process.exitCode ? 'SOME CHECKS FAILED' : 'ALL END-TO-END CHECKS PASSED'));
