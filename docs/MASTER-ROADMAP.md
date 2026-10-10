# Padelstar – Master Roadmap (1.0.0 → 4.x)

Status: **governing plan** — written 2026-10-05 on the developer's request ("one plan for the whole development from the current version to everything planned") and confirmed the same day as the definitive plan that steers development ("behold master-roadmap som definitiv plan. la denne styre utviklingen."). It merges four sources into one order:

- `docs/ROADMAP.md` (Priority 1 open items, Priority 2–4, post-1.0 backlog)
- `docs/BUGS.md` and the open follow-ups after the 1.0.0 release
- `docs/future_development/PADELSTAR – Version 2.0 League & Social Scope.md` (+ `league-v2-implementation-plan.md`)
- `docs/future_development/PADELSTAR – Version 3.x–4.x Master Development Plan.md`

`docs/ROADMAP.md` stays the detailed, checkbox-level plan for the release being worked on. This file is the overview: what comes in which release, in what order, and why. Version numbers below are **targets**, not promises: a version is only applied when the milestone is implemented, tested and verified (AGENTS.md "Versioning", master plan §72).

---

## 0. The shape of the whole plan

| Generation | Theme | Releases |
|---|---|---|
| **1.x** | Finish and broaden the tournament app | 1.0.x stabilise → 1.1 templates → 1.2 more formats → 1.3 organiser tools → 1.4 administration → 1.5 match-model foundation |
| **2.x** | League & Social | 2.0 league + social core → 2.1 rivalries, achievements, sharing → 2.2+ league extensions |
| **3.x** | Scheduled tournaments & payments | 3.0 schedule → register → settle → Vipps → play → 3.1/3.2 more payment providers |
| **4.x** | Community, clubs & commercial | Phases A–G (QR check-in … ecosystem), entitlements and paid tiers |

Guiding rule across all of it: **build reusable engines, not one tightly coupled app** (master plan §2, §75). Each release below names the engine it grows.

```text
1.x  Tournament + Scoring engines mature
2.0  League engine (fairness generator) + Social engine (friends, profiles)
2.1  Statistics engine (H2H, partners, achievements)
3.0  Registration engine + Payment engine (+ Notification engine grows)
4.x  Entitlement engine, Groups/Seasons, Rating, Live hub
```

---

## 1. Release 1.0.x — stabilise what shipped (now)

Goal: 1.0.0 is solid on real devices before new features land. Patch releases only.

- **Live verification debt.** Priority 1 phases in `ROADMAP.md` that are built and unit-tested but still unchecked because no person has verified them on real devices: multi-device live scoring and offline takeover (Phase 10), result correction push (12), replacement/withdrawal (13), history/statistics (15), retention and account deletion (16), invitations (17), push notifications on phones (18), TV public view (19), network loss during a match (25). One structured multi-account field test covers most of these.
- **Open bugs** (`BUGS.md`): the unconfirmed "Fullfør turnering stays Runde pågår" report; the editor-formatting issue that breaks tests.
- **Release follow-ups:** privacy page "beta text" line needs owner sign-off; nn/es/de/fr privacy and guide text are older than nb/en.
- **Motion step 3** (from the animations work): standings reorder animation (app + TV), dialogs/sheets, TV live pulse.
- **Timed-match start clock button** (developer's request 2026-10-10): the clock starts from the match card, not on the first point. Built in PR #49.
- **Phase 30 Definition of Done** boxes checked for real, then `ROADMAP.md` Priority 1 can be archived.

Pending developer decisions already listed in ROADMAP that block items here: post-finish corrections scope, retroactive guest-stat claiming, invitation push, Cup time overrides, public read-only view.

## 2. Release 1.1 — Templates

From ROADMAP Priority 2. Rule, time, tournament, court and participant templates, official standard templates, reuse-last-setup/favourites/archive.

Why here: every later feature (league seasons, scheduled tournaments, recurring events) needs a saved "setup". Building it now means 2.0 and 3.0 reuse it instead of inventing their own.

## 3. Release 1.2 — More formats and a player-first UI

- **Server-wire the hidden formats one at a time:** Americano, Team-Americano, Mexicano, Team-Mexicano, King of the Court, Groups+Playoffs. Each needs a branch in `admin_advance_round_impl` and an end-to-end check like Round Robin had.
- **Styring redesign:** hide settings that cannot change in the current state.
- **Player-first UI:** "Min neste kamp" and "Mine kamper" first.

Why before 2.0: Americano/Mexicano are rotating-partner formats. Wiring them server-side builds the same pieces the League generator needs: a round generator called from the server, partner/opponent history, sit-outs.

## 4. Release 1.3 — Organiser tools

- PDF export of standings/results.
- **Tournament Assistant** (rule-based, no AI): stuck court, missing result, playtime imbalance, repeated partners, estimated finish time. Shares the fairness metrics with the League generator.

Moved out of 1.3 (to avoid doing them twice):
- *Rating/Elo* → 4.x Phase E (master plan §48 says research and simulate first).
- *Club/venue entity* and *recurring league automation* → 4.x Phases B/C.
- *Leagues & seasons* → 2.0 League.

## 5. Release 1.4 — Administration and safety

- `admin.html` as the real Systemeier/superuser surface; superusers, permission sets.
- MFA step-up and recovery codes; secure guest-device transfer.
- Player result-error reports / admin cases (D67–D71) if not already covered.
- Owner global theme management, then scheduled seasonal themes.
- Small extras: sponsor/prize display (no payments), photo per match.

Moved out of 1.4:
- *Calendar/.ics export and reminders for scheduled tournaments* → 3.0 (there are no scheduled tournaments before 3.0).
- *Organizer analytics dashboard* → 4.x Phase D.

Why before 2.0: the master plan §59 requires identity, authorization and entitlement to be separate. Superusers and permission sets set up the authorization layer before leagues introduce league admins.

## 6. Release 1.5 — Match-model foundation + languages part 1

- **Standalone scoring engine** (ROADMAP Priority 3): `app/scoring-engine.js` decoupled from padel specifics. Make **"Timed Points"** and **"Games/Sets/Match"** two scoring formats of one match model (League scope §20–21). This is the foundation League 2.0 sits on.
- **Serve rotation per player** in the scoring engine (League scope §2.1 serve order). Today Big Score only shows the serving *team*.
- Languages part 1: French, German, Spanish, Nynorsk, Dutch, Portuguese (finishes the hidden languages too).

---

## 7. Release 2.0 — League & Social

Full scope: `docs/future_development/PADELSTAR – Version 2.0 League & Social Scope.md`. Build plan: `league-v2-implementation-plan.md` (steps A–H).

**League**
1. Fairness generator (pure, simulation-tested for 4–12 players and 1–3 courts).
2. Big Score league mode: 5-minute default, golden point, server indicator with `assets/brand/padelstar-ball.png`.
3. Database: leagues, seasons (explicit start/end dates, presets), league players, sessions, matches. Standings and history are computed from results.
4. Create league/season wizard (uses 1.1 templates).
5. League session: attendance → session tournament with format `league` → rounds, sit-outs, referees (auto + manual).
6. Standings, player statistics, match history, player "next match" view.

**Social core** (ROADMAP Priority 4 + League scope §26)
- Player dashboard as the personal home: next match, avatar, status message.
- Friend requests, mutual and private friend lists, friend status, friend-based invitations.
- Player profiles and an activity feed that league results flow into.

## 8. Release 2.1 — Rivalries, achievements, sharing

- Head-to-head and rivalries across all shared tournaments and leagues.
- **Partner statistics** (together/against). Pulled forward from 4.x Phase A (master plan §35) because League 2.0 already records partner and opponent history.
- Achievements/badges, secondary to real statistics.
- Optional public statistics and social sharing (needs the pending product decision).
- Languages part 2: Polish, Sami, Arabic, Chinese, Japanese, Turkish, Russian.

## 9. Release 2.2+ — League extensions (only when 2.0 is proven)

From League scope §28: Games/Sets in league matches (the 1.5 match model makes this a configuration), divisions, promotion/relegation, playoffs/finals, cross-club leagues, advanced league rankings. None of these are required for 2.0.

---

## 10. Release 3.0 — Scheduled tournaments & payments

Master plan Part II. New lifecycle **PLAN → PUBLISH → REGISTER → SETTLE COSTS → PAY → LOBBY → PLAY → COMPLETE**, with the existing tournament engine untouched underneath.

Build order inside 3.0:
1. **Registration engine:** scheduled vs immediate tournaments, server-validated lifecycle states, registration states with history, capacity, waiting list, binding deadline (3 Norwegian business days, public holidays included), court-booking deadline (14 days, configurable), admin exceptions with an audit log.
2. **Attendance** on the day (self-report and admin), warnings for unresolved players.
3. **Payment engine (provider-independent):** individual expense records with an explicit "paid by", distribution rules, net settlement, transaction ledger (never `paid = true`), additional expenses after payment.
4. **Vipps MobilePay** payments (create, status, webhooks, cancel, refund) and **Vipps Login** (create, sign in, link to an existing account without duplicates).
5. **Notifications** for invitations, waiting list, deadlines, payment requests and reminders, cancellation, lobby open.
6. **Calendar/.ics export and reminders** (moved here from 1.4).
7. Invitations from friends and previous participants (builds on 2.0 social). An invitation never creates an obligation.

Done when the master plan §31 flow works end to end, from "Schedule tournament" to "Archive".

## 11. Releases 3.1 / 3.2 — More payment providers

Research first (master plan §26): PayPal, Stripe/card, regional providers, compared on countries, fees, KYC, payouts, webhooks and refunds. Possible order: PayPal 3.1, Stripe/card 3.2, then more currencies and multiple providers. These are not fixed commitments.

---

## 12. Generation 4.x — Community, clubs & commercial

Master plan Part III, in its recommended order. Each phase may span one or more 4.x releases.

| Phase | Content | Notes |
|---|---|---|
| **A** | QR check-in, equipment requests (as individual expenses), social tournament context ("5 of your friends are playing"), **Entitlement engine foundation** | Partner statistics already shipped in 2.1 |
| **B** | Recurring events (this / this-and-future / series), **venue system** (courts, notes, history), player availability, "find a player", first premium access | Absorbs ROADMAP 1.3 "club/venue" and "recurring league automation" |
| **C** | Groups/clubs (OWNER/ADMIN/MEMBER), group admin, **season series** of tournaments with season standings, achievements per group, club entitlements | Reuses the 2.0 season model. A 2.0 league season (one league, many sessions) and a 4.x season series (many tournaments) share dates, standings and history code |
| **D** | Public tournament pages, shareable live links, **Live Tournament Hub** (TV mode grown up), advanced statistics, **organizer analytics** | Absorbs ROADMAP Phase 19 public view if not done in 1.0.x, and 1.4 organizer analytics |
| **E** | Rating research → implementation (Elo/Glicko/doubles models, simulated first), ranking contexts, balanced teams, smart match generation | Absorbs ROADMAP 1.3 "Rating/Elo". Smart match generation extends the 2.0 fairness generator with skill balance |
| **F** | Annual player summary, shareable annual cards | |
| **G** | Venue/booking integrations, expanded clubs, reusable Zigonia modules | |

**Commercial** (master plan Part IV), introduced across 4.x:
- Platform payment stays fully separate from tournament payment (§55, §74).
- Entitlements via `can_use(...)`, never `if user.is_pro` (§58); Systemeier has all entitlements but still owes tournament costs (§56).
- Full-access and temporary grants, audit logged (§57).
- Measure infrastructure cost per player/organiser/tournament/club before pricing (§62). Classify each feature `CORE_FREE` / `PLAYER_PREMIUM` / `ORGANIZER_PREMIUM` / `CLUB_PREMIUM`, launching as beta/promotional access first (§63).

---

## 13. Always-on backlog (no fixed release)

- Permanent tamper-protected security audit log. Needed by 3.0 at the latest, because admin exceptions and payments must be audit logged.
- Broader public template ecosystem / template marketplace in `admin.html`. Best after 4.x entitlements.
- Debugging passes after each release (each ROADMAP priority ends with one).

## 14. Where the sources disagreed, and what this plan chose

| Topic | Before | This plan | Why |
|---|---|---|---|
| League | ROADMAP v1.2 (format) and v1.3 (seasons) | **2.0**, with Social | Developer's v2 League scope, 2026-10-05 |
| Seasons | ROADMAP v1.3; master plan v4 | League seasons **2.0**; tournament season series **4.x C**, on the same model | Avoid two season systems |
| Rating/Elo | ROADMAP v1.3 | **4.x E** | Master plan requires research and simulation first |
| Club/venue, recurring | ROADMAP v1.3 | **4.x B/C** | The master plan has the fuller design |
| Calendar/.ics | ROADMAP v1.4 | **3.0** | Needs scheduled tournaments |
| Organizer analytics | ROADMAP v1.4 | **4.x D** | Grouped with live hub and statistics |
| Partner statistics | Master plan 4.x A | **2.1** | League 2.0 already records the data |
| Scoring engine | ROADMAP 1.5, "other sports" | **1.5**, also as the League match model | League needs Timed Points and Games/Sets on one model |

## 15. Decisions the developer needs to make

1. ~~Accept this file as the overview?~~ Decided 2026-10-05: this file is the definitive plan and steers development; `ROADMAP.md` keeps the detailed checkboxes.
2. Is 1.1–1.5 before League the right order, or should League 2.0 start right after 1.0.x? (The cost of starting early: the 1.5 match model and the 1.2 server-side generators would be built inside the League work.)
3. Pending product decisions already in ROADMAP: retroactive guest-stat claiming, post-finish corrections scope, invitation push, Cup time overrides, public read-only view, public statistics sharing.
4. League open questions (plan §7): guests in leagues, a court without a free referee, golden-point wins worth 3 points, who may create leagues.
5. 3.0 needs a Vipps merchant agreement and test environment. Start that application early; it takes calendar time, not code time.
