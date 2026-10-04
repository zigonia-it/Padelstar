// 0.17.1: the undo history no longer grows with the square of the points (field test 2026-10-04).
// Run:  npm install --no-save @electric-sql/pglite && node supabase/tests/compact-history.pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const dir = new URL('../migrations/', import.meta.url).pathname;
const pg = new PGlite();
await pg.exec(`
create role anon; create role authenticated;
create table public.tournaments(id uuid primary key, invite_code text unique, admin_token text, state jsonb, revision int default 0, expired_at timestamptz);
-- the real guard: a finished tournament is read-only
create function public.guard_tournament_finalization_update() returns trigger language plpgsql as $$
begin
  if old.state->>'status' = 'Avsluttet' and new.state is distinct from old.state then raise exception 'Finalized tournament is read-only'; end if;
  return new;
end $$;
create trigger tournament_finalization_before_update before update on public.tournaments for each row execute function public.guard_tournament_finalization_update();
`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };

// a match after n points, written the way save_player_point did before: every snapshot carries the event log so far
function bigMatch(id, points) {
  const eventLog = [], undoStack = [];
  for (let i = 0; i < points; i++) {
    const snapshot = { id, state: 'playing', currentGame: { teamOne: i % 4, teamTwo: 0 }, scorer: { playerId: 'p1' }, scorerLog: eventLog.slice(), eventLog: eventLog.slice(), undoStack: [{ nested: true }] };
    undoStack.push({ match: snapshot, nextWaitingMatch: null, roundId: 'r1', roundStatus: 'active', tournamentStatus: 'Runde pågår', revision: i, cupWinnerTeam: null });
    eventLog.push({ at: `2026-10-04T22:00:${String(i % 60).padStart(2, '0')}Z`, type: 'point', playerId: 'p1', teamIndex: 0 });
  }
  return { id, state: 'playing', currentGame: { teamOne: 1, teamTwo: 0 }, scorer: { playerId: 'p1' }, eventLog, undoStack,
    redoStack: [{ undoEntry: undoStack[0], target: { match: { id, eventLog, scorerLog: eventLog } } }] };
}
const state = (status, points) => ({ id: 't', inviteCode: 'HIST2345', status, rounds: [{ id: 'r1', status: 'active', matches: [bigMatch('m1', points), { id: 'm2', state: 'waiting', undoStack: [] }] }] });
const size = async (id) => (await pg.query('select length(state::text) n from public.tournaments where id = $1', [id])).rows[0].n;
const match = async (id) => (await pg.query(`select state->'rounds'->0->'matches'->0 m from public.tournaments where id = $1`, [id])).rows[0].m;

// a tournament that existed before the migration, still being played, and a finished one
const LIVE = '00000000-0000-4000-8000-000000000001', DONE = '00000000-0000-4000-8000-000000000002', EXPIRED = '00000000-0000-4000-8000-000000000003';
await pg.query(`insert into public.tournaments(id, invite_code, state) values ($1, 'LIVE2345', $2::jsonb)`, [LIVE, JSON.stringify(state('Runde pågår', 93))]);
await pg.query(`insert into public.tournaments(id, invite_code, state) values ($1, 'DONE2345', $2::jsonb)`, [DONE, JSON.stringify(state('Avsluttet', 30))]);
await pg.query(`insert into public.tournaments(id, invite_code, state, expired_at) values ($1, 'EXPD2345', $2::jsonb, now())`, [EXPIRED, JSON.stringify(state('Klar', 30))]);
const before = await size(LIVE);
const doneBefore = await size(DONE);
const expiredBefore = await size(EXPIRED);
ok('the field-test shape is over the 256 KB limit before', before > 262144, String(before));

await pg.exec(fs.readFileSync(dir + '20261005090000_compact_tournament_history.sql', 'utf8'));

console.log('the migration compacts tournaments still being played');
const after = await size(LIVE);
ok('93 points shrink far below the limit', after < 40000, `${before} -> ${after}`);
let m = await match(LIVE);
ok('only the last 20 undo steps are kept, newest last', m.undoStack.length === 20 && m.undoStack[19].revision === 92 && m.undoStack[0].revision === 73);
ok('snapshots no longer carry the event log, scorer, scorer log or nested stacks', m.undoStack.every((e) => !('eventLog' in e.match) && !('scorer' in e.match) && !('scorerLog' in e.match) && !('undoStack' in e.match)));
ok('the score in each snapshot is untouched', m.undoStack[19].match.currentGame.teamOne === 92 % 4 && m.undoStack[19].match.id === 'm1');
ok('the other snapshot fields (null values included) are untouched', m.undoStack[0].nextWaitingMatch === null && m.undoStack[0].cupWinnerTeam === null && m.undoStack[0].roundStatus === 'active');
ok("the match's own event log and scorer stay", m.eventLog.length === 93 && m.scorer.playerId === 'p1');
ok('redo entries are compacted too', !('eventLog' in m.redoStack[0].target.match) && !('eventLog' in m.redoStack[0].undoEntry.match));
ok('a finished tournament is not rewritten (read-only)', (await size(DONE)) === doneBefore);
ok('an expired tournament is not rewritten (that would count as activity)', (await size(EXPIRED)) === expiredBefore);

console.log('every later write is compacted, whichever function writes it');
await pg.query(`update public.tournaments set state = $2::jsonb where id = $1`, [LIVE, JSON.stringify(state('Runde pågår', 60))]);
m = await match(LIVE);
ok('a full-state write with 60 snapshots keeps 20 compact ones', m.undoStack.length === 20 && !('eventLog' in m.undoStack[0].match));
const NEW = '00000000-0000-4000-8000-000000000004';
await pg.query(`insert into public.tournaments(id, invite_code, state) values ($1, 'NEW23456', $2::jsonb)`, [NEW, JSON.stringify(state('Klar', 25))]);
ok('an insert is compacted', (await match(NEW)).undoStack.length === 20);
await pg.query(`update public.tournaments set state = jsonb_set(state, '{rounds,0,matches,0,undoStack}', (state->'rounds'->0->'matches'->0->'undoStack') || $2::jsonb) where id = $1`,
  [NEW, JSON.stringify([{ match: { id: 'm1', eventLog: [1, 2, 3], scorer: {}, currentGame: { teamOne: 3, teamTwo: 3 } }, revision: 99 }])]);
m = await match(NEW);
ok('a point appended in place (as save_player_point does) is compacted and capped', m.undoStack.length === 20 && m.undoStack[19].revision === 99 && !('eventLog' in m.undoStack[19].match));

console.log('no surprises');
let error = null;
try { await pg.query(`update public.tournaments set expired_at = now() where id = $1`, [DONE]); } catch (e) { error = e.message; }
ok('updating another column of a finished tournament still works (no state rewrite)', error === null, error);
await pg.query(`update public.tournaments set state = $2::jsonb where id = $1`, [LIVE, JSON.stringify({ id: 't', inviteCode: 'LIVE2345', status: 'Klar', rounds: [] })]);
ok('a tournament without rounds is left as it is', (await pg.query('select state from public.tournaments where id = $1', [LIVE])).rows[0].state.rounds.length === 0);
await pg.query(`update public.tournaments set state = $2::jsonb where id = $1`, [LIVE, JSON.stringify({ id: 't', inviteCode: 'LIVE2345', rounds: [{ id: 'r', matches: [{ id: 'x', undoStack: null }] }] })]);
ok('a match without an undo array is left as it is', (await match(LIVE)).undoStack === null);
const grants = (await pg.query(`select has_function_privilege('anon', 'public._compact_tournament_history(jsonb)', 'execute') a`)).rows[0];
ok('the helpers are not callable by the API roles', grants.a === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
