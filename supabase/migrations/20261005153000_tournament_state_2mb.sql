-- Large Round Robin tournaments (developer's decision 2026-10-05): a started 40-player tournament is about 0.8 MB,
-- over the 256 KB that create_tournament and save_tournament_state allowed, so it could not be saved live.
-- The limit is raised to 2 MB; everything else in both wrappers is unchanged.
create or replace function public.create_tournament(p_state jsonb, p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_state is null
    or jsonb_typeof(p_state) <> 'object'
    or pg_column_size(p_state) > 2097152
    or p_admin_token is null
    or p_admin_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or length(coalesce(p_state->>'name', '')) not between 1 and 80
    or coalesce(p_state->>'inviteCode', '') !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'Invalid tournament payload';
  end if;

  if not public.consume_api_rate_limit('create:' || p_admin_token, 10, 3600) then
    raise exception 'Rate limit exceeded';
  end if;

  return public.create_tournament_impl(p_state, p_admin_token);
end;
$function$;

create or replace function public.save_tournament_state(p_tournament_id uuid, p_admin_token text, p_state jsonb, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_state is null
    or jsonb_typeof(p_state) <> 'object'
    or pg_column_size(p_state) > 2097152
    or p_admin_token is null
    or p_admin_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_state->>'id' <> p_tournament_id::text
    or coalesce(p_state->>'inviteCode', '') !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'Invalid tournament state payload';
  end if;

  if not public.consume_api_rate_limit('admin-state:' || p_admin_token, 120, 60) then
    raise exception 'Rate limit exceeded';
  end if;

  return public.save_tournament_state_impl(p_tournament_id, p_admin_token, p_state, p_expected_revision);
end;
$function$;
