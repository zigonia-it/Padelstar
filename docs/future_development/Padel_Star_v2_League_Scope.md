# Padel Star v2 — League & Social Scope

**Status:** Product scope / implementation planning  
**Version target:** Padel Star v2.0  
**Primary focus:** League functionality + planned social functionality  
**Future extension:** Advanced Game / Set / Match scoring

---

## 1. Vision

Padel Star v2 expands the existing tournament platform with a **season-based individual league system** and the planned social features.

The league is an **individual 2v2 competition**. Players earn individual league points based on the results of short matches. Teams are dynamically created for each match rather than being permanent teams.

The system should create balanced and varied play over time while remaining practical when attendance, court availability, and player participation change.

### Core principle

> **Fairness and equal playing time are hard requirements. Partner and opponent variety are optimization goals, not hard constraints.**

---

# 2. V2 Scope

## 2.1 League

### Season management
- Create a league.
- Create/manage seasons.
- Support:
  - 1 month
  - 3 months
  - 6 months
  - 12 months
  - Custom date range
- Support fixed seasonal periods such as:
  - 1 January → 30 June
  - 1 July → 31 December
- Season start and end dates must be explicitly stored.
- Do not hard-code seasons as a simple number of days.

### League sessions
- A season consists of multiple sessions.
- Admin creates/starts a session.
- Admin records which registered players are present.
- The system generates the session schedule from the players present.
- Multiple courts can run matches simultaneously.
- Completed results update the league standings and historical balancing data.

### Match format
- 2v2.
- Points only.
- No games or sets in League v2.0.
- Match duration is configurable by the league admin.
- Default match duration: **5 minutes**.
- The configured duration should be stored with the league/season.
- Golden Point is used if the score is tied when time expires.

### Scoring
- Winning team:
  - 3 league points per player.
- Losing team:
  - 0 league points per player.
- The actual match score must also be stored.
- Match score can later be used for:
  - point difference
  - statistics
  - tie-breakers
  - player history.

### Serve system
Serve changes after two serves from a team.

For a team with players 1 and 2, and opponents 3 and 4:

1. Player 1 — right side
2. Player 1 — left side
3. Player 3 — right side
4. Player 3 — left side
5. Player 2 — right side
6. Player 2 — left side
7. Player 4 — right side
8. Player 4 — left side
9. Repeat

The active server must be visible in the UI.

Use the existing **Padel Star ball asset** from the project assets as the visual serve indicator.

Example:

`[Padel Star ball asset] Anna`

The serve indicator must update automatically after every point.

---

# 3. Equal Playing Time

This is the highest-priority fairness rule.

All players participating in a session should play the same number of matches during that session, as far as mathematically possible.

Example:

10 players, 2 courts:

- 8 players play.
- 2 players sit out.
- Next round should prioritize the players who sat out.

Example:

| Round | Playing | Sitting out |
|---|---|---|
| 1 | A B C D E F G H | I J |
| 2 | I J A B C D E F | G H |
| 3 | G H I J A B C D | E F |

The system should maintain session-level playing-time state.

### Hard requirement

The generator must prioritize equal playing time over partner/opponent variety.

---

# 4. Sit-Out Distribution

When more players are present than available court capacity allows, some players must sit out.

The system should distribute sit-outs as evenly as possible.

Track at least:

- matches played
- sessions participated in
- sit-out count
- recent sit-out history

Players with fewer matches played in the current session should be prioritized for the next available match.

---

# 5. Dynamic Round Robin / Fairness Engine

The league should behave like a dynamic round robin.

The system should **try** to achieve:

1. Every player plays with every other player.
2. Every player plays against every other player.
3. Different team combinations are used.
4. Recent repeated pairings are avoided.
5. Players with fewer matches receive priority.
6. Players with fewer sit-outs receive priority for sitting out.
7. Referee responsibilities are balanced.

These are **soft constraints**, except equal playing time and practical scheduling constraints.

The system must still generate a valid schedule when perfect round-robin coverage is impossible.

---

# 6. Match Generation Priority

The recommended priority order is:

1. **Equal playing time**
2. **Even sit-out distribution**
3. **Maximize new partner combinations**
4. **Maximize new opponent combinations**
5. **Maximize new complete team combinations**
6. **Avoid recently repeated matches**
7. **Balance referee assignments**

The generator should score possible match combinations and select the highest-quality valid schedule.

---

# 7. Match History

The system must retain historical relationship data.

At minimum track:

### Partner history

Example:

```text
Anna + Per = 3
Anna + Kari = 1
Anna + Ola = 0
```

### Opponent history

Example:

```text
Anna vs Per = 2
Anna vs Kari = 0
Anna vs Ola = 3
```

### Complete team history

Example:

```text
Anna + Per vs Kari + Ola = 1
```

This allows the generator to gradually increase variety over the course of a season.

---

# 8. Postponed Matches

Absence must not break the round-robin logic.

If a player is absent and a desired matchup cannot be played:

- Do not delete the matchup.
- Mark it as postponed / outstanding.
- Keep it in the season's remaining matchup pool.
- Prioritize it when the relevant players are available again.

Suggested match statuses:

```text
SCHEDULED
ACTIVE
COMPLETED
POSTPONED
CANCELLED
```

---

# 9. Referee / Scorekeeper System

Players who sit out should normally be assigned referee/scorekeeper responsibilities.

### Core rule

Referee responsibilities must be distributed as evenly as possible **per session and across the season**.

The system should track:

- referee assignments
- recent referee assignments
- total referee assignments
- current session referee assignments

When several players are eligible, prioritize those with the fewest assignments.

### Important

Referee responsibility is tied to the players who sit out, but the system must handle edge cases where the number of available non-playing players does not match the number of courts.

---

# 10. Two Referee Modes

League v2 must support both:

## Automatic referee assignment

The system automatically determines referees.

Priority:

1. Player is sitting out.
2. Player has fewer referee assignments.
3. Player has not recently been referee.
4. Balance assignments across the session.

## Manual referee assignment

Admin can override the automatic assignment.

Example:

```text
Court 1 referee:
[ Anna ▼ ]

Court 2 referee:
[ Per ▼ ]
```

Manual assignments should still be recorded in the referee history.

---

# 11. Big Score Integration

Padel Star already has a **Big Score** function.

League matches should reuse the existing Big Score component rather than creating a separate scoring UI.

Big Score must support:

- two teams
- live point entry
- match timer
- current score
- active server
- end-of-time handling
- Golden Point
- result submission

This should be implemented as a reusable/shared scoring component where possible.

---

# 12. Serve Indicator UI

The existing Padel Star ball asset should be used to identify the active server.

Example:

```text
Anna + Per

[Padel Star ball asset] Anna

7
-
5

Kari + Ola
```

When the serve changes:

```text
[Padel Star ball asset] Per
```

The indicator should automatically follow the serve rotation.

Do not use a generic emoji if the project asset is available. Use the actual Padel Star asset.

---

# 13. Multiple Courts

League sessions must support multiple simultaneous courts.

Example:

```text
Court 1
Anna + Per
vs
Kari + Ola

Court 2
Lars + Emma
vs
Henrik + Nora

Court 3
Julie + Thomas
vs
Sofie + Erik
```

Each court needs:

- its own match
- its own score
- its own timer
- its own server state
- its own referee/scorekeeper
- its own result

All courts in a round normally start and finish together.

---

# 14. League Session Flow

Recommended flow:

```text
Admin opens league
        ↓
Select / create session
        ↓
Register attendance
        ↓
System calculates available court capacity
        ↓
Determine players for each round
        ↓
Balance sit-outs
        ↓
Generate matches
        ↓
Assign referees
        ↓
Start matches
        ↓
Big Score + timer
        ↓
Match ends
        ↓
Golden Point if necessary
        ↓
Record result
        ↓
Update standings
        ↓
Update fairness history
        ↓
Generate next round
        ↓
End session
```

---

# 15. League Standings

The primary standings are individual.

Example:

| Rank | Player | Matches | Wins | Losses | Points | +/- |
|---:|---|---:|---:|---:|---:|---:|
| 1 | Anna | 12 | 10 | 2 | 30 | +34 |
| 2 | Per | 12 | 9 | 3 | 27 | +27 |
| 3 | Kari | 11 | 8 | 3 | 24 | +19 |

### Primary ranking

1. League points
2. Number of wins
3. Point difference
4. Head-to-head, where meaningful
5. Number of completed matches
6. Final fallback if still tied

The exact tie-breaker implementation can be refined during implementation.

---

# 16. Player Statistics

Each player should eventually be able to see:

- league points
- matches played
- wins
- losses
- win rate
- points scored
- points conceded
- point difference
- partners used
- partner frequency
- opponents faced
- opponent frequency
- referee assignments
- sit-outs

This information can also support the social layer.

---

# 17. League Player View

Example:

```text
Høstliga 2026

Anna
30 league points

12 matches
10 wins
2 losses

Point difference
+34

Next match
Court 2

Anna + Per
vs
Kari + Ola

Starts in 01:24
```

Players should also be able to view their match history.

---

# 18. Season Configuration

League creation should include:

## General

```text
League name
Players
Season dates
```

## Match rules

```text
Format: 2v2
Match duration: 5 minutes (default)
Scoring: Points
Golden Point: Enabled
Serve rotation: 2 serves
```

## Courts

```text
Number of courts
```

## Fairness

The following should be enabled by default:

```text
Balance playing time
Rotate partners
Rotate opponents
Balance referee assignments
```

Advanced settings can be exposed later if needed.

---

# 19. Season Date Model

Do not define seasons solely as "number of days".

Support both:

### Preset duration

```text
1 month
3 months
6 months
12 months
```

### Custom dates

```text
Start: 01.07.2026
End:   31.12.2026
```

This allows standard half-year seasons such as:

- 1 January → 30 June
- 1 July → 31 December

while retaining flexibility for clubs with different season structures.

---

# 20. Future Match Format Extension

League v2.0 should support **Timed Points** only.

Do not implement Games / Sets / Match in the first League version.

However, the match architecture should be designed so future scoring formats can be added without replacing the core match model.

Future concept:

```text
Match
│
├── Scoring format
│   ├── Timed Points
│   └── Games / Sets / Match
│
└── Rules
```

Future expansion could support:

```text
Point
  ↓
Game
  ↓
Set
  ↓
Match
```

This should be treated as a later feature / v2.x or future tournament-format expansion.

---

# 21. Shared Competition Architecture

The existing tournament functionality and League should share common infrastructure.

Recommended high-level model:

```text
Competition
│
├── Tournament
│   ├── Round Robin
│   └── Cup
│
└── League
    └── Season
        └── Sessions
            └── Matches
```

Shared components should include where appropriate:

- Player
- Team
- Match
- Score
- Big Score
- Timer
- Court
- Competition
- User
- Permissions

Avoid duplicating scoring and match functionality between tournaments and leagues.

---

# 22. Recommended League Data Model

High-level structure:

```text
League
│
├── Season
│   ├── Players
│   ├── Settings
│   ├── Sessions
│   │   ├── Attendance
│   │   ├── Rounds
│   │   │   ├── Matches
│   │   │   │   ├── Teams
│   │   │   │   ├── Players
│   │   │   │   ├── Score
│   │   │   │   ├── Server state
│   │   │   │   └── Referee
│   │   │   └── Court assignments
│   │   └── Results
│   │
│   └── Calculated standings
```

Results should remain the source of truth.

Do not store standings as an independent authoritative data source that can drift away from match results.

Recommended flow:

```text
Match result
    ↓
Historical match data
    ↓
Calculated standings
```

---

# 23. State Models

## Season

```text
DRAFT
ACTIVE
PAUSED
COMPLETED
ARCHIVED
```

## Session

```text
PLANNED
CHECK_IN
ACTIVE
PAUSED
COMPLETED
```

## Match

```text
SCHEDULED
ACTIVE
COMPLETED
POSTPONED
CANCELLED
```

---

# 24. League Generator — Conceptual Algorithm

The generator should work session-by-session.

Do **not** generate the entire season schedule in advance.

Recommended flow:

```text
Season
  ↓
Session
  ↓
Attendance
  ↓
Available players
  ↓
Available court capacity
  ↓
Calculate required sit-outs
  ↓
Select players for each round
  ↓
Generate possible team combinations
  ↓
Score combinations
  ↓
Select best valid combinations
  ↓
Assign referees
  ↓
Start round
```

Each completed round updates the historical data used by the next round.

This makes the system resilient to:

- absence
- changing attendance
- changing court count
- postponed matches
- new players
- players leaving
- repeated participation
- different numbers of sessions

---

# 25. Fairness Scoring

A possible conceptual scoring model:

```text
Higher score:
+ Player has played fewer matches this session
+ Player has sat out more recently
+ Partner combination is new
+ Opponent relationship is new
+ Complete team combination is new
+ Match has not occurred recently
+ Player has fewer referee assignments

Lower score:
- Same partner used recently
- Same opponent faced recently
- Same complete team repeated
- Player has already played more than others
- Player recently had referee responsibility
```

The exact mathematical weighting should be determined during implementation and tested with simulated schedules.

---

# 26. Social Features — V2

League functionality should be released alongside the planned social layer.

The exact social scope should follow the existing Padel Star product plan, but the architecture should support:

- player profiles
- player activity
- friends/connections
- match results
- league participation
- achievements/badges
- social sharing
- player statistics

League results should feed naturally into the player's social/profile experience.

---

# 27. V2 Release Structure

## Padel Star v2.0

### League

- Season creation
- Season dates
- Attendance
- Session management
- Multiple courts
- Dynamic match generation
- Equal playing time
- Sit-out balancing
- Partner rotation
- Opponent rotation
- Team-combination variation
- Postponed matches
- Referee assignment
- Automatic referee mode
- Manual referee mode
- Big Score integration
- 5-minute default matches
- Admin-configurable match duration
- Golden Point
- Serve rotation
- Padel Star ball serve indicator
- Individual standings
- Match history
- Player statistics

### Social

- Existing planned social functionality
- Player profiles
- Activity
- Connections/friends
- Achievements
- Social presentation of results

---

# 28. Future v2.x / Beyond

Potential later extensions:

- Games / Sets / Match
- Advanced match formats
- More tournament formats
- League divisions
- Promotion/relegation
- Playoffs
- Finals
- Cross-club leagues
- Advanced rankings
- ELO-style rating
- More detailed analytics
- Advanced social competition features

These should **not** be required for League v2.0.

---

# 29. Product Principles

The following principles should guide implementation.

### Fairness over perfection

The system should produce a practical, fair schedule rather than fail because perfect round robin is impossible.

### Equal playing time first

Players participating in the same session should play the same amount whenever mathematically possible.

### Variety over rigid scheduling

The system should continuously seek new partners and opponents.

### Dynamic rather than pre-planned

Generate schedules from actual attendance instead of generating an entire season in advance.

### Reuse existing systems

Reuse Big Score, player data, tournament infrastructure, assets and shared UI components wherever practical.

### Admin remains in control

Automatic generation should be the default, but admins must be able to override referee assignments and other operational details.

### Future-proof match architecture

Timed Points is the only scoring format required in v2.0, but the match model should not prevent future Games → Sets → Match functionality.

---

# 30. Definition of Done — League v2.0

League v2.0 can be considered complete when:

- [ ] Admin can create a league.
- [ ] Admin can choose a season duration or custom dates.
- [ ] Admin can configure match duration.
- [ ] Default match duration is 5 minutes.
- [ ] Admin can configure number of courts.
- [ ] Admin can add/remove league players.
- [ ] Admin can start a session.
- [ ] Admin can register attendance.
- [ ] System balances playing time.
- [ ] System balances sit-outs.
- [ ] System tries to maximize partner variety.
- [ ] System tries to maximize opponent variety.
- [ ] System tracks complete team combinations.
- [ ] System postpones impossible matchups instead of losing them.
- [ ] System supports multiple simultaneous courts.
- [ ] System assigns referees automatically.
- [ ] Referee assignments are balanced.
- [ ] Admin can manually override referees.
- [ ] Big Score works for league matches.
- [ ] Five-minute timed matches work.
- [ ] Golden Point works.
- [ ] Serve rotation works correctly.
- [ ] Active server is visually indicated using the Padel Star ball asset.
- [ ] Match results are persisted.
- [ ] League points are calculated correctly.
- [ ] Standings update correctly.
- [ ] Player statistics update correctly.
- [ ] Session history is preserved.
- [ ] Season history is preserved.
- [ ] Social/profile functionality integrates with league results.
- [ ] No Games/Sets/Match functionality is required for v2.0.
- [ ] Existing v1 tournament functionality remains functional.
- [ ] The full v2 flow is tested with different player counts, court counts and attendance patterns.

---

# 31. Recommended Implementation Phases

## Phase 1 — Architecture

- Define League/Season/Session/Match entities.
- Integrate with existing Player and Competition models.
- Refactor shared scoring/match components where necessary.
- Establish league settings.

## Phase 2 — Session Engine

- Attendance.
- Court capacity.
- Equal playing-time calculation.
- Sit-out management.
- Session lifecycle.

## Phase 3 — Match Generator

- Partner history.
- Opponent history.
- Team-combination history.
- Fairness scoring.
- Postponed match handling.
- Multi-court scheduling.

## Phase 4 — Live Match

- Big Score integration.
- Match timer.
- Serve rotation.
- Server indicator using Padel Star ball asset.
- Golden Point.
- Result submission.

## Phase 5 — Referee System

- Automatic referee assignment.
- Balanced referee distribution.
- Manual admin override.
- Referee history.

## Phase 6 — Standings & Statistics

- League table.
- Player statistics.
- Match history.
- Season statistics.

## Phase 7 — Social Integration

- Profiles.
- Activity.
- Friends/connections.
- Achievements.
- League result presentation.

## Phase 8 — Testing & Verification

Test at minimum:

- 4 players / 1 court
- 5 players / 1 court
- 6 players / 1 court
- 8 players / 2 courts
- 9 players / 2 courts
- 10 players / 2 courts
- 12 players / 3 courts
- Different attendance from session to session
- Repeated absences
- Postponed matchups
- Manual referee override
- Golden Point
- Server rotation
- Season boundaries
- 1/3/6/12-month seasons
- Custom 1 July → 31 December season
- Custom 1 January → 30 June season

---

# 32. Final Product Definition

**Padel Star League v2.0** is an individual, season-based 2v2 league where players earn 3 points for a win and 0 for a loss. Matches are dynamically generated from actual attendance. The system prioritizes equal playing time and fair sit-out distribution, while continuously attempting to maximize partner and opponent variety and reduce repeated team combinations.

Matches use timed point scoring, normally 5 minutes, with an admin-configurable duration and Golden Point for ties. Serve rotates after two serves, alternating between the two players on each team and alternating right/left service positions. The existing Big Score system handles live scoring, and the Padel Star ball asset identifies the active server.

Players who sit out are normally assigned referee/scorekeeper responsibility, with assignments distributed as evenly as possible. Admin can use automatic or manual referee assignment.

Seasons support standard durations as well as custom date ranges, including fixed half-year seasons such as 1 January–30 June and 1 July–31 December.

The League system is part of **Padel Star v2**, alongside the planned social functionality. Games → Sets → Match scoring is deliberately excluded from v2.0 but should be supported by a future-proof match architecture so it can be added later without rebuilding the League foundation.
