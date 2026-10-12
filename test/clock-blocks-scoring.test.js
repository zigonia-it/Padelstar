const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Developer's request 2026-10-12: a timed match takes no points (and no set result) until its clock is started.

function scoringContext() {
  const context = { console, structuredClone };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "scoring-engine.js"), "utf8"), context);
  return context;
}
const freshMatch = (extra = {}) => ({ id: "m1", state: "playing", currentGame: { teamOne: 0, teamTwo: 0 }, currentSet: { teamOne: 0, teamTwo: 0 }, completedSets: [], teamOne: { players: [{ id: "ann" }], displayName: "Ann" }, teamTwo: { players: [{ id: "bob" }], displayName: "Bob" }, ...extra });

test("only a timed match whose clock has not started is locked", () => {
  const { PadelstarScoring: scoring } = scoringContext();
  assert.equal(scoring.clockBlocksScoring(freshMatch(), { timedMinutes: 10 }), true);
  assert.equal(scoring.clockBlocksScoring(freshMatch({ state: "waiting" }), { timedMinutes: 10 }), true, "a waiting timed match is started with Start match");
  assert.equal(scoring.clockBlocksScoring(freshMatch({ startedAt: "2026-10-12T10:00:00.000Z" }), { timedMinutes: 10 }), false);
  assert.equal(scoring.clockBlocksScoring(freshMatch(), { timedMinutes: 0 }), false, "untimed matches are scored as before");
  assert.equal(scoring.clockBlocksScoring(freshMatch(), {}), false);
  assert.equal(scoring.clockBlocksScoring(freshMatch({ rules: { timedMinutes: 15 } }), {}), true, "the match's own rule profile counts");
  assert.equal(scoring.clockBlocksScoring(freshMatch({ state: "finished" }), { timedMinutes: 10 }), false);
});

function scoreActions(settings, { supabase = false } = {}) {
  const context = scoringContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "score-actions.js"), "utf8"), context);
  const toasts = [];
  const remote = [];
  const state = { settings, selectedPlayerId: null };
  const api = context.PadelstarScoreActions.create({
    captureMatchUndoState: (match) => ({ ...match }),
    currentLocalRole: () => "admin",
    finishMatch: () => {},
    flashMatchCards: () => {},
    getState: () => state,
    isSupabaseReady: () => supabase,
    matchIncludesPlayer: () => false,
    queuePlayerScore: () => {},
    queueRemoteSetResult: (...args) => remote.push(args),
    render: () => {},
    renderLargeScore: () => {},
    saveState: () => {},
    scoring: context.PadelstarScoring,
    showToast: (message) => toasts.push(message),
    t: (key) => key,
    translateScoreValidationError: (message) => message,
  });
  return { api, toasts, remote };
}

test("a point on a timed match before its clock starts is refused with a message", () => {
  const { api, toasts } = scoreActions({ timedMinutes: 10 });
  const match = freshMatch();
  api.awardTennisPoint(match, 0);
  assert.equal(match.currentGame.teamOne, 0);
  assert.equal(match.undoStack, undefined, "nothing was recorded");
  assert.deepEqual(toasts, ["match.clockNotStarted"]);
});

test("a waiting timed match is not started by a point any more", () => {
  const { api } = scoreActions({ timedMinutes: 10 });
  const match = freshMatch({ state: "waiting" });
  api.awardTennisPoint(match, 0);
  assert.equal(match.state, "waiting");
});

test("once the clock runs, and on untimed matches, points are scored", () => {
  const started = freshMatch({ startedAt: new Date().toISOString() });
  scoreActions({ timedMinutes: 10 }).api.awardTennisPoint(started, 0);
  assert.equal(started.currentGame.teamOne, 1);
  const untimed = freshMatch();
  scoreActions({}).api.awardTennisPoint(untimed, 1);
  assert.equal(untimed.currentGame.teamTwo, 1);
});

test("a set result before the clock starts is refused, locally and before any server call", () => {
  const local = scoreActions({ timedMinutes: 10 });
  const match = freshMatch();
  local.api.saveSetResult(match, 6, 2);
  assert.equal(match.completedSets.length, 0);
  assert.deepEqual(local.toasts, ["match.clockNotStarted"]);
  const shared = scoreActions({ timedMinutes: 10 }, { supabase: true });
  shared.api.saveSetResult(freshMatch(), 6, 2);
  assert.equal(shared.remote.length, 0);
});

function cardApi(settings) {
  const context = scoringContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "match-card.js"), "utf8"), context);
  return context.PadelstarMatchCard.create({
    currentLocalRole: () => "admin",
    escapeAttribute: (v) => String(v),
    escapeHtml: (v) => String(v),
    getState: () => ({ settings, status: "Runde pågår" }),
    matchIncludesPlayer: () => false,
    setsWonByTeam: () => 0,
    teamAccentStyle: () => "",
    translate: (key) => key,
  });
}

test("the match card's + buttons are disabled until the clock starts", () => {
  const plusButtons = (html) => [...html.matchAll(/<button class="scoreboard-point-plus"[^>]*>/g)].map((m) => m[0]);
  const locked = plusButtons(cardApi({ timedMinutes: 10 }).scoreboardTableMarkup(freshMatch(), true));
  assert.equal(locked.length, 2);
  assert.ok(locked.every((button) => / disabled>/.test(button)));
  const open = plusButtons(cardApi({ timedMinutes: 10 }).scoreboardTableMarkup(freshMatch({ startedAt: new Date().toISOString() }), true));
  assert.ok(open.every((button) => !/ disabled>/.test(button)));
});
