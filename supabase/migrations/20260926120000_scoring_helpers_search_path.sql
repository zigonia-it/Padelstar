-- Supabase advisor (2026-09-26): the pure scoring helpers added in 20260924120000 had a mutable search_path.
-- They only touch each other and pg_catalog functions and are not executable by the API roles; pin the path anyway.
alter function public._scoring_pick(jsonb, jsonb, text) set search_path to 'public', 'pg_catalog';
alter function public._scoring_level(jsonb, integer) set search_path to 'public', 'pg_catalog';
alter function public._scoring_rules(jsonb, jsonb) set search_path to 'public', 'pg_catalog';
alter function public._scoring_set_complete(integer, integer, jsonb) set search_path to 'public', 'pg_catalog';
alter function public._scoring_match_won(jsonb, jsonb) set search_path to 'public', 'pg_catalog';
alter function public._approval_validate_proposal(jsonb, jsonb) set search_path to 'public', 'pg_catalog';
alter function public._approval_validate_proposal(jsonb, integer, integer) set search_path to 'public', 'pg_catalog';
