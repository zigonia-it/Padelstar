# USER ACTIONS / CONFIRMATIONS REQUIRED

Things only the developer can do or decide. Every work session updates this file before it ends: new items are added, finished ones are ticked and moved to "Done" (see "Documentation system" in `CLAUDE.md` / `AGENTS.md`). Order = recommended order.

Last updated: 2026-10-12 (version 1.0.1 on padelstar.app).
Status: `[ ]` open, `[x]` done.

## 1. Decide or review now

- [ ] **New icon and logo** (2026-10-12, PR #ICONPR): after the merge, check padelstar.app in Daylight (new black wordmark with the ball) and the tab icon. Supply the **dark-surface logo** when ready (it replaces `assets/brand/padelstar-logo-light.webp`). An installed app on a phone keeps its old home-screen icon until it is removed and added again; Vercel's project avatar follows the newest production deployment's favicon.
- [ ] **System → Turneringer** (1.0.1, PR #54): check the new Kode and Konto columns, the walkover question naming the winner, and that Slett asks with the tournament's details.
- [ ] **Blocked-account guard with two devices** (1.0.1, PR #53). With a second test account: block it in System → Brukere while it is signed in on another device; on that device any action that needs the account fails at once and, after a reload, it shows "Du er logget ut fordi økten ble avsluttet"; signing in shows "Kontoen er sperret". Unblock and sign in again.
- [ ] **Try the start clock on your phone** once it is live: create a Round Robin with "Tidsbegrenset kamp" set (e.g. 5 minutes), check that the + buttons and Før poeng are disabled, press Start klokken on the match card or on the player's own match, then score; check that the countdown runs on the card and on the TV board.
- [ ] **Try "Nullstill turnering" on your phone** once the fix is live, on an account tournament: it must go back to Hjem and the tournament must not reappear under "Dine turneringer" after a reload. A copy that came back before the fix can be removed with Nullstill turnering too.
- [ ] **Review PR #46** (League v2.0 plan and `docs/MASTER-ROADMAP.md`). The master roadmap is the governing plan (developer's decision 2026-10-05); merging #46 puts it in the repo.
- [ ] **Master roadmap decisions** (`docs/MASTER-ROADMAP.md` §15):
  1. Should League 2.0 start right after 1.0.x, or after 1.1–1.5 as planned?
  2. Pending product decisions: retroactive guest-stat claiming, post-finish corrections scope, invitation push, Cup time overrides, public read-only view, public statistics sharing.
  3. League open questions (league plan §7): guests in leagues, a court without a free referee, golden-point wins worth 3 points, who may create leagues.
  4. Start the Vipps merchant agreement and test environment early (needed for 3.0; it takes calendar time, not code time).
- [ ] **Privacy page "beta text" line.** `privacy.html` still says (nb): "Dette er fortsatt en beta-tekst og bør kvalitetssikres av behandlingsansvarlig før bred bruk." You are the data controller: read the privacy text, then tell Claude to remove the sentence (or what to change). The nn/es/de/fr/sv/da versions are older than nb/en and stay hidden until they are updated.
- [ ] **Email sending (invitations and feedback) — "Gi tilbakemelding" still fails (2026-10-12).** The form itself works (checked in a browser: validation, sending, the thanks message and the email fallback); what fails is the server sending the email, which needs Vercel settings Claude cannot read. Most likely `RESEND_API_KEY` is still missing in Vercel Production (the 2026-09-20 cleanup removed "unused Resend keys"). Vercel → the Padelstar project → Settings → Environment Variables: check `RESEND_API_KEY` and `FEEDBACK_TO_EMAIL` exist for **Production** (delete `FEEDBACK_FROM` unless it is an address at padelstar.app) → redeploy → send yourself a feedback message. If it still fails, the message in the dialog tells which case it is (`docs/technical/feedback-setup.md`, "Troubleshooting").

## 2. Verify as a person (Claude cannot sign in or use real devices)

One structured field test with two accounts and two phones covers most of these (master roadmap §1, "live verification debt").

- [ ] **Guide and privacy popups on your phone (fixed in 1.0.0).** Open padelstar.app on the phone that showed a blank or a full page, reload once (close and reopen if installed), press Personvern and Bruksanvisning: a popup with an X must open. Tell Claude the phone and browser if not.
- [ ] **Push notifications on a real phone (0.15).** Install padelstar.app (iPhone: Add to Home Screen), join a tournament as a player and switch notifications on. Profile → "Varsler": (a) all categories on: the admin starts a match / next round / corrects a result → a push arrives, with the phone's own sound; (b) "Kampen min er klar" off → no match/round pushes; (c) "Bare mine egne kamper" on → only your matches, a new round still arrives; (d) the admin withdraws your teammate → "Lagkameraten din har trukket seg", and the opponents get nothing.
- [ ] **Invitations with two real accounts.** Account A creates a tournament, lobby → "Inviter med e-post" → account B's email. B signs in → Profil → "Invitasjoner" → "Bli med" → A's list shows "Har blitt med". Also try "Avslå".
- [ ] **Withdrawal with two devices.** Start a Round Robin, withdraw one player on the admin device, then on the teammate's phone choose "Spill alene" / "Gi walkover".
- [ ] **Network loss during a running match.** Airplane mode for ~30 s while scoring, then back online: the queued points arrive, nothing lost or doubled.
- [ ] **Points mode (0.17).** Create a tournament with "Poeng (først til N)" (e.g. first to 21, win by 2), start and score a match: the table shows GAMES and POENG, 20-20 continues until a 2-point lead, "Set resultat" takes two numbers. Also best of 3 games and a timed match, and the point-by-point approval with a second player.
- [ ] **Motion on your phone (after 1.0.0).** The menu highlight slides, pages fly in, the winning point shows the win moment, the podium lands 3rd, 2nd, 1st, and standings rows slide to their new places when a result changes the order (app and TV board, PR #50). With "Reduce motion" on in the phone's settings nothing should move. Tell Claude anything that feels slow or wrong.
- [ ] **The new tournament menu on phone, tablet and computer (PR #56, merged 2026-10-12).** As admin: Lobby shows Del turnering, Spillere, Regler, Banekø in that order; Spillere puts the players on court first; Kamper starts with the current match; the fourth item says Cup and shows the bracket in a Cup. TV Mode must be missing on the phone and present on the tablet/computer. As a player on another phone: no admin menu, only I dag / Kamper / Tabell. Open the bell with one and with several notices and check the spacing.
- [ ] **Large Round Robin (1.0.1, PR #44).** Create a Round Robin with 20–40 players on padelstar.app, start it and play a few matches.

## 3. Later, when the time comes

- [ ] Supabase leaked-password protection needs the Pro plan (accepted for now).
- [ ] `assets/padelstar-webapp-ui-design/` (16 MB) is still in git history (removed from the tree in PR #8). Purging it means rewriting history; your decision.

## Done

- [x] Released 1.0.1 (2026-10-12): PR #53, #54, #44 and #50 merged with the earlier post-1.0.0 work.
- [x] Walkover / admin tournament delete merged (PR #54, 2026-10-12, in 1.0.1; migration applied 2026-10-12).
- [x] Blocked-account guard merged (PR #53, 2026-10-12, in 1.0.1; migration live since 2026-10-12).
- [x] Large Round Robin fix merged (PR #44, 2026-10-12, in 1.0.1).

Kept short for reference; details are in `docs/CHANGELOG.md` and git history.

- [x] Critical fixes PR #55 merged on the developer's "go" and migration `20261012090000_block_points_before_clock.sql` applied to Supabase (2026-10-12).
- [x] Timed-match start clock (PR #49) merged and its migration `20261010150000_match_clock_start_button.sql` applied to Supabase (2026-10-10, on the developer's "just fix it").

- [x] Feedback form address fixed; stray Vercel variable and unused Resend keys removed (2026-09-20).
- [x] Turnstile secret saved in Supabase; sign-ups without the check are refused (2026-09-20).
- [x] Unverified accounts deleted from 2026-09-28 (cron `padelstar-unverified-users`).
- [x] Two-factor for System set up and confirmed (2026-09-20).
- [x] Primary buttons, colours and light mode checked on your devices (0.9–0.15).
- [x] Withdrawal in a real Cup, the merged lobby, the System owner page, claiming a pre-added slot, 0.9.1/0.9.2/0.10 fixes: checked on real devices.
- [x] Install on Windows/Linux accepted as confirmed.
- [x] Decisions: withdrawal in a Cup, best-placed loser rule, corrections after finish, email invitations, privacy services section, TV button on phones, lobby in the workspace, system administration scope, push categories, one result flow (point-by-point), scoring engine (7 decisions), best of 3 default.
- [x] 1.0.0 released (2026-10-05): "merge this into the live webapp and publish as version 1.0.0".
- [x] No in-app notification sounds (2026-10-05).
- [x] Round Robin rounds start the next one by themselves (2026-10-05).
- [x] Large Round Robin rule: all teams meet up to 8 players; above that one match per rotation; server state limit 2 MB (2026-10-05, PR #44).
- [x] `docs/MASTER-ROADMAP.md` is the governing plan (2026-10-05).
