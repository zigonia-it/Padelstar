# USER ACTIONS / CONFIRMATIONS REQUIRED

Things only the developer can do or decide. Every work session updates this file before it ends: new items are added, finished ones are ticked and moved to "Done" (see "Documentation system" in `CLAUDE.md` / `AGENTS.md`). Order = recommended order.

Last updated: 2026-10-10 (version 1.0.0 on padelstar.app).
Status: `[ ]` open, `[x]` done.

## 1. Decide or review now

- [ ] **Try the start clock on your phone** once it is live: create a Round Robin with "Tidsbegrenset kamp" set (e.g. 5 minutes), score a point (the clock stays at 5:00), press Start klokken on the match card or on the player's own match, and check that the countdown runs on the card and on the TV board.
- [ ] **Review and merge PR #44** (large Round Robin can be created; above 8 players each team plays one match per rotation). Until it is merged, a Round Robin with many players fails on padelstar.app (`docs/BUGS.md`). The 2 MB server limit it relies on is already live.
- [ ] **Review PR #51** (League step B: Big Score shows the ball, the serving player and the side). Decide: show it in every mode (as built; each team's first listed player is assumed to serve first) or only in League. Try it on your phone via the Vercel preview of the PR.
- [ ] **Master roadmap decisions** (`docs/MASTER-ROADMAP.md` §15):
  1. Should League 2.0 start right after 1.0.x, or after 1.1–1.5 as planned?
  2. Pending product decisions: retroactive guest-stat claiming, post-finish corrections scope, invitation push, Cup time overrides, public read-only view, public statistics sharing.
  3. League open questions (league plan §7): guests in leagues, a court without a free referee, golden-point wins worth 3 points, who may create leagues.
  4. Start the Vipps merchant agreement and test environment early (needed for 3.0; it takes calendar time, not code time).
- [ ] **Privacy page "beta text" line.** `privacy.html` still says (nb): "Dette er fortsatt en beta-tekst og bør kvalitetssikres av behandlingsansvarlig før bred bruk." You are the data controller: read the privacy text, then tell Claude to remove the sentence (or what to change). The nn/es/de/fr/sv/da versions are older than nb/en and stay hidden until they are updated.
- [ ] **Email sending (invitations and feedback).** At 0.17.3 `RESEND_API_KEY` was missing in Vercel Production, so `/api/invitation-email` answered `notConfigured` and the feedback button could not send. If you have not done it yet: Vercel → the Padelstar project → Settings → Environment Variables → add `RESEND_API_KEY` (Production) → redeploy. Then send yourself a feedback message from padelstar.app.

## 2. Verify as a person (Claude cannot sign in or use real devices)

One structured field test with two accounts and two phones covers most of these (master roadmap §1, "live verification debt").

- [ ] **Guide and privacy popups on your phone (fixed in 1.0.0).** Open padelstar.app on the phone that showed a blank or a full page, reload once (close and reopen if installed), press Personvern and Bruksanvisning: a popup with an X must open. Tell Claude the phone and browser if not.
- [ ] **Push notifications on a real phone (0.15).** Install padelstar.app (iPhone: Add to Home Screen), join a tournament as a player and switch notifications on. Profile → "Varsler": (a) all categories on: the admin starts a match / next round / corrects a result → a push arrives, with the phone's own sound; (b) "Kampen min er klar" off → no match/round pushes; (c) "Bare mine egne kamper" on → only your matches, a new round still arrives; (d) the admin withdraws your teammate → "Lagkameraten din har trukket seg", and the opponents get nothing.
- [ ] **Invitations with two real accounts.** Account A creates a tournament, lobby → "Inviter med e-post" → account B's email. B signs in → Profil → "Invitasjoner" → "Bli med" → A's list shows "Har blitt med". Also try "Avslå".
- [ ] **Withdrawal with two devices.** Start a Round Robin, withdraw one player on the admin device, then on the teammate's phone choose "Spill alene" / "Gi walkover".
- [ ] **Network loss during a running match.** Airplane mode for ~30 s while scoring, then back online: the queued points arrive, nothing lost or doubled.
- [ ] **Points mode (0.17).** Create a tournament with "Poeng (først til N)" (e.g. first to 21, win by 2), start and score a match: the table shows GAMES and POENG, 20-20 continues until a 2-point lead, "Set resultat" takes two numbers. Also best of 3 games and a timed match, and the point-by-point approval with a second player.
- [ ] **Motion on your phone (after 1.0.0).** The menu highlight slides, pages fly in, the winning point shows the win moment, the podium lands 3rd, 2nd, 1st. With "Reduce motion" on in the phone's settings nothing should move. Tell Claude anything that feels slow or wrong.
- [ ] **Large Round Robin after PR #44 is merged.** Create a Round Robin with 20–40 players on padelstar.app, start it and play a few matches.

## 3. Later, when the time comes

- [ ] Supabase leaked-password protection needs the Pro plan (accepted for now).
- [ ] `assets/padelstar-webapp-ui-design/` (16 MB) is still in git history (removed from the tree in PR #8). Purging it means rewriting history; your decision.

## Done

Kept short for reference; details are in `docs/CHANGELOG.md` and git history.

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
