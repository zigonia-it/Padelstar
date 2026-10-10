# PROJECT.md

# Padelstar – Product Source of Truth

Padelstar is a multi-device padel tournament application/PWA for creating, running, scoring and displaying tournaments.

Last updated: 2026-10-05.

## Current state

- **Version 1.0.0** is live on https://padelstar.app (Vercel, deployed from `main`; Supabase project `sxzlljxodorkfrjnwfgr` in the EU). Released 2026-10-05 with the Padelstar 1.0 redesign.
- Merged after 1.0.0, not yet versioned: the motion system and win moment (PR #42, #45) and the missing 512 px icon (PR #43). See `docs/CHANGELOG.md` "Unreleased".
- Open pull requests: **#44** large Round Robin can be created (the 2 MB server limit it needs is already live); **#46** League v2.0 plan and `docs/MASTER-ROADMAP.md`.
- League v2.0 work has started (developer's choice 2026-10-10): step B, serve rotation and the ball in Big Score, is in a draft PR on branch `league-serve-bigscore`.
- Live modes: Round Robin and Cup. Scoring: Tennis (padel) and Points modes on the generic scoring engine.
- Current stage of the plan: **1.0.x, stabilise** (master roadmap §1): live verification on real devices, the open bugs in `docs/BUGS.md`, the privacy sign-off, motion step 3.
- What the developer must do or decide: `docs/USER_ACTIONS.md`.

## The plan

`docs/MASTER-ROADMAP.md` is the **governing plan** for all development (developer's decision 2026-10-05). It sets what comes in which release and in what order, from 1.0.x to 4.x. `docs/ROADMAP.md` is the detailed checkbox plan underneath it; where the two disagree, the master roadmap wins. Work that is not in the master roadmap needs an explicit developer instruction, and that instruction is then added to the master roadmap.

## The critical path (must never break)

The flow that 0.6.0 was built around stays the regression check for every change:

1. Owner can create an account and log in.
2. Owner can create a Round Robin tournament.
3. The tournament starts; results can be registered.
4. State and results persist to the server (Supabase) and survive a reload.
5. The tournament finishes cleanly, and a new one can be created afterwards.

## Core principles

- Accounts are optional for ordinary tournament participation, but account ownership/history is supported.
- Shared active tournament state uses backend/database state when multiple devices participate.
- Current implemented UI is the design authority.
- Product rules must not be silently changed to match old documentation.
- Round Robin and Cup are the 1.x tournament modes. League (ligaspill) is release 2.0 together with Social (master roadmap §7). Hidden formats (Americano, Mexicano, ...) are not deleted; they are server-wired in 1.2.

## Ownership/account

- Owner/account user can create and log in.
- Guest use remains possible where designed.
- Account-owned tournaments may persist in history.
- Security-sensitive owner/admin access is enforced backend/database-side.

## Round Robin

- Tournament setup can create a valid Round Robin.
- Tournament starts into a valid playable state.
- Matches/results update the tournament correctly.
- Standings/ranking update correctly.
- Tournament can reach a completed final state.
- A completed tournament must not prevent creating a new one.

## Server persistence

The backend/Supabase is authoritative for shared tournament data.

Critical tournament state must survive:

- refresh;
- reopening the app;
- ordinary device/network reconnection scenarios.

Do not treat browser local storage as the only backup/source for active shared tournament state.

## Result entry

One active scorer per match, point by point, approved by the teams (details below). The admin can always register and correct results.

## Approved product behaviour (built so far)

- **Scoring**: golden point, set tiebreak and timed matches (a game won after time is up ends the match; level after time = deciding golden-point game) are rule settings; ties in the table are broken head-to-head. One active scorer per match; a player-scored result is approved by one player of each team (auto-approved after 30 minutes, or at once when only one team uses the app); the admin can always approve and can correct a finished result with a reason (the old result is kept and can be restored). After the finish only the admin can still correct a result (see "Corrections after the finish" below).
- **Players who leave**: the admin can replace a player (a running match restarts at 0–0 after a warning) or withdraw them without a replacement: their unplayed matches wait for the remaining teammate, who plays alone (1 against 2) or gives a walkover (the admin can decide for them).
- **Guests and accounts**: guests use a temporary session per device; a name alone never takes over a claimed slot. A signed-in account can claim an unclaimed pre-added slot; statistics follow the account. The admin can invite people by email; an invitation reserves nothing until the person joins and lapses when the first round starts.
- **History**: only account players get permanent statistics, written once at the finish; deleting a tournament never deletes anyone's statistics.
- **Retention**: a finished guest tournament stays readable for 24 hours; an idle one expires after 30 days and is deleted 7 days later unless resumed; account tournaments and statistics are kept.
- **Notifications**: in-app notifications (match ready, result to approve, teammate withdrew, correction, finished) with a notification center, a toast and vibration (not on iPhone). No in-app sounds since 1.0.0 (developer's decision): the browser's or phone's own notifications carry the sound.
- **TV Mode** opens in a new tab, read-only, in the chosen language. **Guide and privacy** open as a popup.
- **System owner**: exactly one protected owner, stored in the database; `admin.html` and its data are for the owner only (details below).
- **Corrections after the finish**: the admin can still correct a finished result (not in a cancelled tournament); the account statistics follow the corrected result. A Cup result that later matches depend on stays blocked.
- **Invitations by email**: the invitation is saved in the app first, then emailed from `invitations@padelstar.app` (join link and code). The invited person also sees it under Profil after signing in with that verified address.
- **System owner**: `admin.html` has Oversikt, Turneringer (search, filter, paging), Brukere (search, block, unblock, delete; never the owner), Logg (sign-ups, tournaments created/finished/deleted, the owner's own actions; ids only, 90 days) and Vedlikehold (cleanup jobs). Everything else the owner could do with other people's tournaments is deliberately not built (privacy).
- **TV Mode** works on desktop and phone (button in the rail and the phone tab bar; the page stacks on a phone) and has the Lys/Mørk switch.
- **Privacy text** ends with a section naming the services used (Supabase in the EU, Vercel, Resend, jsDelivr, flagcdn.com, Cloudflare Turnstile, quickchart.io).
- **Design (1.0.0)**: the Padelstar 1.0 redesign from the Claude Design system: one token set (`styles/tokens.css`), two themes (Daylight and Floodlight); the choice is saved, the device decides only on the first visit. No colour literals in components. Players have no colour or avatar (names in plain ink). The version shows in a pill beside the logo.
- **Motion**: motion tokens and `docs/technical/motion.md`; the menu highlight slides, pages fly in, a win moment on the winning point, the podium lands 3rd, 2nd, 1st. "Reduce motion" removes movement.
- **Round Robin rounds advance by themselves** (0.17.3): when the last match of a round is finished or cancelled, the next round starts in the same database write.
- **One screen for lobby, Styring, Kamper and Tabell** (0.12.0): the lobby is the first panel of the workspace, reached from the side rail, the phone tab bar and the sub-tabs.
- **Withdrawal in a Cup** (0.13.0): the same conditions as in a Round Robin; a fully withdrawn team = walkover; both sides of a match withdrawn = the best-placed losing team takes the place after the admin confirms.
- **Sign-up check**: a Cloudflare Turnstile "I'm not a robot" dialog before sign-up, sign-in and the admin sign-in link (enforced by Supabase).
- **Two-factor for System** (0.14.0): the owner needs a code from an authenticator app (TOTP) on top of signing in; every owner function checks it in the database.
- **Push categories** (0.15.0): each device chooses match/round, results, withdrawal decisions and "only my own matches"; the server filters before sending. Invitation push is planned.
- **Unverified accounts** are deleted after 7 days (0.13.1).

## Decided, not yet on main

- **Large Round Robin** (2026-10-05, PR #44): up to 8 players every team meets every other team; above 8 each team plays one match per rotation against a neighbouring team. Tournament state may be up to 2 MB (already live in the database).

## Later versions

See `docs/MASTER-ROADMAP.md`: 1.1 templates, 1.2 more formats and a player-first UI, 1.3 organiser tools, 1.4 administration, 1.5 match-model foundation, 2.0 League and Social, 3.0 scheduled tournaments and payments, 4.x community, clubs and commercial.

## Version baseline

The actual current baseline is `1.0.0` (released 2026-10-05 on the developer's instruction: the Padelstar 1.0 redesign). The history of every earlier version is in `docs/CHANGELOG.md`.

Version changes are milestone-based:

- patch (`1.0.x`) for verified bug-fix batches;
- minor (`1.x.0`) for coherent verified feature milestones;
- major (`2.0.0`) only for a decided, verified major release.

Codex may recommend a version after a completed verified milestone, but only the developer decides whether to apply the version change.
