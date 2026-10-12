-- User administration, part 2: a blocked or deleted account loses API access at once, and the owner finds users by name too.
--
-- Blocking (admin_block_user) sets auth.users.banned_until and deletes the account's sessions, so Supabase refuses new
-- sign-ins and token refreshes. But an access token that was issued before the block stays valid until it expires (up to
-- an hour), and the API only checks the token's signature. Deleting (admin_delete_user) has the same gap.
--
-- check_account_access closes it. PostgREST runs it before every API request (pgrst.db_pre_request); when the request
-- carries an account token whose account is blocked or no longer exists, the request is refused with 42501 (HTTP 403)
-- and the message 'account_blocked'. Requests without an account (guests, anon key) and the service role are untouched.
-- The check is one primary-key lookup, and an unexpected internal error lets the request through rather than taking the
-- whole API down (the block itself still holds through banned_until and the deleted sessions).
--
-- admin_list_users now also searches and returns the profile display name, so the owner can see which person an
-- e-mail address belongs to before blocking or deleting.

create or replace function public.check_account_access()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  uid uuid;
  denied boolean := false;
begin
  begin
    uid := auth.uid();
    if uid is not null then
      denied := not exists (
        select 1 from auth.users u
        where u.id = uid and (u.banned_until is null or u.banned_until <= now())
      );
    end if;
  exception when others then
    denied := false; -- never let the guard itself break the API
  end;
  if denied then
    raise exception 'account_blocked' using errcode = '42501', hint = 'The account is blocked or deleted. Sign in again.';
  end if;
end
$function$;
revoke execute on function public.check_account_access() from public;
grant execute on function public.check_account_access() to anon, authenticated, service_role;

do $guard$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.check_account_access''';
  end if;
end
$guard$;
notify pgrst, 'reload config';

-- admin_list_users: also search on and return the profile display name.
create or replace function public.admin_list_users(
  p_search text default null,
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
  pattern text := public._admin_like(nullif(trim(coalesce(p_search, '')), ''));
  has_search boolean := nullif(trim(coalesce(p_search, '')), '') is not null;
  total bigint;
  result jsonb;
begin
  if not public.is_system_owner() then
    raise exception 'Not authorized';
  end if;

  select count(*) into total
  from auth.users u left join public.profiles pr on pr.id = u.id
  where not has_search or coalesce(u.email, '') ilike pattern or coalesce(pr.display_name, '') ilike pattern;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb) into result
  from (
    select u.id,
           u.email,
           pr.display_name,
           (u.email_confirmed_at is not null) as email_confirmed,
           (u.banned_until is not null and u.banned_until > now()) as blocked,
           u.created_at,
           u.last_sign_in_at,
           (select count(*) from public.tournaments t where t.owner_user_id = u.id) as owned_tournaments,
           (select count(*) from public.tournament_account_players p where p.user_id = u.id) as played_tournaments,
           (select count(*) from public.account_tournament_statistics s where s.user_id = u.id) as finished_tournaments,
           exists (select 1 from public.system_owner o where o.user_id = u.id) as is_system_owner
    from auth.users u left join public.profiles pr on pr.id = u.id
    where not has_search or coalesce(u.email, '') ilike pattern or coalesce(pr.display_name, '') ilike pattern
    order by u.created_at desc
    limit lim offset off
  ) x;

  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'rows', result);
end
$function$;
revoke execute on function public.admin_list_users(text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;
