# AGENTS.md

## Padelstar – working rules for coding agents (Claude, Codex)

`CLAUDE.md` and `AGENTS.md` are identical; change both together.

The primary goal is useful implementation per token.

## The plan

`docs/MASTER-ROADMAP.md` is the governing plan (developer's decision 2026-10-05). It decides what is built, in which release and in what order. `docs/ROADMAP.md` holds the detailed checkboxes for the release being worked on.

- Work on the current stage of the master roadmap unless the developer explicitly asks for something else. The current stage is named in `docs/PROJECT.md` "Current state".
- When the developer asks for work the master roadmap does not have, or moves something, record it in the master roadmap in the same session.
- Never break the critical path in `docs/PROJECT.md` (account → log in → create Round Robin → start → results → server persistence → finish → create another tournament).

## Documentation system (every session)

Five files describe the app's current state. They are kept current by every session that changes code, data, configuration or a decision, as part of the same branch or PR, not as a later cleanup.

| File | Holds | Update when |
|---|---|---|
| `docs/CHANGELOG.md` | Verified changes, newest first; work not yet versioned under **Unreleased** | You changed behaviour, fixed a bug, applied a migration or changed live configuration |
| `docs/BUGS.md` | Only active defects and known limitations | You found a bug (add it) or fixed one (delete it; the fix goes in the CHANGELOG) |
| `docs/PROJECT.md` | Current state (version, what is live, open PRs, current roadmap stage) and approved product behaviour | Anything in "Current state" changed, or the developer decided product behaviour |
| `docs/USER_ACTIONS.md` | What only the developer can do, verify or decide | You need a decision, a secret, a real-device check or a review; or one was done (tick it, move it to "Done") |
| `docs/MASTER-ROADMAP.md` | The plan, 1.0.x to 4.x | The developer added, moved or dropped planned work, or a release stage finished |

Before ending a session (or before the last push of a PR):

1. Re-read the five files' sections your work touched and make them true for the state after your change.
2. Set "Last updated: YYYY-MM-DD" at the top of every file you changed.
3. Tick finished boxes in `docs/ROADMAP.md` with a one-line evidence note.
4. Say in your report which of the files you updated, or "docs: no change needed" and why.

Rules: write what is true now, not a diary; record dates as absolute dates; a merged PR moves from "Open pull requests" in PROJECT.md to the CHANGELOG; never put secrets in these files. `docs/technical/*` is updated when a technical contract changes. `docs/archive/` is history only; do not update it.

## Workflow

For each task:

1. Inspect only the files needed for the current blocker.
2. Reproduce or verify the current behavior.
3. Make the smallest safe change.
4. Test immediately.
5. Update the documentation system above.
6. Continue to the next blocker.

Do not stop after analysis if enough information exists to implement.

## Scope control

Do not by default:

- scan the entire repository;
- read all documentation;
- inspect unrelated modules;
- re-read files already understood;
- do speculative architecture analysis;
- refactor unrelated code;
- read `docs/archive/`;
- start a later roadmap stage while the current one has open blockers, unless the developer asks.

Expand scope only when a concrete dependency requires it.

## Source hierarchy

1. Current explicit developer instruction.
2. `docs/MASTER-ROADMAP.md` (what to build and when).
3. `docs/PROJECT.md` (current state and approved behaviour).
4. `docs/BUGS.md`.
5. `docs/ROADMAP.md` (detailed checkboxes).
6. Relevant `docs/technical/*`.
7. Current code for implementation details.
8. `docs/archive/` only if historical information is explicitly needed.

## UI

The current implemented UI is the design authority (the Padelstar 1.0 redesign: `styles/tokens.css`, `styles/redesign.css`, motion in `docs/technical/motion.md`). Match existing typography, spacing, colors, cards, buttons, modals, navigation and responsive behavior.

## Release scope

Round Robin and Cup are the live tournament modes. League (ligaspill) is release 2.0 with Social; other formats are server-wired in 1.2 (see the master roadmap). Other existing modes must not be deleted merely because they are not currently exposed.

## Data and security

- Account is not required for general guest tournament use; account ownership and history are supported.
- Shared tournament state uses the backend/Supabase.
- Security-sensitive permissions must be enforced backend/database-side.
- Stable IDs, not display names, are identity keys.
- Do not introduce unsafe shortcuts to meet a deadline.

## Testing

Test proportionally. Start narrow and expand only when required (`npm test`, `npm run check:syntax`). For changes on the critical path, verify the full flow end-to-end, including refresh/reopen/server persistence.

## Reporting

Keep reports short:

- changed;
- tests run;
- result;
- docs updated;
- blocker, if any.

Prefer implementation over commentary.

## Versioning

The actual current baseline is **`1.0.0`** (released 2026-10-05 on the developer's explicit instruction: the Padelstar 1.0 redesign). Earlier versions are listed in `docs/CHANGELOG.md`.

Version numbers represent **completed and verified milestones**, not planned work. Target versions are in `docs/MASTER-ROADMAP.md`.

- `1.0.1`, `1.0.2`, etc. — coherent verified bug-fix batches.
- later `1.x` minor versions — coherent new verified feature milestones, in master roadmap order.
- `2.0.0` and later majors — only for a decided, verified major release.

**Agents must never change the application version automatically.**

When a coherent milestone has been fully implemented and verified, recommend a next version with a brief reason, for example:

`Version recommendation: 1.0.1 — the verified bug-fix batch for large Round Robin and the claim revision bug.`

The developer decides whether to apply it. Do not recommend a bump merely because code changed, a date was reached, or a version string already appears in the UI.

## Final rule

**Fix the next real blocker first, then leave the docs true.**
