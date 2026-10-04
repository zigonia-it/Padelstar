-- 0.17.3 (field test 2026-10-05; developer's decision): a Round Robin round starts the next one by itself.
--
-- Before: when the last match of a round was finished, the admin had to press "Start neste runde"
-- (admin_advance_round). Now the database does it in the same write that finishes the last match, whichever function
-- wrote it (an approved player result, the admin's result or point, a walkover, the approval cron, a full admin save).
-- The step itself is unchanged and shared: _advance_round_state is exactly the body of admin_advance_round_impl
-- (20260918201324_advance_round_assigns_courts.sql): the active round is marked finished, the next scheduled round
-- becomes active with its first matches on the courts, or the tournament is "Runde fullført" after the last round.
-- The manual button keeps working through the same function. A Cup is untouched (its bracket has its own action).

create or replace function public._advance_round_state(p_state jsonb)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  current_state jsonb := p_state;
  rounds jsonb;
  active_round jsonb;
  next_round jsonb;
  matches jsonb;
  active_index integer;
  next_index integer;
  round_scan_index integer;
  match_scan_index integer;
  court_count integer;
  court_list jsonb;
  court_item jsonb;
  started_count integer := 0;
begin
  if coalesce(current_state->'settings'->>'format', 'roundRobin') <> 'roundRobin' then
    raise exception 'Cup round advancement requires bracket action';
  end if;

  rounds := coalesce(current_state->'rounds', '[]'::jsonb);
  active_index := null;
  next_index := null;

  if jsonb_array_length(rounds) > 0 then
    for round_scan_index in 0..(jsonb_array_length(rounds) - 1) loop
      if rounds->round_scan_index->>'status' = 'active' then
        active_index := round_scan_index;
        exit;
      end if;
    end loop;
  end if;

  if active_index is null then
    raise exception 'No active round to advance';
  end if;

  active_round := rounds->active_index;
  matches := coalesce(active_round->'matches', '[]'::jsonb);
  if jsonb_array_length(matches) = 0
    or exists (
      select 1
      from jsonb_array_elements(matches) round_match
      where coalesce(round_match->>'state', '') not in ('finished', 'cancelled')
    ) then
    raise exception 'Alle kamper må være ferdige før neste runde';
  end if;

  active_round := jsonb_set(active_round, '{status}', '"finished"'::jsonb, true);
  rounds := jsonb_set(rounds, ARRAY[active_index::text], active_round, false);

  if active_index + 1 <= jsonb_array_length(rounds) - 1 then
    for round_scan_index in (active_index + 1)..(jsonb_array_length(rounds) - 1) loop
      if rounds->round_scan_index->>'status' = 'scheduled' then
        next_index := round_scan_index;
        exit;
      end if;
    end loop;
  end if;

  if next_index is not null then
    next_round := rounds->next_index;
    if next_round->>'startedAt' is null then
      next_round := jsonb_set(next_round, '{startedAt}', to_jsonb(now()), true);
    end if;
    next_round := jsonb_set(next_round, '{status}', '"active"'::jsonb, true);
    matches := coalesce(next_round->'matches', '[]'::jsonb);
    court_list := coalesce(current_state->'courts', '[]'::jsonb);
    court_count := greatest(1, jsonb_array_length(court_list));
    if jsonb_array_length(matches) > 0 then
      for match_scan_index in 0..(jsonb_array_length(matches) - 1) loop
        if matches->match_scan_index->>'state' = 'waiting' and started_count < court_count then
          matches := jsonb_set(matches, ARRAY[match_scan_index::text, 'state'], '"playing"'::jsonb, true);
          matches := jsonb_set(matches, ARRAY[match_scan_index::text, 'status'], '"active"'::jsonb, true);
          matches := jsonb_set(matches, ARRAY[match_scan_index::text, 'queuePosition'], 'null'::jsonb, true);
          court_item := court_list->started_count;
          if jsonb_typeof(court_item) = 'object' then
            matches := jsonb_set(matches, ARRAY[match_scan_index::text, 'courtId'], coalesce(court_item->'id', 'null'::jsonb), true);
            matches := jsonb_set(matches, ARRAY[match_scan_index::text, 'courtName'], coalesce(court_item->'name', 'null'::jsonb), true);
          end if;
          started_count := started_count + 1;
        end if;
      end loop;
    end if;
    next_round := jsonb_set(next_round, '{matches}', matches, true);
    rounds := jsonb_set(rounds, ARRAY[next_index::text], next_round, false);
    current_state := jsonb_set(current_state, '{currentRound}', to_jsonb((next_round->>'roundNumber')::integer), true);
    current_state := jsonb_set(current_state, '{status}', '"Runde pågår"'::jsonb, true);
  else
    current_state := jsonb_set(current_state, '{status}', '"Runde fullført"'::jsonb, true);
  end if;

  return jsonb_set(current_state, '{rounds}', rounds, true);
end
$function$;

-- The manual "Start neste runde": same checks and messages as before, the step itself from _advance_round_state.
create or replace function public.admin_advance_round_impl(p_tournament_id uuid, p_admin_token text, p_expected_revision integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  current_state jsonb;
  current_revision integer;
begin
  if p_tournament_id is null
    or p_admin_token is null
    or length(p_admin_token) < 16
    or p_expected_revision is null
    or p_expected_revision < 0 then
    raise exception 'Invalid round advance payload';
  end if;

  select state, revision into current_state, current_revision
  from public.tournaments
  where id = p_tournament_id
    and admin_token = p_admin_token
  for update;

  if current_state is null then
    raise exception 'Admin token mismatch or tournament not found';
  end if;

  if current_revision <> p_expected_revision then
    raise exception 'Tournament state changed or not found';
  end if;

  current_state := jsonb_set(current_state, '{revision}', to_jsonb(current_revision), true);
  current_state := public._advance_round_state(current_state);
  current_revision := current_revision + 1;
  current_state := jsonb_set(current_state, '{revision}', to_jsonb(current_revision), true);
  update public.tournaments
  set state = current_state,
      revision = current_revision
  where id = p_tournament_id;

  return current_state;
end;
$function$;

-- The automatic step. Only a write that changes the state of a Round Robin still being played, and only when its
-- active round has just become complete (every match finished or cancelled). Anything the step refuses leaves the
-- write exactly as it was.
create or replace function public.auto_advance_round()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  active_round jsonb;
begin
  if new.state is not distinct from old.state
    or coalesce(new.state->'settings'->>'format', 'roundRobin') <> 'roundRobin'
    or coalesce(new.state->>'status', '') in ('Avsluttet', 'Runde fullført') then
    return new;
  end if;
  select value into active_round
  from jsonb_array_elements(coalesce(new.state->'rounds', '[]'::jsonb)) value
  where value->>'status' = 'active'
  limit 1;
  if active_round is null
    or jsonb_array_length(coalesce(active_round->'matches', '[]'::jsonb)) = 0
    or exists (select 1 from jsonb_array_elements(active_round->'matches') m
               where coalesce(m->>'state', '') not in ('finished', 'cancelled')) then
    return new;
  end if;
  begin
    new.state := public._advance_round_state(new.state);
  exception when others then
    null; -- not advanceable: keep the write as it is
  end;
  return new;
end
$function$;

-- Before the history compaction and the finalization guard (BEFORE triggers fire in name order). The step never sets
-- "Avsluttet", so the guard is never involved; the revision is the one the writer already set.
drop trigger if exists tournament_auto_advance_round_before_update on public.tournaments;
create trigger tournament_auto_advance_round_before_update
  before update on public.tournaments
  for each row execute function public.auto_advance_round();

revoke all on function public._advance_round_state(jsonb) from public, anon, authenticated;
revoke all on function public.auto_advance_round() from public, anon, authenticated;
revoke all on function public.admin_advance_round_impl(uuid, text, integer) from public, anon, authenticated;
