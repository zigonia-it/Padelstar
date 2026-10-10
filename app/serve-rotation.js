window.PadelstarServe = (() => {
  // Who serves, and from which side (League v2.0 scope §2.1, §12). Nothing is stored: the server is derived from the
  // match score alone, so undo, corrections, realtime updates and points scored on the server (SQL) all stay right.
  //
  // Serve order for teams (1, 2) vs (3, 4), the team in match.startingTeamIndex serving first:
  //   1, 3, 2, 4, 1, 3, ...   (the serve alternates between the teams, and within a team between its two players)
  // Every serve turn starts from the right side and then switches sides on each point.
  //
  //   Tennis scoring: one turn = one game (padel rules). Inside a tiebreak the first point is one turn and after it
  //                   every two points are one turn.
  //   Points scoring: one turn = two points (League: "serve changes after two serves from a team").
  //
  // The engine keeps a game in "deuce" small by taking the same number off both sides (scoring-engine.js applyPoint),
  // which never changes whether the points played in that game are odd or even, so the side is still right.

  function sum(score) {
    return (score?.teamOne ?? 0) + (score?.teamTwo ?? 0);
  }

  // Games (or points, in points scoring, where every point is a game) played so far in the whole match.
  function gamesPlayed(match) {
    return (match?.completedSets ?? []).reduce((total, set) => total + sum(set), 0) + sum(match?.currentSet);
  }

  function isPoints(match, settings) {
    return window.PadelstarScoring?.isPointsMatch?.(match, settings) ?? (match?.rules?.scoringMode ?? settings?.scoringMode) === "points";
  }

  // { turn, side } where turn counts serve turns from 0 and side is "right" or "left".
  function serveTurn(match, settings = {}) {
    if (isPoints(match, settings)) {
      const points = gamesPlayed(match);
      return { turn: Math.floor(points / 2), side: points % 2 === 0 ? "right" : "left" };
    }
    const pointsInGame = sum(match?.currentGame);
    const side = pointsInGame % 2 === 0 ? "right" : "left";
    if (match?.inTiebreak) {
      // the tiebreak's own games are not in currentSet yet: gamesPlayed counts up to it, the tiebreak is the next turn
      return { turn: gamesPlayed(match) + Math.floor((pointsInGame + 1) / 2), side };
    }
    return { turn: gamesPlayed(match), side };
  }

  // The four serve slots in order: [first team's first player, other team's first player, first team's second
  // player, other team's second player]. A singles team serves every one of its turns with its only player.
  function serveOrder(match) {
    const first = match?.startingTeamIndex === 1 ? 1 : 0;
    const teams = [match?.teamOne, match?.teamTwo];
    const slot = (teamIndex, playerIndex) => {
      const players = teams[teamIndex]?.players ?? [];
      return { teamIndex, player: players[playerIndex] ?? players[0] ?? null };
    };
    return [slot(first, 0), slot(1 - first, 0), slot(first, 1), slot(1 - first, 1)];
  }

  // The serving player right now: { teamIndex, player, side }, or null when there is no live match to serve in.
  function currentServer(match, settings = {}) {
    if (!match || !match.teamOne || !match.teamTwo) return null;
    const { turn, side } = serveTurn(match, settings);
    const { teamIndex, player } = serveOrder(match)[turn % 4];
    return { teamIndex, player, side };
  }

  return { currentServer, serveOrder, serveTurn, gamesPlayed };
})();
