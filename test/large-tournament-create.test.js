const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function load(files, extra = {}) {
  let id = 0;
  const context = vm.createContext({ window: {}, crypto: { randomUUID: () => `id-${(id += 1)}` }, structuredClone, ...extra });
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", file), "utf8"), context, { filename: file }));
  return context.window;
}

function players(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Spiller ${index + 1}`, active: true, availability: "active", accent: "silver" }));
}

test("a 40-player Round Robin schedule stays small enough for browser storage", () => {
  const engine = load(["tournament-engine.js"]).PadelstarTournamentEngine;
  const schedule = engine.buildSchedule(players(40), "roundRobin");
  assert.equal(schedule.length, 39);
  assert.ok(schedule.every((round) => !("matchups" in round) && round.allTeamsMeet === false && round.teams.length === 20));
  assert.ok(JSON.stringify(schedule).length < 1_000_000, "the saved schedule no longer copies every pairing");
  assert.equal(engine.roundPlanMatchups(schedule[0]).length, 0, "each team plays one match a round above the limit");
});

test("up to 32 players every team in a rotation still meets every other team", () => {
  const engine = load(["tournament-engine.js"]).PadelstarTournamentEngine;
  assert.equal(engine.allTeamsMeetMaxPlayers, 32);
  const at32 = engine.buildSchedule(players(32), "roundRobin");
  assert.ok(at32.every((round) => round.allTeamsMeet === true));
  assert.equal(engine.roundPlanMatchups(at32[0]).length, 120);
  const at33 = engine.buildSchedule(players(33), "roundRobin");
  assert.ok(at33.every((round) => round.allTeamsMeet === false && round.sittingOut.length === 1));
});

test("older saved schedules with matchups are compacted and still produce the same matchups", () => {
  const engine = load(["tournament-engine.js"]).PadelstarTournamentEngine;
  const legacy = engine.generatePartnerRounds(players(8));
  assert.equal(legacy[0].matchups.length, 6);
  const compact = engine.compactRoundPlan(legacy[0]);
  assert.equal(compact.allTeamsMeet, true);
  assert.equal(engine.roundPlanMatchups(compact).length, 6);
  assert.equal(engine.compactRoundPlan(compact), compact);
});

test("a full browser storage drops older tournaments instead of failing the save", () => {
  const store = new Map();
  const limit = 400;
  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      if (value.length > limit) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
      store.set(key, value);
    },
    removeItem: (key) => store.delete(key),
  };
  const window = load(["storage.js", "tournament-library.js"]);
  const library = window.PadelstarTournamentLibrary.create({ storage: window.PadelstarStorage, localStorage, storageKey: "lib", migrateState: (state) => state });
  library.upsert({ id: "old", name: "x".repeat(150) });
  library.upsert({ id: "new", name: "y".repeat(150) });
  assert.equal(JSON.stringify(library.list().map((item) => item.id)), JSON.stringify(["new"]));
  assert.doesNotThrow(() => library.upsert({ id: "huge", name: "z".repeat(1000) }));
  assert.equal(library.list().length, 0);
});
