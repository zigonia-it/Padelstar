# BUGS.md

# Padelstar – Active Bugs

Last updated: 2026-10-05 (version 1.0.0 on padelstar.app).

Only **active** defects and known limitations are listed here. When a bug is fixed, delete it from this file and describe the fix in `docs/CHANGELOG.md` (that is the record). Every work session adds new bugs it finds and removes the ones it fixed (see "Documentation system" in `CLAUDE.md` / `AGENTS.md`). Everything found and fixed up to 2026-09-19 (account creation, tournament start, results, persistence, completion, Cup, guest claiming, realtime, undo, PWA icons, ...) is in `docs/archive/bugs-resolved-2026-09.md` (not authoritative).

## Bug completion rule

A bug is complete only when it was reproduced or clearly verified, the smallest safe fix is in, the relevant behaviour was tested, the critical path (create account → log in → create Round Robin → start → register results → persist to Supabase → complete → create a new tournament) was re-checked, and the status was updated. Do not spend time on long bug analysis documents.

## Active defects

- [ ] **A Round Robin with many players cannot be created** (found 2026-10-05). With 40 players the plan was about 10 MB, so creating failed silently (browser storage full) and starting would have passed the server's state limit. Fix in **PR #44** (`fix/create-large-tournament`, open): above 8 players each team plays one match per rotation against a neighbouring team, and the saved schedule refers to players by id. The server half is already live: migration `20261005153000_tournament_state_2mb.sql` raised the state limit to 2 MB on the production database. Until #44 is merged, `main` and padelstar.app still have the bug.
- [ ] **Claiming a name already on the roster does not raise the revision** (found 0.17.1), so the admin's next save overwrites the claimed player's `userId`/`guest` markers in the state. Access is unaffected (the account link lives in `tournament_account_players`). To be fixed server-side.
- [ ] **Unconfirmed, not reproduced (2026-09-26):** on padelstar.app, right after a page reload, clicking "Fullfør turnering" and confirming from a script closed the dialog but the tournament stayed `Runde pågår` on the client and the server; the same steps with real clicks a minute later finished it normally. Possibly the admin session was not yet restored after the reload. If a person sees "finish does nothing" after a reload, note the exact steps here.
- [ ] **Editor formatting breaks tests**: a code formatter that reformats `index.html` on save changes the exact markup that some tests check (found 2026-09-20). Turn format-on-save off for that file; if `git diff index.html` is huge, restore the file and re-apply only the intended change.

## Known limitations (decided or accepted, not bugs to fix now)

- Two players with exactly the same name cannot be told apart by the claim flow; only the first match in the roster is reachable. Names are the only key the claim flow has.
- When players on **both** teams of one Round Robin match have withdrawn, the match is cancelled (no rule was given for it). In a Cup a cancelled match makes the best-placed losing team take the place (0.13.0).
- Corrections after the tournament is finished (built 0.10.0): only for finished, not cancelled tournaments, only by the admin, and a Cup result that later matches depend on stays blocked. Guests: the correction window ends when the 24-hour retention deletes the tournament.
- Invitation emails (built 0.10.0) are limited to 3 per address and tournament per hour and 40 per tournament; if the email fails the invitation is still saved and the admin gives the person the code.
- The hidden languages (nn, es, de, fr, sv, da) still have old privacy/guide text; they are not offered until Phase 21 completes them.
- Colour (1.0.0): the contrast audit found 0 failures on seven screens in both themes (Daylight, Floodlight). The theme layer uses `color-mix()` and `light-dark()`; browsers older than iOS 16.2 / Chrome 111 lose the tinted washes.
- Padelstar has no in-app sounds since 1.0.0 (developer's decision); the browser's or phone's own notifications carry the sound. Vibration does not exist for web pages on iPhone.
- Login on Vercel preview addresses fails at the "I'm not a robot" check: the Turnstile widget allows only padelstar.app. Production is unaffected.
- Not yet verified by a person on real devices: push notifications on a phone, network loss during a running match, invitations and withdrawal with two real accounts/devices (see `docs/USER_ACTIONS.md`).
