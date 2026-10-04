const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// field test 2026-10-04: 93 points left one match with 800 KB of undo history; the tournament passed the server's
// 256 KB state limit and every admin save (the admin's result) was refused while players' points kept going
const context = { console, structuredClone };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "state-manager.js"), "utf8"), context);
const manager = context.PadelstarState;
const SERVER_LIMIT = 262144;

function fieldTestMatch(points) {
  const eventLog = [];
  const undoStack = [];
  for (let i = 0; i < points; i += 1) {
    const snapshot = { id: "m1", state: "playing", currentGame: { teamOne: i % 4, teamTwo: 0 }, scorer: { playerId: "p1" }, scorerLog: eventLog.slice(), eventLog: eventLog.slice() };
    undoStack.push({ match: snapshot, nextWaitingMatch: null, roundId: "r1", roundStatus: "active", tournamentStatus: "Runde pågår", revision: i, cupWinnerTeam: null });
    eventLog.push({ at: "2026-10-04T22:00:00.000Z", type: "point", playerId: "p1-0000-0000-0000-000000000000", teamIndex: 0 });
  }
  return { id: "m1", state: "playing", teamOne: {}, teamTwo: {}, currentGame: { teamOne: 1, teamTwo: 0 }, scorer: { playerId: "p1" }, eventLog, undoStack };
}

const tournament = () => ({ id: "t", inviteCode: "HIST2345", name: "x", players: [], adminToken: "secret", rounds: [{ id: "r1", matches: [fieldTestMatch(93), fieldTestMatch(40)] }] });

test("the field-test state was over the server limit before compaction", () => {
  assert.ok(JSON.stringify(tournament()).length > SERVER_LIMIT);
});

test("what the admin uploads is compacted far below the server limit", () => {
  const shared = manager.sanitizeSharedState(tournament());
  const size = JSON.stringify(shared).length;
  assert.ok(size < 40000, `uploaded ${size} bytes`);
  const match = shared.rounds[0].matches[0];
  assert.equal(match.undoStack.length, manager.UNDO_LIMIT);
  assert.equal(match.undoStack.at(-1).revision, 92, "the newest steps are the ones kept");
  assert.ok(match.undoStack.every((entry) => !("eventLog" in entry.match) && !("scorer" in entry.match) && !("scorerLog" in entry.match)));
  assert.equal(match.eventLog.length, 93, "the match's own event log is untouched");
  assert.equal(shared.adminToken, undefined);
});

test("compaction on upload does not change the device's own copy", () => {
  const local = tournament();
  manager.sanitizeSharedState(local);
  assert.equal(local.rounds[0].matches[0].undoStack.length, 93);
});

test("a saved state is compacted when it is loaded", () => {
  // migrateState runs every match of a loaded (or fetched) state through migrateMatch
  const loaded = manager.migrateMatch(fieldTestMatch(93), "t", {});
  assert.equal(loaded.undoStack.length, manager.UNDO_LIMIT);
  assert.ok(!("eventLog" in loaded.undoStack[0].match));
});

test("redo entries written by the database are compacted too", () => {
  const match = { id: "m", undoStack: [], redoStack: [{ undoEntry: { match: { id: "m", eventLog: [1] } }, target: { match: { id: "m", eventLog: [1], scorerLog: [1] } } }] };
  manager.compactMatchHistory(match);
  assert.ok(!("eventLog" in match.redoStack[0].undoEntry.match));
  assert.ok(!("eventLog" in match.redoStack[0].target.match) && !("scorerLog" in match.redoStack[0].target.match));
});

test("a new undo snapshot leaves out the scorer, its log and the event log, and the stack stays capped", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "app", "match-actions.js"), "utf8");
  assert.match(source, /for \(const field of \["undoStack", "redoStack", "scorer", "scorerRequest", "scorerLog", "eventLog"\]\) delete matchSnapshot\[field\]/);
  assert.match(source, /match\.undoStack\.length >= UNDO_LIMIT\) match\.undoStack\.splice\(0, match\.undoStack\.length - UNDO_LIMIT \+ 1\)/);
});
