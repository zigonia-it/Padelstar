const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = {};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "scoring-engine.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "serve-rotation.js"), "utf8"), context);
const scoring = context.PadelstarScoring;
const serve = context.PadelstarServe;

const [p1, p2, p3, p4] = ["P1", "P2", "P3", "P4"].map((name) => ({ id: name.toLowerCase(), name }));

function newMatch(rulesInput, startingTeamIndex = 0) {
  return {
    state: "playing", startingTeamIndex,
    currentGame: { teamOne: 0, teamTwo: 0 }, currentSet: { teamOne: 0, teamTwo: 0 }, completedSets: [],
    teamOne: { players: [p1, p2] }, teamTwo: { players: [p3, p4] },
    rules: scoring.rulesFromInput(rulesInput),
  };
}

// one point per entry (0 = team one, 1 = team two); records "name side" before each point
function play(match, points) {
  const seen = [];
  for (const teamIndex of points) {
    const server = serve.currentServer(match);
    seen.push(`${server.player.name} ${server.side}`);
    scoring.awardPoint(match, teamIndex, {});
  }
  return seen;
}

test("points scoring (League): the serve changes every two points, 1-3-2-4, right then left", () => {
  const match = newMatch({ scoringMode: "points", pointsToWin: 99, pointsWinBy: 1, pointsMatchGames: 1, timedMinutes: 5 });
  // the League scope's own list (§2.1): who wins the point does not matter
  assert.deepEqual(play(match, [0, 1, 1, 1, 0, 0, 1, 0, 0, 1]), [
    "P1 right", "P1 left", "P3 right", "P3 left", "P2 right", "P2 left", "P4 right", "P4 left", "P1 right", "P1 left",
  ]);
});

test("points scoring: the team in startingTeamIndex serves first", () => {
  const match = newMatch({ scoringMode: "points", pointsToWin: 99, pointsWinBy: 1, pointsMatchGames: 1 }, 1);
  assert.deepEqual(play(match, [0, 0, 0, 0, 0, 0, 0, 0]), [
    "P3 right", "P3 left", "P1 right", "P1 left", "P4 right", "P4 left", "P2 right", "P2 left",
  ]);
});

test("tennis scoring: one serve turn per game, the side switches every point, deuce keeps the side right", () => {
  const match = newMatch({ scoringMode: "tennis", gamesToWinSet: 6, setsToWinMatch: 2 });
  assert.deepEqual(play(match, [0, 0, 0, 0]), ["P1 right", "P1 left", "P1 right", "P1 left"]);
  assert.equal(serve.currentServer(match).player.name, "P3");
  // a long deuce: the engine shrinks 4-4 back to 3-3, the side must still follow the real point count
  const sides = play(match, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  assert.deepEqual(sides.map((entry) => entry.split(" ")[1]), ["right", "left", "right", "left", "right", "left", "right", "left", "right", "left"]);
  assert.ok(sides.every((entry) => entry.startsWith("P3")));
  play(match, [1, 1]);
  assert.equal(serve.currentServer(match).player.name, "P2");
});

test("tennis tiebreak: first point one turn, then two points per turn starting on the left", () => {
  const match = newMatch({ scoringMode: "tennis", gamesToWinSet: 6, setsToWinMatch: 2, setTiebreak: true });
  // 12 games, alternating winners, reach 6-6 (game 13 is the tiebreak: the 13th serve turn = P1 again)
  for (let game = 0; game < 12; game += 1) play(match, [game % 2, game % 2, game % 2, game % 2]);
  assert.equal(match.inTiebreak, true);
  assert.deepEqual(play(match, [0, 1, 0, 1, 0]), ["P1 right", "P3 left", "P3 right", "P2 left", "P2 right"]);
});

test("the server is derived from the score, so undo brings the previous server back", () => {
  const match = newMatch({ scoringMode: "points", pointsToWin: 99, pointsWinBy: 1, pointsMatchGames: 1 });
  play(match, [0, 0]);
  const before = JSON.parse(JSON.stringify(match));
  play(match, [1]);
  assert.equal(serve.currentServer(match).side, "left");
  assert.deepEqual(JSON.parse(JSON.stringify(serve.currentServer(before))), { teamIndex: 1, player: p3, side: "right" });
});

test("a singles team serves every one of its turns with its only player; no teams means no server", () => {
  const match = newMatch({ scoringMode: "points", pointsToWin: 99, pointsWinBy: 1, pointsMatchGames: 1 });
  match.teamOne = { players: [p1] };
  match.teamTwo = { players: [p3] };
  assert.deepEqual(play(match, [0, 0, 0, 0, 0, 0]).map((entry) => entry.split(" ")[0]), ["P1", "P1", "P3", "P3", "P1", "P1"]);
  assert.equal(serve.currentServer(null), null);
  assert.equal(serve.currentServer({}), null);
});
