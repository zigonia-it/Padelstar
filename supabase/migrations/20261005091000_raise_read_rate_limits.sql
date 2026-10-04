-- 0.17.1 (field test 2026-10-04): the read limit was 60 calls a minute per invite code, shared by every device that
-- follows the tournament. Every point makes each device (players, admin, TV) fetch the new revision, so with four or
-- five devices and a point every few seconds the code passed 60 a minute and devices were refused ("Rate limit
-- exceeded", 40 refusals in two minutes) and missed updates.
--
-- The limit is keyed on the code, so it never slowed down guessing codes (each guess is a different code); it only
-- throttled the people following one tournament. 600 a minute leaves room for a full club evening and still caps a
-- runaway client. Only the number changes.

create or replace function public.get_tournament_by_code(p_invite_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_invite_code is null
    or upper(trim(p_invite_code)) !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'Invalid invite code';
  end if;

  if not public.consume_api_rate_limit('get:' || upper(trim(p_invite_code)), 600, 60) then
    raise exception 'Rate limit exceeded';
  end if;

  return public.get_tournament_by_code_impl(p_invite_code);
end;
$function$;

create or replace function public.get_spectator_tournament_by_code(p_invite_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  tournament_state jsonb;
begin
  if p_invite_code is null
    or upper(trim(p_invite_code)) !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'Invalid invite code';
  end if;

  if not public.consume_api_rate_limit('spectator:' || upper(trim(p_invite_code)), 600, 60) then
    raise exception 'Rate limit exceeded';
  end if;

  select jsonb_build_object(
    'id', t.id,
    'name', t.state->'name',
    'inviteCode', t.state->'inviteCode',
    'status', t.state->'status',
    'currentRound', t.state->'currentRound',
    'settings', t.state->'settings',
    'courts', t.state->'courts',
    'players', t.state->'players',
    'rounds', t.state->'rounds',
    'cup', t.state->'cup',
    'revision', to_jsonb(t.revision)
  )
  into tournament_state
  from public.tournaments as t
  where t.invite_code = upper(trim(p_invite_code))
  limit 1;

  return tournament_state;
end;
$function$;
