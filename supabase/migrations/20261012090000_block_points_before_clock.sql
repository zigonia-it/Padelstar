-- Timed matches take no points until their clock is started (developer's request 2026-10-12, reverses the "points can
-- be scored before the clock" part of 20261010150000). The clock is started with Start match (a waiting match) or
-- Start clock (a match already on court).
--   * save_player_point_impl: a point on a timed match whose clock has not started is refused.
--   * admin_set_result_impl: a set result on such a match is refused too.
-- The admin's own full-state saves (save_tournament_state) stay the admin's authority, as for every other rule; the
-- app blocks scoring there in the interface.
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

-- 1. Player points.
select pg_temp._patch_fn(
  'public.save_player_point_impl(uuid, text, uuid, uuid, integer, text)'::regprocedure,
  E'        if match_item->>''state'' <> ''playing'' then\n          raise exception ''Match is not currently playing'';\n        end if;\n',
  E'        if match_item->>''state'' <> ''playing'' then\n          raise exception ''Match is not currently playing'';\n        end if;\n\n        -- A timed match takes no points until its clock is started.\n        if match_item->>''startedAt'' is null\n          and coalesce((public._scoring_rules(match_item->''rules'', current_state->''settings'')->>''timedMinutes'')::integer, 0) > 0 then\n          raise exception ''Match clock not started'';\n        end if;\n');

-- 2. Admin set result.
select pg_temp._patch_fn(
  'public.admin_set_result_impl(uuid, text, uuid, integer, integer, integer)'::regprocedure,
  E'        if match_item->>''state'' not in (''playing'', ''waiting'') then\n          raise exception ''Match is not available for a set result'';\n        end if;\n',
  E'        if match_item->>''state'' not in (''playing'', ''waiting'') then\n          raise exception ''Match is not available for a set result'';\n        end if;\n        -- A timed match takes no result until its clock is started.\n        if match_item->>''startedAt'' is null\n          and coalesce((public._scoring_rules(match_item->''rules'', current_state->''settings'')->>''timedMinutes'')::integer, 0) > 0 then\n          raise exception ''Match clock not started'';\n        end if;\n');
