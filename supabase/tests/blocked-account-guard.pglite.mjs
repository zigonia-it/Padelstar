// Database tests for migration 20261012100000_blocked_account_request_guard.sql, and the role checks for user administration
// (block, unblock, delete) end to end: who may call what, and that a blocked or deleted account loses API access at once.
// Run:  npm install --no-save @electric-sql/pglite && node supabase/tests/blocked-account-guard.pglite.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const dir = new URL('../migrations/', import.meta.url).pathname;
const pg = new PGlite();
const OWNER = '00000000-0000-4000-8000-000000000001';
const PLAYER = '00000000-0000-4000-8000-000000000002';
const VICTIM = '00000000-0000-4000-8000-000000000003';
const T_OTHER = '10000000-0000-4000-8000-000000000001';
const T_VICTIM = '10000000-0000-4000-8000-000000000002';
await pg.exec(`
create role anon; create role authenticated; create role service_role; create role authenticator;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz, banned_until timestamptz);
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
insert into auth.users(id, email, email_confirmed_at) values ('${OWNER}', 'sigurd.grodem@live.no', now()), ('${PLAYER}', 'player@example.com', now()), ('${VICTIM}', 'victim@example.com', now());
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text);
insert into public.profiles values ('${PLAYER}', 'Petter Spiller'), ('${VICTIM}', 'Vera Offer');
create table public.tournaments(id uuid primary key default gen_random_uuid(), state jsonb not null default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), owner_user_id uuid references auth.users(id) on delete set null, expired_at timestamptz, retention_expires_at timestamptz);
create table public.player_profiles(id uuid primary key default gen_random_uuid(), deletion_scheduled_for timestamptz);
create table public.tournament_account_players(tournament_id uuid, player_id uuid, user_id uuid references auth.users(id) on delete cascade);
create table public.account_tournament_statistics(user_id uuid references auth.users(id) on delete cascade, tournament_id uuid);
`);
for (const file of ['20260920110000_system_owner.sql', '20260920160000_system_admin_lists.sql', '20260920170000_system_log_and_user_admin.sql', '20260920220000_system_owner_two_factor.sql', '20261012100000_blocked_account_request_guard.sql']) await pg.exec(fs.readFileSync(dir + file, 'utf8'));
await pg.exec(`insert into public.system_owner(user_id) values ('${OWNER}') on conflict do nothing`);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };
// One API request: PostgREST runs the pre-request guard first, then the statement, as the caller's role.
const request = async (uid, sql, { aal = uid === OWNER ? 'aal2' : 'aal1', role } = {}) => {
  await pg.exec(`set role ${role ?? (uid ? 'authenticated' : 'anon')}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claim.aal', '${uid ? aal : ''}', false);`);
  try {
    await pg.query(`select public.check_account_access()`);
    return { failed: false, rows: (await pg.query(sql)).rows };
  } catch (e) { return { failed: true, message: e.message, code: e.code }; }
  finally { await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.aal', '', false);`); }
};
const refused = (r, text) => r.failed && r.message.includes(text);

console.log('the guard is wired into the API');
const setting = (await pg.query(`select array_to_string(rolconfig, ',') as c from pg_roles where rolname = 'authenticator'`)).rows[0].c ?? '';
ok('PostgREST runs check_account_access before every request', setting.includes('pgrst.db_pre_request=public.check_account_access'), setting);

console.log('1. a regular player only reaches player functions');
for (const call of [`select public.admin_list_users()`, `select public.admin_list_log()`, `select public.admin_overview()`, `select public.admin_block_user('${VICTIM}', true)`, `select public.admin_delete_user('${VICTIM}')`]) {
  ok(`player is refused: ${call.slice(14, 40)}`, refused(await request(PLAYER, call), 'Not authorized'));
}
for (const call of [`select public.admin_list_users()`, `select public.admin_block_user('${VICTIM}', true)`, `select public.admin_delete_user('${VICTIM}')`]) {
  ok(`a guest is refused: ${call.slice(14, 40)}`, refused(await request(null, call), 'permission denied'));
}
ok('the player can still use their own account', !(await request(PLAYER, `select public.system_owner_status()`)).failed);

console.log('2. the administrator keeps every administration function');
ok('the owner (second factor passed) lists users', !(await request(OWNER, `select public.admin_list_users()`)).failed);
ok('the owner lists the log', !(await request(OWNER, `select public.admin_list_log()`)).failed);
ok('the owner reads the overview', !(await request(OWNER, `select public.admin_overview()`)).failed);
ok('without the second factor the owner is refused', refused(await request(OWNER, `select public.admin_list_users()`, { aal: 'aal1' }), 'Not authorized'));

console.log('search');
let r = await request(OWNER, `select public.admin_list_users('Vera') as v`);
ok('the owner finds a user by display name', r.rows?.[0].v.total === 1 && r.rows[0].v.rows[0].email === 'victim@example.com' && r.rows[0].v.rows[0].display_name === 'Vera Offer', JSON.stringify(r));
r = await request(OWNER, `select public.admin_list_users('player@') as v`);
ok('and still by e-mail', r.rows?.[0].v.total === 1 && r.rows[0].v.rows[0].display_name === 'Petter Spiller');
r = await request(OWNER, `select public.admin_list_users('%') as v`);
ok('wildcards in the search are literal', r.rows?.[0].v.total === 0);

console.log('3-4. a blocked user loses access, also through a token issued before the block');
await pg.exec(`insert into auth.sessions(user_id) values ('${VICTIM}')`);
ok('before the block the victim can call the API', !(await request(VICTIM, `select public.system_owner_status()`)).failed);
await request(OWNER, `select public.admin_block_user('${VICTIM}', true)`);
ok('the block ends the sessions (no token refresh, no new sign-in)', (await pg.query(`select count(*)::int as n from auth.sessions where user_id = '${VICTIM}'`)).rows[0].n === 0);
r = await request(VICTIM, `select public.system_owner_status()`);
ok('the still-valid access token is refused at the API with 42501 account_blocked', r.failed && r.message === 'account_blocked' && r.code === '42501', JSON.stringify(r));
r = await request(VICTIM, `select 1 from public.profiles`);
ok('direct table access is refused too', refused(r, 'account_blocked'));
ok('other users are not affected', !(await request(PLAYER, `select public.system_owner_status()`)).failed);
ok('guests are not affected', !(await request(null, `select 1`)).failed);
ok('the service role is not affected', !(await request(null, `select 1`, { role: 'service_role' })).failed);
await pg.exec(`update auth.users set banned_until = now() - interval '1 minute' where id = '${PLAYER}'`);
ok('a ban that has run out does not block', !(await request(PLAYER, `select 1`)).failed);
await pg.exec(`update auth.users set banned_until = null where id = '${PLAYER}'`);

console.log('5. unblocking restores access');
await request(OWNER, `select public.admin_block_user('${VICTIM}', false)`);
ok('the victim can call the API again', !(await request(VICTIM, `select public.system_owner_status()`)).failed);
r = await request(OWNER, `select public.admin_list_log('user') as v`);
ok('block and unblock are both logged with the acting owner', ['user_blocked', 'user_unblocked'].every((kind) => r.rows[0].v.rows.some((x) => x.kind === kind && x.actor_id === OWNER)));

console.log('6. deleting a user leaves everyone else alone');
await pg.exec(`
insert into public.tournaments(id, state, owner_user_id) values ('${T_OTHER}', '{"name":"Player cup","status":"Klar"}', '${PLAYER}'), ('${T_VICTIM}', '{"name":"Victim cup","status":"Klar","players":[{"name":"Vera"},{"name":"Petter"}]}', '${VICTIM}');
insert into public.tournament_account_players values ('${T_VICTIM}', gen_random_uuid(), '${VICTIM}'), ('${T_VICTIM}', gen_random_uuid(), '${PLAYER}'), ('${T_OTHER}', gen_random_uuid(), '${PLAYER}');
insert into public.account_tournament_statistics values ('${VICTIM}', '${T_VICTIM}'), ('${PLAYER}', '${T_VICTIM}'), ('${PLAYER}', '${T_OTHER}');
`);
const before = (await pg.query(`select (select count(*) from public.tournament_account_players where user_id = '${PLAYER}')::int as links, (select count(*) from public.account_tournament_statistics where user_id = '${PLAYER}')::int as stats, (select count(*) from public.profiles where id = '${PLAYER}')::int as profile`)).rows[0];
r = await request(OWNER, `select public.admin_delete_user('${VICTIM}') as v`);
ok('the owner deletes the user', r.rows?.[0].v.deleted === true, JSON.stringify(r));
const after = (await pg.query(`select (select count(*) from public.tournament_account_players where user_id = '${PLAYER}')::int as links, (select count(*) from public.account_tournament_statistics where user_id = '${PLAYER}')::int as stats, (select count(*) from public.profiles where id = '${PLAYER}')::int as profile`)).rows[0];
ok("another player's links, statistics and profile are untouched", JSON.stringify(before) === JSON.stringify(after), JSON.stringify({ before, after }));
const kept = (await pg.query(`select id, owner_user_id, state from public.tournaments order by id`)).rows;
ok("the deleted user's tournament stays with its match data, without an owner", kept.length === 2 && kept[1].owner_user_id === null && kept[1].state.players.length === 2);
ok("another user's tournament keeps its owner", kept[0].owner_user_id === PLAYER);
ok("the deleted user's own profile, links and statistics are gone", (await pg.query(`select (select count(*) from public.profiles where id = '${VICTIM}')::int + (select count(*) from public.tournament_account_players where user_id = '${VICTIM}')::int + (select count(*) from public.account_tournament_statistics where user_id = '${VICTIM}')::int as n`)).rows[0].n === 0);
r = await request(VICTIM, `select public.system_owner_status()`);
ok("a deleted user's leftover access token is refused", refused(r, 'account_blocked'));

console.log('7. rights live in the database, not in the menu');
ok('the system owner can never be blocked', refused(await request(OWNER, `select public.admin_block_user('${OWNER}', true)`), 'cannot be blocked'));
ok('the system owner can never be deleted', refused(await request(OWNER, `select public.admin_delete_user('${OWNER}')`), 'cannot be deleted'));
ok('the API roles cannot change banned_until directly', refused(await request(PLAYER, `update auth.users set banned_until = null where id = '${PLAYER}'`), 'permission denied'));
ok('the API roles cannot make themselves owner', refused(await request(PLAYER, `insert into public.system_owner(user_id) values ('${PLAYER}')`), 'permission denied'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
