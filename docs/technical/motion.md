# Motion

Padelstar 1.0 motion spec (2026-10-05). The tokens live in `styles/tokens.css` (MOTION TOKENS) and are tested by
`test/motion-tokens.test.js`. This file says where motion goes, how it behaves, and what it must never do.

## Principles

The design system is "calm and editorial off court, loud and simple on court". Motion follows the same split.

1. **Motion confirms or explains.** It shows that a tap landed, that a number changed, or where a row went. Nothing
   moves for decoration.
2. **On court, fast and sure.** Players tap with sweaty hands between points. Feedback starts on the press, finishes
   before the next tap, and never blocks input.
3. **One celebration per finish.** The win moment is the only motion that is allowed to be a little loud, and it
   happens once.
4. **Only `transform` and `opacity`.** No animated `width`, `height`, `top`, `box-shadow` or `filter`. Phones and the
   TV board stay at 60 fps.
5. **Nothing loops** except a live indicator (the live dot, the timer warning).
6. **Reduced motion is a first-class mode**, not an afterthought (see below).

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--motion-instant` | 80ms | press feedback on buttons and point pads |
| `--motion-quick` | 140ms | hover, toggles, colour and border changes, exits |
| `--motion-base` | 220ms | score digit tick, card or toast entering, view entering |
| `--motion-slow` | 360ms | standings reorder, sheets and dialogs, view transitions |
| `--motion-celebrate` | 640ms | the win moment |
| `--motion-pulse` | 1.6s | the live dot and timer warning (the only loops) |
| `--motion-stagger` | 40ms | delay between items entering in a list, at most 6 items |
| `--ease-standard` | `cubic-bezier(.2, 0, 0, 1)` | moving from A to B (reorder, slide) |
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` | arriving (enter, a score settling) |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` | leaving (exit, dismiss) |
| `--ease-pop` | `cubic-bezier(.34, 1.56, .64, 1)` | small overshoot, only for the score tick and the win moment |
| `--motion-distance-sm` | 6px | a view or card settling in |
| `--motion-distance-md` | 16px | a toast or sheet arriving |
| `--motion-scale-press` | .97 | a pressed button or point pad |
| `--motion-scale-pop` | 1.12 | the peak of a score digit tick |

Exits use `--motion-quick` with `--ease-in`: leaving is always faster than arriving.

### Reduced motion

Under `prefers-reduced-motion: reduce` the tokens themselves change: distances become `0px`, scales become `1`,
stagger becomes `0ms`, `--ease-pop` becomes `--ease-out` and the celebration shortens to `--motion-base`. A rule written
as `transform: translateY(var(--motion-distance-sm)) scale(var(--motion-scale-pop))` therefore turns into a plain
crossfade with no extra media query. Durations stay, so a state change still reads as a change. Loops (`--motion-pulse`)
must still be switched off with their own `animation: none` under the media query.

The app's catch-all in `styles/styles.css` (the `*` rule that sets every duration to 0.01ms) stays as a safety net.
`tv.html` does not load `styles.css`, so TV rules need their own reduced-motion block.

## Audit: what moves today

| Where | Today | Note |
| --- | --- | --- |
| Live dot, live tag, next-match dot (`redesign.css`) | `ps-pulse` 1.6s loop | fine; has reduced-motion off switch |
| Buttons (`redesign.css` line 36, `base.css`) | 120–160ms `ease` on transform/shadow/background | inconsistent timings; move to tokens |
| View change (`ui-consistency.css` `ui-module-enter`) | 180ms fade + 6px rise | fine; move to tokens |
| Toast (`styles.css` `.app-toast`) | 160ms fade + 10px rise | move to tokens |
| Podium (`podium.css`) | 0.5s pop, all places at once | add stagger 3rd, 2nd, 1st |
| Timer warning, app (`scorer-panel.css`) | 1s pulse loop | fine |
| Timer warning, TV (`tv.css` line 86) | references `tv-live-pulse` | **broken: that keyframe is never defined, so nothing moves**; also has no reduced-motion block |
| Score flash (`app/ui-effects.js` `flashMatchCards`) | adds `.score-flash` for 520ms | **dead: no CSS rule for `.score-flash` exists** |
| Scorepad (`app/large-score.js`) | whole board re-rendered via `innerHTML` on each point | no feedback beyond the number swapping |
| Standings (`app/standings.js`) | list cleared and rebuilt on each render | rows jump to new places |
| Dialogs and sheets | appear instantly | no enter or exit |
| Theme switch | instant | fine; leave it instant |

## Where motion helps most (in order)

### 1. Scorepad point tap (on court, highest value)
- **Press:** the team pad scales to `--motion-scale-press` over `--motion-instant`, and back on release.
- **Score tick:** the number that changed scales `1 → --motion-scale-pop → 1` over `--motion-base` with `--ease-pop`.
  Only the changed number moves, not the whole pad.
- **Game or set won:** the games line under the pads gets the same tick; the point label resets with a crossfade.
- **Undo:** the reverted number ticks the same way (direction does not matter; it says "this changed").
- **How:** `large-score.js` rebuilds the board with `innerHTML`, so compare the previous and new values per team
  before rendering and add a class (for example `is-ticking`) to the changed element after insertion. Wire the
  existing `.score-flash` hook from `flashMatchCards` to the same tick on match cards.

### 2. Match finished (the win moment)
- Winning team's row or pad gets a ball-yellow wash that sweeps in over `--motion-celebrate` with `--ease-out`, the
  final score ticks once with `--ease-pop`, and the "awaiting approval" state crossfades in after it.
- Podium places enter staggered (3rd, 2nd, then 1st) with `--motion-stagger` steps scaled up to 120ms, so 1st lands
  last.
- No confetti, no sound (developer decision: no in-app sounds), nothing that loops.

### 3. Standings reorder
- When a result changes the order, rows slide to their new places with FLIP: record each row's top before render,
  render, then animate `translateY(old - new) → 0` over `--motion-slow` with `--ease-standard`. Key rows by player id.
- A row that moved up gets a brief `--ball-wash` background fade (`--motion-slow`) so the eye finds it.
- Points that changed tick like the scorepad.
- Same on the TV board, where it matters most: people watch it from across the hall.

### 4. Screen and tab changes
- Keep the current enter (fade + `--motion-distance-sm` rise) and move it onto `--motion-base` / `--ease-out`.
- Where the browser supports it, wrap workspace tab switches in `document.startViewTransition` with a crossfade of
  `--motion-base`; without support it falls back to today's enter animation. Do not slide whole screens sideways.
- Player tab bar: the active indicator slides between tabs over `--motion-base` with `--ease-standard`.

### 5. Dialogs, sheets and toasts
- Dialogs: fade + `--motion-distance-md` rise, `--motion-slow`, `--ease-out`; backdrop fades over `--motion-base`.
  Exit at `--motion-quick` with `--ease-in`. Use `@starting-style` and `transition-behavior: allow-discrete` on
  `dialog[open]`; older browsers simply open instantly.
- Phone menu sheet: drops from under the nav pill with the same timings.
- Toast: move onto `--motion-base` / `--motion-distance-md`.

### 6. Small polish
- Buttons, chips and inputs: all colour and border changes on `--motion-quick` with `--ease-standard`.
- Fix the TV timer warning (define its keyframe, or reuse `ps-pulse` with `--motion-pulse`) and give `tv-redesign.css`
  a reduced-motion block.

## Rules for implementers
- Always use the tokens. No raw `ms` or `ease` in new rules.
- Never delay a tap's effect: state updates first, animation decorates it.
- Animate `transform` and `opacity` only; add `will-change` only while an animation runs.
- Do not animate during the first render of a screen (data arriving from Supabase is not a "change"), only on updates
  that follow a user action or a realtime update.
- Test both themes, 390px phone, 1440px desktop and the TV board, with reduced motion on and off.

## Built so far (2026-10-05)
- **Menu highlight** (`app/nav-indicator.js`, `styles/motion.css` section 1): one pill per menu (top menu, desktop rail,
  admin tab bar, player tab bar) slides to the active item over `--motion-base`; the items' ink changes with it.
- **Panels fly out and in** (`app/view-motion.js`, section 2): menu and rail clicks run through `navigate()`. With the
  View Transitions API, cards only on the old page fly out (`--motion-quick`), cards only on the new page fly in one
  after another (`--motion-base`, 90ms after the exit starts, `--motion-stagger` apart, at most 4 steps), and a card on
  both glides. The top bar and tab bars stay above the cards. Without the API the new cards still fly in.
- **Big score**: the tapped number ticks (`--ease-pop`), the pad presses in, and match cards get a short ball wash
  (`.score-flash`, which had no CSS before). Each point now paints the big score first; saving and redrawing the rest
  follow after the frame, shared by a quick run of points while the big score is open (flushed on close and page hide).
  Measured at 4x CPU slowdown: 240ms to 35ms from tap to the new number.
- **Win moment** (`app/large-score.js` celebrateWin, `styles/motion.css` sections 3 and 4): the point that wins a match
  keeps the big score up for `--motion-celebrate` plus half a second. The winner's pad shows the final games, says
  "Winner" and gets a sweep of its own colour; the other pad steps back; then the big score closes by itself. The match
  card gets a ball-yellow sweep, its score ticks once and the status and winner note settle in (when the card is on
  screen). Reduced motion: no sweep or tick, the wash fades and the hold is shorter.
- **Podium**: places land 3rd, 2nd, then 1st, three `--motion-stagger` steps apart, with `--ease-pop`.
- **Standings reorder** (`app/list-reorder.js`, `styles/motion.css` section 5, `styles/tv-redesign.css`): when a result
  changes the order, rows slide from their old place to the new one over `--motion-slow` (FLIP, keyed by player id), in
  the app and on the TV board. A row that climbed is lifted above the rows it passes and gets a short ball wash (stronger
  on the TV); a points value that changed ticks once. Nothing moves on a list's first paint or while it is hidden.
  Reduced motion: rows jump, the wash still fades.
- Navigation is the one place where the old view leaves before the new one is shown; it never waits more than
  `--motion-quick` and the menu highlight moves at once.

## Plan
1. Tokens and this spec (done).
2. Scoring and results motion: scorepad press and tick, `.score-flash`, the win moment, podium stagger (done).
3. Standings and navigation motion: FLIP reorder (app and TV, done), view transitions and tab indicator (done), dialogs and sheets.
4. Polish: move existing transitions onto tokens, fix the TV timer pulse, performance pass on phones and the TV board.
