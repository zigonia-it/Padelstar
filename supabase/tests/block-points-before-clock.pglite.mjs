// Migration 20261012090000_block_points_before_clock.sql: a timed match takes no points or set result until its
// clock is started (developer's request 2026-10-12).
// Run:  npm install --no-save @electric-sql/pglite && node supabase/tests/block-points-before-clock.pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const migDir = new URL('../migrations/', import.meta.url).pathname;
const pg = new PGlite();
await pg.exec(`
create role anon; create role authenticated;
create schema extensions;
create function extensions.digest(t text, alg text) returns bytea language sql immutable as $$ select decode(md5(t),'hex') $$;
create table public.tournaments(id uuid primary key, invite_code text, admin_token text, state jsonb, revision int default 0, updated_at timestamptz default now());
create table public.player_sessions(tournament_id uuid, player_id uuid, token_hash text);
create table public.api_rate_limits(bucket_hash text primary key, window_started_at timestamptz, request_count int, updated_at timestamptz);
create or replace function public.consume_api_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer) returns boolean language sql as $$ select true $$;
`);
for (const f of ['20260918083449_match_undo_stack.sql', '20260915040000_admin_set_result_status_sync.sql', '20260919120000_match_scorer_lease.sql',
  '20260919150000_result_approval.sql', '20260919190000_fix_undo_current_round.sql', '20260919210000_admin_result_correction.sql',
  '20260924120000_generic_scoring_rules.sql', '20260926120000_scoring_helpers_search_path.sql', '20261010150000_match_clock_start_button.sql',
  '20261012090000_block_points_before_clock.sql']) {
  await pg.exec(fs.readFileSync(migDir + f, 'utf8'));
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T = uuid(1), M1 = uuid(11), M2 = uuid(12);
const A = uuid(101), B = uuid(102), C = uuid(103), D = uuid(104);
const TOK = { [A]: 'a'.repeat(48), [B]: 'b'.repeat(48) };
const ADMIN = 'admintoken-1234567890';
const team = (ids) => ({ players: ids.map((id) => ({ id, name: id })) });
const match = (id, state) => ({ id, state, status: state === 'playing' ? 'active' : 'scheduled', teamOne: team([A, B]), teamTwo: team([C, D]),
  currentGame: { teamOne: 0, teamTwo: 0 }, currentSet: { teamOne: 0, teamTwo: 0 }, completedSets: [], undoStack: [], courtId: 'c1', courtName: 'Bane 1' });

async function fresh(states = ['playing'], settings = { timedMinutes: 10 }) {
  await pg.exec('delete from public.tournaments; delete from public.player_sessions;');
  const state = { status: 'Runde pågår', settings, revision: 1, rounds: [{ id: 'r1', status: 'active', matches: states.map((s, i) => match(i ? M2 : M1, s)) }] };
  await pg.query(`insert into public.tournaments(id,invite_code,admin_token,state,revision) values ($1,'ABCD2345',$2,$3::jsonb,1)`, [T, ADMIN, JSON.stringify(state)]);
  for (const p of [A, B]) await pg.query(`insert into public.player_sessions values ($1,$2,encode(extensions.digest($3,'sha256'),'hex'))`, [T, p, TOK[p]]);
}
const read = async () => (await pg.query('select state, revision from public.tournaments where id = $1', [T])).rows[0];
const m = async (i = 0) => (await read()).state.rounds[0].matches[i];
const point = (team, player = A) => pg.query(`select public.save_player_point_impl($1,'ABCD2345',$2,$3,$4,$5)`, [T, player, M1, team, TOK[player]]);
const adminAction = async (action, id = M1) => {
  const { revision } = await read();
  return pg.query(`select public.admin_match_action_impl($1,$2,$3,$4,null,$5)`, [T, ADMIN, id, action, revision]);
};
const scorer = (action, player = A) => pg.query(`select public.match_scorer_action_impl($1,'ABCD2345',$2,$3,$4,$5,null)`, [T, player, M1, TOK[player], action]);
const fails = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

const setResult = async (one, two, id = M1) => {
  const { revision } = await read();
  return pg.query(`select public.admin_set_result_impl($1,$2,$3,$4,$5,$6)`, [T, ADMIN, id, one, two, revision]);
};

console.log('a timed match on court takes no point before its clock is started');
await fresh();
ok('the point is refused', /Match clock not started/.test(await fails(() => point(0))));
let got = await m();
ok('nothing was scored', got.currentGame.teamOne === 0 && !got.undoStack.length);
ok('the revision did not move', (await read()).revision === 1);

console.log('after Start clock the point is scored');
await adminAction('start_clock');
await point(0);
got = await m();
ok('the point is scored', got.currentGame.teamOne === 1);
ok('the clock keeps running', typeof got.startedAt === 'string');

console.log('a player on the match may start the clock and then score');
await fresh();
await scorer('start_clock', A);
await point(1);
ok('the point is scored', (await m()).currentGame.teamTwo === 1);

console.log('Start match on a waiting timed match starts the clock, so points follow');
await fresh(['playing', 'waiting']);
await adminAction('start', M2);
ok('its clock runs', typeof (await m(1)).startedAt === 'string');

console.log('a match without a time limit is scored as before');
await fresh(['playing'], { timedMinutes: 0 });
await point(0);
ok('the point is scored', (await m()).currentGame.teamOne === 1);
await fresh(['playing'], {});
await point(0);
ok('no time setting at all: the point is scored', (await m()).currentGame.teamOne === 1);

console.log('the admin set result follows the same rule');
await fresh();
ok('a set result before the clock is refused', /Match clock not started/.test(await fails(() => setResult(6, 2))));
ok('a waiting timed match takes no set result either', /Match clock not started/.test(await fails(async () => { await fresh(['playing', 'waiting']); await setResult(6, 2, M2); })));
await fresh();
await adminAction('start_clock');
await setResult(6, 2);
ok('after the clock starts the set result is saved', (await m()).completedSets.length === 1);
await fresh(['playing'], { timedMinutes: 0 });
await setResult(6, 2);
ok('an untimed match takes a set result as before', (await m()).completedSets.length === 1);

console.log('undo keeps the clock and scoring stays open');
await fresh();
await adminAction('start_clock');
await point(0);
await scorer('undo', A);
got = await m();
ok('the point is undone', got.currentGame.teamOne === 0);
ok('the clock still runs', typeof got.startedAt === 'string');
await point(0);
ok('a new point is scored', (await m()).currentGame.teamOne === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
