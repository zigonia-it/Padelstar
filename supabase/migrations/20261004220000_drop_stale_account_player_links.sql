-- 0.17.1 (field test 2026-10-04): an account linked to a player who has since left the roster could not claim another
-- slot in the same tournament: the stale row in tournament_account_players answered "Account already joined" forever.
-- The account's links to players no longer on the roster are dropped before the checks run. Links to players still on
-- the roster are untouched, so "one slot per account" and "no takeover" stay exactly as in 20260920120000.

create or replace function public.join_tournament_authenticated_impl(p_invite_code text, p_player jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  tid uuid; current_state jsonb; existing_player jsonb; result jsonb;
  uid uuid := auth.uid(); pid uuid;
begin
  select id, state into tid, current_state from public.tournaments
    where invite_code = upper(trim(p_invite_code)) for update;
  if tid is null or current_state->>'status' = 'Avsluttet' then raise exception 'Tournament not active'; end if;
  -- a link to a player who is no longer on the roster (removed by the admin, or dropped by an admin save) is stale:
  -- it must not keep this account out of the tournament ("Account already joined", field test 2026-10-04)
  if uid is not null then
    delete from public.tournament_account_players tap
      where tap.tournament_id = tid and tap.user_id = uid
        and not exists (select 1 from jsonb_array_elements(coalesce(current_state->'players', '[]')) v
                          where v->>'id' = tap.player_id::text);
  end if;
  select value into existing_player from jsonb_array_elements(coalesce(current_state->'players', '[]'))
    where lower(value->>'name') = lower(trim(p_player->>'name')) limit 1;
  if uid is not null and existing_player is not null and not exists (
    select 1 from public.tournament_account_players
    where tournament_id = tid and player_id = (existing_player->>'id')::uuid and user_id = uid
  ) then
    -- not this account's slot: only a slot that nobody has linked or claimed may be claimed
    if exists (select 1 from public.tournament_account_players
                 where tournament_id = tid and player_id = (existing_player->>'id')::uuid)
       or exists (select 1 from public.player_sessions
                    where tournament_id = tid and player_id = (existing_player->>'id')::uuid) then
      raise exception 'Player name belongs to another session';
    end if;
  end if;
  if uid is not null and exists (select 1 from public.tournament_account_players
    where tournament_id = tid and user_id = uid and player_id <> coalesce((existing_player->>'id')::uuid, gen_random_uuid()))
    then raise exception 'Account already joined'; end if;
  result := public.join_tournament_impl(p_invite_code, p_player - 'userId' - 'profileId');
  pid := (result->>'playerId')::uuid;
  if uid is not null then
    insert into public.tournament_account_players values (tid, pid, uid) on conflict do nothing;
  end if;
  update public.tournaments t set state = jsonb_set(t.state, '{players}', (
    select jsonb_agg(case when value->>'id' = pid::text then
      (value - 'userId' - 'profileId') || jsonb_build_object('userId', uid, 'guest', uid is null)
      else value end) from jsonb_array_elements(t.state->'players')
  )) where id = tid returning state into current_state;
  return jsonb_set(result, '{state}', current_state);
end $function$;

revoke all on function public.join_tournament_authenticated_impl(text, jsonb) from public, anon, authenticated;
