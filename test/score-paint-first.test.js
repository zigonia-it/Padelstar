// The big score paints first (2026-10-05): a point updates the big score at once; saving and the full re-render follow
// after the frame, and points that land before that share one save and one render.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appRoot = path.join(__dirname, "..", "app");
function load(file) {
  const context = { window: {}, console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(appRoot, file), "utf8"), context, { filename: file });
  return context;
}

function setup() {
  const scoring = load("scoring-engine.js").PadelstarScoring;
  const calls = [];
  const queued = [];
  const deps = {
    afterPaint: (callback) => queued.push(callback),
    captureMatchUndoState: () => ({}), currentLocalRole: () => "admin", enterApproval: () => {}, finishMatch: () => calls.push("finish"),
    flashMatchCards: (id) => calls.push(`flash:${id}`), getState: () => ({ settings: {} }), isSupabaseReady: () => false,
    matchIncludesPlayer: () => false, queuePlayerScore: () => {}, queueRemoteSetResult: () => {},
    render: () => calls.push("render"), renderLargeScore: () => calls.push("big"), saveState: () => calls.push("save"),
    scoring, showToast: () => {}, t: (key) => key,
  };
  const actions = load("score-actions.js").PadelstarScoreActions.create(deps);
  const match = { id: "m1", state: "playing", teamOne: {}, teamTwo: {}, currentGame: { teamOne: 0, teamTwo: 0 }, currentSet: { teamOne: 0, teamTwo: 0 }, completedSets: [], undoStack: [] };
  return { actions, match, calls, queued };
}

test("a point paints the big score before it saves or re-renders, and quick points share one save and render", () => {
  const { actions, match, calls, queued } = setup();
  actions.awardTennisPoint(match, 0);
  actions.awardTennisPoint(match, 0);
  assert.deepEqual(calls, ["big", "big"]);
  assert.equal(queued.length, 1, "one flush for both points");
  queued[0]();
  assert.deepEqual(calls, ["big", "big", "save", "render", "flash:m1"]);
  actions.flushPendingPoint();
  assert.equal(calls.length, 5, "nothing left to flush");
});

test("closing the big score flushes a pending point at once", () => {
  const { actions, match, calls } = setup();
  actions.awardTennisPoint(match, 1);
  actions.flushPendingPoint();
  assert.deepEqual(calls, ["big", "save", "render", "flash:m1"]);
});
