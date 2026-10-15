-- System administration can delete a tournament (developer's request 2026-10-12).
--
-- admin_delete_tournament: only the system owner (is_system_owner(), which requires aal2). Deleting the tournaments row
-- cascades to its live data (player_sessions, tournament_account_players, tournament_invitations, push_subscriptions,
-- match_scorer_heartbeats), and the existing tournaments_log_* trigger writes "tournament_deleted" to the system log.
-- The delete guard (guard_tournament_history_deletion) needs a finalization receipt, so a tournament that was never
-- finalized gets a 'cancelled' receipt first, exactly like cleanup_stale_guest_tournaments does; the receipt stays as the
-- tombstone. Account statistics and profile history have no foreign key and are kept by default, like the automatic
-- retention cleanup does. p_remove_history = true also removes those rows for this tournament (used for test data). Devices that still have the tournament open find it missing on their next server call or refresh and leave it.
--
-- admin_list_tournaments now also returns the invite code and the owner's e-mail, so the admin can check that the right
-- tournament is chosen, and the search matches the invite code as well as the name.

create or replace function public.admin_delete_tournament(p_tournament_id uuid, p_remove_history boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  target public.tournaments%rowtype;
  stats_removed integer := 0;
  history_removed integer := 0;
begin
  if not public.is_system_owner() then
    raise exception 'Not authorized';
  end if;
  if p_tournament_id is null then raise exception 'Invalid request'; end if;

  select * into target from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;

  if coalesce(p_remove_history, false) then
    delete from public.account_tournament_statistics where tournament_id::text = p_tournament_id::text;
    get diagnostics stats_removed = row_count;
    delete from public.player_profile_history where tournament_id::text = p_tournament_id::text;
    get diagnostics history_removed = row_count;
  end if;

  insert into public.tournament_finalization_receipts
    (tournament_id, admin_token_hash, outcome, revision, deleted, finalized_at)
  values
    (target.id, encode(extensions.digest(target.admin_token, 'sha256'), 'hex'), 'cancelled', target.revision, true, now())
  on conflict do nothing;

  delete from public.tournaments where id = p_tournament_id;

  return jsonb_build_object(
    'id', p_tournament_id,
    'deleted', true,
    'inviteCode', target.invite_code,
    'statisticsRemoved', stats_removed,
    'historyRemoved', history_removed
  );
end
$function$;

revoke execute on function public.admin_delete_tournament(uuid, boolean) from public, anon;
grant execute on function public.admin_delete_tournament(uuid, boolean) to authenticated;

create or replace function public.admin_list_tournaments(
  p_search text default null,
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  lim integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  off integer := greatest(coalesce(p_offset, 0), 0);
  status_filter text := case when p_status in ('running', 'finished', 'expired') then p_status else 'all' end;
  pattern text := public._admin_like(nullif(trim(coalesce(p_search, '')), ''));
  has_search boolean := nullif(trim(coalesce(p_search, '')), '') is not null;
  total bigint;
  result jsonb;
begin
  if not public.is_system_owner() then
    raise exception 'Not authorized';
  end if;

  select count(*) into total
  from public.tournaments t
  where (not has_search or coalesce(t.state->>'name', '') ilike pattern or t.invite_code ilike pattern)
    and (status_filter = 'all'
      or (status_filter = 'finished' and t.state->>'status' = 'Avsluttet')
      or (status_filter = 'expired' and t.expired_at is not null)
      or (status_filter = 'running' and coalesce(t.state->>'status', '') <> 'Avsluttet' and t.expired_at is null));

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb) into result
  from (
    select t.id,
           t.invite_code,
           t.state->>'name' as name,
           t.state->>'status' as status,
           t.state->'settings'->>'format' as format,
           jsonb_array_length(coalesce(t.state->'players', '[]'::jsonb)) as players,
           jsonb_array_length(coalesce(t.state->'rounds', '[]'::jsonb)) as rounds,
           (t.owner_user_id is not null) as account_owned,
           u.email as owner_email,
           t.expired_at,
           t.retention_expires_at,
           t.created_at,
           t.updated_at
    from public.tournaments t
    left join auth.users u on u.id = t.owner_user_id
    where (not has_search or coalesce(t.state->>'name', '') ilike pattern or t.invite_code ilike pattern)
      and (status_filter = 'all'
        or (status_filter = 'finished' and t.state->>'status' = 'Avsluttet')
        or (status_filter = 'expired' and t.expired_at is not null)
        or (status_filter = 'running' and coalesce(t.state->>'status', '') <> 'Avsluttet' and t.expired_at is null))
    order by t.created_at desc
    limit lim offset off
  ) x;

  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'rows', result);
end
$function$;
