const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// developer's decision 2026-10-05: a Round Robin round starts the next one by itself once its last match is finished
test("the database starts the next Round Robin round in the write that finishes the last match", () => {
  const sql = read("supabase/migrations/20261005120000_auto_advance_round.sql");
  assert.match(sql, /create trigger tournament_auto_advance_round_before_update\s+before update on public\.tournaments/);
  assert.match(sql, /current_state := public\._advance_round_state\(current_state\);/, "the manual button uses the same step");
  assert.match(sql, /not in \('finished', 'cancelled'\)/, "only a complete round advances");
  assert.match(sql, /<> 'roundRobin'/, "a Cup is left to its bracket action");
});

test("the admin's device announces a new round and sends the round-ready push exactly once", () => {
  const app = read("app/app.js");
  assert.match(app, /function announceRoundChange\(previous, next, meta\)/);
  assert.match(app, /announceRoundChange\(previous, next, meta\);/, "runs on every state applied from the server");
  assert.match(app, /round\.autoStarted[\s\S]{0,160}sendPushNotification\("round_ready"\)/);
  const actions = read("app/remote-admin-actions.js");
  const roundRobinAdvance = actions.slice(actions.indexOf("function queueRemoteRoundAdvance"), actions.indexOf("function queueRemoteCupAdvance"));
  assert.ok(roundRobinAdvance.includes('"admin_advance_round"'));
  assert.doesNotMatch(roundRobinAdvance, /sendPushNotification/, "the Round Robin button no longer sends its own push");
  assert.match(actions.slice(actions.indexOf("function queueRemoteCupAdvance")), /sendPushNotification\("round_ready"\)/, "a Cup round still does");
});

test("the round messages exist in Norwegian and English", () => {
  const translations = read("app/translations.js");
  for (const key of ["round.autoStarted", "round.allRoundsFinished"]) {
    assert.equal((translations.match(new RegExp(`"${key.replace(".", "\\.")}"`, "g")) ?? []).length, 2, key);
  }
});
