# League v2.0 — implementation plan against the 1.0.0 codebase

Status: planning. Source of the product scope: `PADELSTAR – Version 2.0 League & Social Scope.md` (same folder, supplied by the developer 2026-10-05). This file maps that scope onto what already exists in `1.0.0`, so the build reuses it instead of starting over. Nothing here is built yet.

## 1. What already exists and can be reused

| Scope item | Exists in 1.0.0 | Gap for League |
|---|---|---|
| Big Score (§11) | `app/large-score.js`: two teams, tap-for-point, undo, win celebration, realtime | Shows the *serving team* (`startingTeamText`), not the serving *player*; no timer on the board |
| Timed matches (§2.1) | `app/scoring-engine.js`: `timedMinutes` (0–180), `isTimeUp`, countdown in `app/match-card.js` | Default 0, League default must be 5 |
| Golden Point on time-out (§2.1) | `scoring-engine.js` "deciding game": when level at time-out the next point wins (`gameWinBy = 1`) | Verify it behaves as "next point wins" in Points mode |
| Points-only scoring (§2.1) | Points mode from the generic scoring engine (0.17.0) | None for the score itself |
| Multiple courts (§13) | Courts, court queue (`app/court-queue.js`, `court-settings.js`), one live state per match | Every court in a round starts together (League rounds are synchronous) |
| Round advancement | `admin_advance_round_impl` + auto-advance trigger (0.17.3) — only `roundRobin` | Needs a `league` branch that calls the fairness generator |
| Partner/opponent rotation (§5) | `app/tournament-modes.js` has client-side Americano/Mexicano pairing (disabled in the UI) | Not history-aware across sessions; no sit-out or referee balancing |
| Ball asset (§12) | `assets/brand/padelstar-ball.png`, `padelstar-ball-128.png` | Just use it |
| Standings tiebreak (§15) | `scoring-engine.js` head-to-head mini-league, used in app, podium, TV | League ranks on league points → wins → point diff → H2H → matches |
| Player identity / stats (§16, §26) | `profiles`, `player_profiles`, `player_profile_history`, per-account statistics | Needs league participation and partner/opponent/referee counts |
| Live sync, TV mode, approval/correction | Whole tournament runtime | Reused as-is if a session *is* a tournament (see §2) |

## 2. Key architecture decision (proposed)

**A league session runs as a tournament with format `league`.** The `tournaments` row (one `state` jsonb per tournament) already carries live scoring, realtime, Big Score, TV mode, approval, corrections, undo and persistence. Building a second live engine for leagues would duplicate all of it, which the scope itself forbids (§21 "Avoid duplicating scoring and match functionality").

What is new is the layer *above* a single evening, stored relationally because it spans sessions:

```text
leagues            id, owner_user_id, name, created_at
league_seasons     id, league_id, name, starts_on, ends_on, status (DRAFT/ACTIVE/PAUSED/COMPLETED/ARCHIVED),
                   settings jsonb (match_minutes default 5, courts, golden_point, serve_rotation, fairness toggles)
league_players     season_id, player_profile_id (or guest name), joined_at, left_at
league_sessions    id, season_id, tournament_id → tournaments.id, session_date, status (PLANNED/CHECK_IN/ACTIVE/PAUSED/COMPLETED)
league_matches     id, session_id, round, court, team_a [2], team_b [2], referee, status
                   (SCHEDULED/ACTIVE/COMPLETED/POSTPONED/CANCELLED), score_a, score_b, finished_at
```

- Results stay the source of truth (§22): standings, partner/opponent/team history and referee counts are **views or functions over `league_matches`**, never stored tables that can drift.
- `league_matches` is written when a match in the session tournament is finished (same trigger point the account statistics use today), so correction after finish flows through.
- Postponed matchups (§8) are rows with status `POSTPONED` that the generator reads back when those four players are present again.
- Seasons store explicit `starts_on`/`ends_on`; presets (1/3/6/12 months, 1 Jan–30 Jun, 1 Jul–31 Dec) only fill those two dates in the UI (§19).

Alternative considered: a fully separate league engine with its own match tables and live state. Rejected because it doubles realtime, scoring, Big Score and TV work.

## 3. The fairness generator (core new logic)

A pure function, unit-testable without a database, in `app/league-generator.js` (mirrored in SQL or called from an RPC, like the scoring engine is today):

```text
input:  present players, courts, session state (matches played / sat out / refereed this session),
        season history (partner, opponent, full-team counts, last-played round, referee totals),
        postponed matchups
output: one round = for each court {teamA, teamB, referee}, plus the sit-out list
```

Steps per round:

1. **Who plays** (hard): capacity = 4 × courts. Pick the players with the fewest matches this session; ties → most sit-outs this session → most recent sit-out → fewest season matches. This guarantees equal playing time whenever it is mathematically possible.
2. **Who sits out** = the rest. Sit-out counts are balanced by step 1 automatically.
3. **Groups and teams** (soft): enumerate splits of the chosen players into courts of 4, and each 4 into 2+2 (3 ways). For 12 players/3 courts that is a few thousand candidates; above that use greedy + local swaps. Score each candidate with the §25 weights (new partner > new opponent > new full team > not-recent; postponed matchup present → bonus) and keep the best.
4. **Referees**: sit-outs first, fewest referee assignments (session, then season), not referee last round. If there are fewer sit-outs than courts, leave the remaining courts as "self-scored" by a player on court; admin can override (§10). Manual picks are recorded the same way.

Weights start simple and are tuned with a simulation test that plays whole seasons for every player/court count in scope §31 Phase 8 (4/1, 5/1, 6/1, 8/2, 9/2, 10/2, 12/3, changing attendance) and asserts: max−min matches per session ≤ 1, sit-outs spread ≤ 1, partner repeats fall over a season.

## 4. Serve rotation and the ball indicator

Serve order for teams (1,2) vs (3,4): 1R, 1L, 3R, 3L, 2R, 2L, 4R, 4L, repeat — i.e. the server changes every two points, alternating teams, then alternating the player within each team. Server = `order[floor(pointsPlayed / 2) % 4]`, side = `pointsPlayed % 2 === 0 ? right : left`. This is derived from the point count, so undo and realtime stay correct with no extra stored state, beyond who serves first (already `match.startingTeamIndex`) and which player of each team starts.

Big Score swaps the "Server: team" cell for `[padelstar-ball.png] Anna · right` and adds the countdown. This change is behind the `league` format so tournament Big Score is untouched.

## 5. Build order (maps to scope §31)

| Step | Scope phase | Deliverable | Depends on |
|---|---|---|---|
| A | 3 | `app/league-generator.js` + simulation tests (no UI, no DB) | — |
| B | 4 | Serve rotation helper + Big Score server-player indicator and timer, Points mode, 5-min default | — |
| C | 1 | Migration: league tables, RLS (owner/admin write, members read), standings/history functions | — |
| D | 2 | Create league / season wizard (dates, presets, minutes, courts), add/remove players | C |
| E | 2 + 5 | Session: check-in attendance → creates the session tournament with format `league`; round generation via the generator; referee auto/manual | A, C, D |
| F | 6 | League table, player stats, match history, player view ("Next match: Court 2, starts in 01:24") | C, E |
| G | 7 | Social: profiles/activity/friends/achievements fed by league results (ROADMAP Priority 4) | F |
| H | 8 | Full test matrix, real-device evening test | all |

A and B are independent of each other and of the database, so they can start first and be verified in isolation.

## 6. Conflicts with existing docs to resolve

- `docs/ROADMAP.md` lists "Liga tournament format" under v1.2 and "Leagues & seasons" under v1.3, with Social as v2.0. The new scope makes League part of **v2.0 together with Social**. The ROADMAP entries now point here; the developer should confirm whether v1.2/v1.3 keep any league work.
- `AGENTS.md`/`CLAUDE.md` say "do not build Liga as part of v1.0 work". Still true; League is v2.0 work.
- The scope's sit-out example (§3 table) rotates in fixed blocks; the generator achieves the same balance by "fewest matches first", which also handles players arriving or leaving mid-session.

## 7. Open questions for the developer

1. Guests in a league: only account players, or also named guests who can later claim their history (like tournaments today)?
2. When sit-outs are fewer than courts, is a self-scored court acceptable, or must the admin always pick an external referee?
3. Does a loss with a close score give anything (always 0 per §2.1), and does a Golden Point win count as a normal 3-point win? (Assumed yes.)
4. Who may create a league: any signed-in account, or only selected admins?
