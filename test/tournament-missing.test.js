const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// field test 2026-10-04: a device kept a tournament the server had deleted, showed it as live and its code could not be joined
function create(response) {
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "realtime-connection.js"), "utf8"), context);
  const state = { id: "t1", inviteCode: "ABCD2345", revision: 3 };
  const calls = { missing: 0, errors: 0, applied: 0 };
  const api = context.PadelstarRealtimeConnection.create({
    applyRemoteState: () => { calls.applied += 1; return true; },
    flushPendingRemoteWrites: () => {},
    getClient: () => ({ channel: () => ({ on() { return this; }, subscribe() {} }), removeChannel() {} }),
    getInviteState: async () => response,
    getNavigator: () => ({ onLine: true }),
    getState: () => state,
    handleRemoteError: () => { calls.errors += 1; },
    hasActiveTournament: () => true,
    isReady: () => true,
    observability: null,
    onConnectionStateChange: () => {},
    onTournamentMissing: () => { calls.missing += 1; },
    realtimeSync: { channelName: (id) => `tournament:${id}`, backoffForAttempt: () => 1000, connectionStateForAttempt: () => "connecting", isSubscribed: () => false },
    translate: (key) => key,
  });
  return { api, calls };
}

test("a refresh that finds no tournament for the saved code reports it as missing", async () => {
  const { api, calls } = create({ data: null, error: null });
  assert.equal(await api.refresh("manual"), false);
  assert.deepEqual({ ...calls }, { missing: 1, errors: 0, applied: 0 });
});

test("a saved code that now belongs to another tournament is reported as missing", async () => {
  const { api, calls } = create({ data: { id: "someone-else", revision: 1 }, error: null });
  await api.refresh("manual");
  assert.deepEqual({ ...calls }, { missing: 1, errors: 0, applied: 0 });
});

test("a failed request is an error, never a deletion", async () => {
  const { api, calls } = create({ data: null, error: { message: "Failed to fetch" } });
  await api.refresh("manual");
  assert.deepEqual({ ...calls }, { missing: 0, errors: 1, applied: 0 });
});

test("the tournament still on the server is applied as before", async () => {
  const { api, calls } = create({ data: { id: "t1", revision: 4 }, error: null });
  await api.refresh("manual");
  assert.deepEqual({ ...calls }, { missing: 0, errors: 0, applied: 1 });
});

test("the server-confirmed marker stays on the device and is never uploaded", () => {
  const appRoot = path.join(__dirname, "..", "app");
  const stateManager = fs.readFileSync(path.join(appRoot, "state-manager.js"), "utf8");
  const controller = fs.readFileSync(path.join(appRoot, "core", "remote-state-controller.js"), "utf8");
  const entry = fs.readFileSync(path.join(appRoot, "tournament-entry.js"), "utf8");
  const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  assert.match(stateManager, /delete sharedState\.serverConfirmed/);
  assert.match(controller, /nextState\.serverConfirmed = true/);
  assert.match(entry, /nextState\.serverConfirmed = false/);
  // an unconfirmed tournament this device created is uploaded again, a confirmed one is forgotten
  assert.match(app, /state\.serverConfirmed === false\) \{[\s\S]*?createRemoteTournament\(\)/);
  assert.match(app, /clearLocalTournament\(\);\s*showStart\(\);[\s\S]*?messages\.tournamentRemoved/);
});
