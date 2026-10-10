-- Timed matches: the clock starts when someone presses the start button on the match card, not on the first point
-- (developer's request 2026-10-10). Points can still be scored before the clock is started; they do not start it.
--   * save_player_point_impl no longer sets startedAt.
--   * admin_match_action_impl: 'start' (waiting -> playing) also starts the clock; new 'start_clock' starts the clock
--     of a match that is already playing.
--   * match_scorer_action_impl: new 'start_clock' for a player in the match (the active scorer, or anyone while the
--     match has no scorer).
-- Starting the clock also snapshots the rule profile onto the match (as the first point does), so the timer and the
-- time limit read the same rules from then on.
-- The functions are patched in place from their live definitions; a patch that does not find its target aborts.

create or replace function pg_temp._patch_fn(p_sig regprocedure, p_old text, p_new text)
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(p_sig);
begin
  if position(p_old in def) = 0 then
    raise exception 'patch target not found in %: %', p_sig, left(p_old, 80);
  end if;
  execute replace(def, p_old, p_new);
end
$$;

-- 1. A point no longer starts the clock.
select pg_temp._patch_fn(
  'public.save_player_point_impl(uuid, text, uuid, uuid, integer, text)'::regprocedure,
  E'        -- The clock of a timed match starts with the first point.\n        if match_item->>''startedAt'' is null then\n          match_item := jsonb_set(match_item, ''{startedAt}'', to_jsonb(now()), true);\n        end if;\n',
  E'        -- The clock of a timed match is started from the match card (admin_match_action / match_scorer_action), not here.\n');

-- 2. Admin: 'start' starts the clock too; 'start_clock' starts it on a match already playing.
select pg_temp._patch_fn(
  'public.admin_match_action_impl(uuid, text, uuid, text, integer, integer)'::regprocedure,
  $$or p_action not in ('start', 'cancel', 'walkover')$$,
  $$or p_action not in ('start', 'start_clock', 'cancel', 'walkover')$$);

select pg_temp._patch_fn(
  'public.admin_match_action_impl(uuid, text, uuid, text, integer, integer)'::regprocedure,
  E'        if p_action = ''start'' then\n          if match_item->>''state'' <> ''waiting'' then\n            raise exception ''Match is not waiting'';\n          end if;\n          match_item := jsonb_set(match_item, ''{state}'', ''"playing"''::jsonb, true);\n',
  E'        if p_action in (''start'', ''start_clock'') then\n          if p_action = ''start'' and match_item->>''state'' <> ''waiting'' then\n            raise exception ''Match is not waiting'';\n          end if;\n          if p_action = ''start_clock'' and match_item->>''state'' <> ''playing'' then\n            raise exception ''Match is not currently playing'';\n          end if;\n          if p_action = ''start_clock'' and match_item->>''startedAt'' is not null then\n            raise exception ''Match clock already started'';\n          end if;\n          match_item := jsonb_set(match_item, ''{state}'', ''"playing"''::jsonb, true);\n          if match_item->>''startedAt'' is null then\n            if jsonb_typeof(match_item->''rules'') is distinct from ''object'' then\n              match_item := jsonb_set(match_item, ''{rules}'', public._scoring_rules(match_item->''rules'', current_state->''settings''), true);\n            end if;\n            match_item := jsonb_set(match_item, ''{startedAt}'', to_jsonb(now()), true);\n          end if;\n');

-- 3. Player on the match: 'start_clock'.
select pg_temp._patch_fn(
  'public.match_scorer_action_impl(uuid, text, uuid, uuid, text, text, uuid)'::regprocedure,
  $$'heartbeat', 'undo', 'redo') then$$,
  $$'heartbeat', 'undo', 'redo', 'start_clock') then$$);

select pg_temp._patch_fn(
  'public.match_scorer_action_impl(uuid, text, uuid, uuid, text, text, uuid)'::regprocedure,
  E'  elsif p_action = ''undo'' or p_action = ''redo'' then\n',
  E'  elsif p_action = ''start_clock'' then\n    if match_item->>''state'' <> ''playing'' then\n      raise exception ''Match is not currently playing'';\n    end if;\n    if scorer is not null and not is_scorer then\n      raise exception ''Not the active scorer'';\n    end if;\n    if match_item->>''startedAt'' is not null then\n      raise exception ''Match clock already started'';\n    end if;\n    if jsonb_typeof(match_item->''rules'') is distinct from ''object'' then\n      match_item := jsonb_set(match_item, ''{rules}'', public._scoring_rules(match_item->''rules'', current_state->''settings''), true);\n    end if;\n    match_item := jsonb_set(match_item, ''{startedAt}'', to_jsonb(now()), true);\n    match_item := public._scorer_append(match_item, ''eventLog'', jsonb_build_object(\n      ''at'', now(), ''type'', ''clock_started'', ''playerId'', p_player_id), 300);\n\n  elsif p_action = ''undo'' or p_action = ''redo'' then\n');

-- 4. Undo and redo keep the running clock: a point scored before the clock was started can be undone without
--    stopping it (startedAt is kept from the current match, like the scorer role and the event history).
select pg_temp._patch_fn(
  'public._scorer_restore(jsonb, integer, integer, jsonb, jsonb, jsonb)'::regprocedure,
  $$foreach keep_field in array array['scorer', 'scorerRequest', 'scorerLog', 'eventLog'] loop$$,
  $$foreach keep_field in array array['scorer', 'scorerRequest', 'scorerLog', 'eventLog', 'startedAt'] loop$$);

select pg_temp._patch_fn(
  'public.admin_undo_match_impl(uuid, text, uuid, integer)'::regprocedure,
  $$foreach keep_field in array array['scorer', 'scorerRequest', 'scorerLog', 'eventLog'] loop$$,
  $$foreach keep_field in array array['scorer', 'scorerRequest', 'scorerLog', 'eventLog', 'startedAt'] loop$$);
