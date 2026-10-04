// 0.17.3: a Round Robin round starts the next one by itself (developer's decision 2026-10-05).
// Run:  npm install --no-save @electric-sql/pglite && node supabase/tests/auto-advance-round.pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const dir = new URL('../migrations/', import.meta.url).pathname;
const pg = new PGlite();
await pg.exec(`
create role anon; create role authenticated;
create table public.tournaments(id uuid primary key, invite_code text unique, admin_token text, state jsonb, revision int default 0, expired_at timestamptz);
create function public.guard_tournament_finalization_update() returns trigger language plpgsql as $$
begin
  if old.state->>'status' = 'Avsluttet' and new.state is distinct from old.state then raise exception 'Finalized tournament is read-only'; end if;
  return new;
end $$;
create trigger tournament_finalization_before_update before update on public.tournaments for each row execute function public.guard_tournament_finalization_update();
`);
await pg.exec(fs.readFileSync(dir + '20261005090000_compact_tournament_history.sql', 'utf8'));
await pg.exec(fs.readFileSync(dir + '20261005120000_auto_advance_round.sql', 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };
const T = '00000000-0000-4000-8000-000000000001';
const TOKEN = '00000000-0000-4000-8000-0000000000aa';
const match = (id, state) => ({ id, state, status: state === 'finished' ? 'completed' : state === 'playing' ? 'active' : 'scheduled', undoStack: [] });
const round = (n, status, states) => ({ id: `r${n}`, roundNumber: n, status, matches: states.map((s, i) => match(`r${n}m${i}`, s)) });
async function fresh(rounds, { format = 'roundRobin', status = 'Runde pågår', courts = [{ id: 'c1', name: 'Bane 1' }] } = {}) {
  await pg.exec('delete from public.tournaments');
  const state = { id: T, inviteCode: 'AUTO2345', status, currentRound: 1, settings: { format }, courts, rounds };
  await pg.query(`insert into public.tournaments(id, invite_code, admin_token, state, revision) values ($1, 'AUTO2345', $2, $3::jsonb, 5)`, [T, TOKEN, JSON.stringify(state)]);
}
const read = async () => (await pg.query('select state, revision from public.tournaments where id = $1', [T])).rows[0];
// finish match m of the active round the way any writer does: change the state, bump the revision
async function finish(roundIdx, matchIdx) {
  await pg.query(`update public.tournaments set state = jsonb_set(jsonb_set(state, $2::text[], '"finished"'), $3::text[], '"completed"'), revision = revision + 1 where id = $1`,
    [T, `{rounds,${roundIdx},matches,${matchIdx},state}`, `{rounds,${roundIdx},matches,${matchIdx},status}`]);
}

console.log('the last match of a round starts the next round');
await fresh([round(1, 'active', ['finished', 'playing']), round(2, 'scheduled', ['waiting', 'waiting']), round(3, 'scheduled', ['waiting', 'waiting'])]);
await finish(0, 1);
let { state, revision } = await read();
ok('round 1 is finished', state.rounds[0].status === 'finished');
ok('round 2 is active, round 3 still scheduled', state.rounds[1].status === 'active' && state.rounds[2].status === 'scheduled');
ok('the first match of round 2 is on the court', state.rounds[1].matches[0].state === 'playing' && state.rounds[1].matches[0].courtName === 'Bane 1');
ok('one court: the second match waits', state.rounds[1].matches[1].state === 'waiting');
ok('currentRound and status follow', state.currentRound === 2 && state.status === 'Runde pågår');
ok('the round gets a start time', typeof state.rounds[1].startedAt === 'string');
ok('the revision is the one the writer set (one change, one broadcast)', revision === 6);

console.log('not before the round is complete');
await fresh([round(1, 'active', ['playing', 'playing']), round(2, 'scheduled', ['waiting'])]);
await finish(0, 0);
({ state } = await read());
ok('one of two matches finished: round 1 stays active', state.rounds[0].status === 'active' && state.rounds[1].status === 'scheduled');
await fresh([round(1, 'active', ['finished', 'awaitingApproval']), round(2, 'scheduled', ['waiting'])]);
await pg.query(`update public.tournaments set state = jsonb_set(state, '{name}', '"x"'), revision = revision + 1 where id = $1`, [T]);
({ state } = await read());
ok('a result waiting for approval holds the round', state.rounds[0].status === 'active');

console.log('cancelled matches count as done');
await fresh([round(1, 'active', ['cancelled', 'playing']), round(2, 'scheduled', ['waiting'])]);
await finish(0, 1);
({ state } = await read());
ok('finished + cancelled starts the next round', state.rounds[1].status === 'active');

console.log('the last round');
await fresh([round(1, 'finished', ['finished']), round(2, 'active', ['playing'])]);
await finish(1, 0);
({ state } = await read());
ok('after the last round the tournament is "Runde fullført" (ready to finish)', state.status === 'Runde fullført' && state.rounds[1].status === 'finished');
await pg.query(`update public.tournaments set state = jsonb_set(state, '{name}', '"y"'), revision = revision + 1 where id = $1`, [T]);
ok('and stays so on later writes', (await read()).state.status === 'Runde fullført');

console.log('left alone');
await fresh([round(1, 'active', ['playing']), round(2, 'scheduled', ['waiting'])], { format: 'cup' });
await finish(0, 0);
ok('a Cup is not advanced (its bracket has its own action)', (await read()).state.rounds[1].status === 'scheduled');
await fresh([round(1, 'active', ['finished']), round(2, 'scheduled', ['waiting'])]);
await pg.query(`update public.tournaments set expired_at = now() where id = $1`, [T]);
ok('a write that does not change the state does nothing', (await read()).state.rounds[1].status === 'scheduled');

console.log('the manual button uses the same step');
await fresh([round(1, 'active', ['finished']), round(2, 'scheduled', ['waiting'])]);
const manual = (await pg.query(`select public.admin_advance_round_impl($1, $2, 5) s`, [T, TOKEN])).rows[0].s;
ok('admin_advance_round still advances', manual.rounds[1].status === 'active' && manual.revision === 6);
let error = null;
await fresh([round(1, 'active', ['playing']), round(2, 'scheduled', ['waiting'])]);
try { await pg.query(`select public.admin_advance_round_impl($1, $2, 5)`, [T, TOKEN]); } catch (e) { error = e.message; }
ok('and still refuses an unfinished round with the same message', error?.includes('Alle kamper må være ferdige'), error);
error = null;
try { await pg.query(`select public.admin_advance_round_impl($1, 'wrong-token-wrong-token', 5)`, [T]); } catch (e) { error = e.message; }
ok('and a wrong admin token', error?.includes('Admin token mismatch'), error);
const grants = (await pg.query(`select has_function_privilege('anon', 'public._advance_round_state(jsonb)', 'execute') a`)).rows[0];
ok('the step is not callable by the API roles', grants.a === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
