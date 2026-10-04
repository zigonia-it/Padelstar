-- 0.17.1 (field test 2026-10-04): the undo history grew with the square of the points.
--
-- Every point pushed a snapshot of the whole match onto match.undoStack, and that snapshot carried the match's eventLog
-- (and scorer log), which itself grows with every point. After 93 points one match held 800 KB of history, the
-- tournament state passed the 256 KB limit in save_tournament_state, and every admin save was refused with
-- "Invalid tournament state payload" (the admin's result hung on "sender"; players' points, written by
-- save_player_point, kept going).
--
-- A restore never takes the scorer role, its log or the event history from a snapshot (_scorer_restore and
-- admin_undo_match_impl keep the current ones), so they need not be stored. Only the last 20 steps are kept.
-- One BEFORE trigger applies this to every write of a tournament, whichever function wrote it; the client does the
-- same before it uploads (PadelstarState.compactMatchHistory).

create or replace function public._compact_history_entry(p_entry jsonb)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  entry jsonb := p_entry;
begin
  if jsonb_typeof(entry) is distinct from 'object' then
    return entry;
  end if;
  if jsonb_typeof(entry->'match') = 'object' then
    entry := jsonb_set(entry, '{match}',
      (entry->'match') - 'undoStack' - 'redoStack' - 'scorer' - 'scorerRequest' - 'scorerLog' - 'eventLog');
  end if;
  -- redo entries hold the undo entry they reverse and the snapshot they bring back
  if jsonb_typeof(entry->'undoEntry') = 'object' then
    entry := jsonb_set(entry, '{undoEntry}', public._compact_history_entry(entry->'undoEntry'));
  end if;
  if jsonb_typeof(entry->'target') = 'object' then
    entry := jsonb_set(entry, '{target}', public._compact_history_entry(entry->'target'));
  end if;
  return entry;
end
$function$;

create or replace function public._compact_history_stack(p_stack jsonb, p_limit integer default 20)
 returns jsonb
 language sql
 immutable
 set search_path to 'public', 'pg_catalog'
as $function$
  select case
    when jsonb_typeof(p_stack) is distinct from 'array' then p_stack
    else coalesce((
      select jsonb_agg(public._compact_history_entry(item.value) order by item.ordinality)
      from jsonb_array_elements(p_stack) with ordinality as item(value, ordinality)
      where item.ordinality > jsonb_array_length(p_stack) - p_limit
    ), '[]'::jsonb)
  end
$function$;

create or replace function public._compact_tournament_history(p_state jsonb)
 returns jsonb
 language plpgsql
 immutable
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  rounds jsonb;
  matches jsonb;
  match_item jsonb;
  r_idx integer;
  m_idx integer;
begin
  rounds := p_state->'rounds';
  if jsonb_typeof(rounds) is distinct from 'array' or jsonb_array_length(rounds) = 0 then
    return p_state;
  end if;
  for r_idx in 0..(jsonb_array_length(rounds) - 1) loop
    matches := rounds->r_idx->'matches';
    if jsonb_typeof(matches) is distinct from 'array' or jsonb_array_length(matches) = 0 then
      continue;
    end if;
    for m_idx in 0..(jsonb_array_length(matches) - 1) loop
      match_item := matches->m_idx;
      if jsonb_typeof(match_item) is distinct from 'object' then
        continue;
      end if;
      if jsonb_typeof(match_item->'undoStack') = 'array' then
        match_item := jsonb_set(match_item, '{undoStack}', public._compact_history_stack(match_item->'undoStack'));
      end if;
      if jsonb_typeof(match_item->'redoStack') = 'array' then
        match_item := jsonb_set(match_item, '{redoStack}', public._compact_history_stack(match_item->'redoStack'));
      end if;
      matches := jsonb_set(matches, array[m_idx::text], match_item);
    end loop;
    rounds := jsonb_set(rounds, array[r_idx::text, 'matches'], matches);
  end loop;
  return jsonb_set(p_state, '{rounds}', rounds);
end
$function$;

create or replace function public.compact_tournament_history()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_catalog'
as $function$
begin
  -- only writes that change the state: a finished tournament is read-only (tournament_finalization_before_update),
  -- and updates of other columns (expiry, retention) must not rewrite its history
  if tg_op = 'UPDATE' and new.state is not distinct from old.state then
    return new;
  end if;
  if new.state is not null then
    new.state := public._compact_tournament_history(new.state);
  end if;
  return new;
end
$function$;

-- BEFORE triggers fire in name order: this one ("tournament_c...") runs before tournament_finalization_before_update,
-- which compares the result. That guard ignores rounds for allowed corrections, so compaction never trips it.
drop trigger if exists tournament_compact_history_before_write on public.tournaments;
create trigger tournament_compact_history_before_write
  before insert or update on public.tournaments
  for each row execute function public.compact_tournament_history();

revoke all on function public._compact_history_entry(jsonb) from public, anon, authenticated;
revoke all on function public._compact_history_stack(jsonb, integer) from public, anon, authenticated;
revoke all on function public._compact_tournament_history(jsonb) from public, anon, authenticated;
revoke all on function public.compact_tournament_history() from public, anon, authenticated;

-- Existing live tournaments: compact the ones still being played. Finished tournaments are read-only and no longer
-- written; expired ones are left alone so that this rewrite does not count as activity (clear_tournament_expiry).
update public.tournaments
set state = public._compact_tournament_history(state)
where state->>'status' is distinct from 'Avsluttet'
  and expired_at is null
  and public._compact_tournament_history(state) is distinct from state;
