const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Field test 2026-10-12: "Nullstill turnering" on an account-owned tournament. The finalize RPC bumped the revision,
// the revision broadcast started a refresh, and its answer arrived after the reset had cleared the device. It was
// applied as a "new" tournament, so the cancelled tournament came back into local storage without its admin key.

function realtime({ refreshDelay = 30 } = {}) {
  const context = { console, setTimeout, clearTimeout };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "realtime-connection.js"), "utf8"), context);
  let state = { id: "t1", inviteCode: "ABCD2345", revision: 43 };
  const applied = [];
  const api = context.PadelstarRealtimeConnection.create({
    applyRemoteState: (data) => { applied.push(data); return true; },
    flushPendingRemoteWrites: () => {},
    getClient: () => ({ channel: () => ({ on() { return this; }, subscribe() {} }), removeChannel() {} }),
    getInviteState: async () => { await new Promise((r) => setTimeout(r, refreshDelay)); return { data: { id: "t1", revision: 44, status: "Avsluttet" } }; },
    getNavigator: () => ({ onLine: true }),
    getState: () => state,
    handleRemoteError: () => {},
    hasActiveTournament: () => true,
    isReady: () => true,
    onConnectionStateChange: () => {},
    onTournamentMissing: () => { throw new Error("must not be called for a tournament the device already left"); },
    realtimeSync: { channelName: (id) => `tournament:${id}`, backoffForAttempt: () => 1000, connectionStateForAttempt: () => "connecting", isSubscribed: () => true, shouldReconnect: () => false },
    translate: (key) => key,
  });
  return { api, applied, setState: (next) => { state = next; } };
}

test("a refresh that answers after the tournament was reset is dropped", async () => {
  const { api, applied, setState } = realtime();
  const pending = api.refresh("broadcast");
  setState({ id: null, inviteCode: "P4K7D", revision: 0 }); // the reset cleared the device meanwhile
  assert.equal(await pending, false);
  assert.equal(applied.length, 0);
});

test("a refresh for the open tournament is still applied", async () => {
  const { api, applied } = realtime({ refreshDelay: 0 });
  assert.equal(await api.refresh("manual"), true);
  assert.equal(applied.length, 1);
});

function controller(state) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "core", "remote-state-controller.js"), "utf8"), context);
  const saved = [];
  const api = context.window.PadelstarRemoteStateController.create({
    getState: () => state,
    setState: (next) => { state = next; },
    getPendingPlayerScores: () => [],
    setPendingPlayerScores: () => {},
    getPendingAdminSync: () => false,
    setPendingAdminSync: () => {},
    setRemoteConflict: () => {},
    migrateState: (next) => ({ ...next, settings: { language: "nb" } }),
    loadUserLanguage: () => "nb",
    saveState: () => saved.push(state.id),
    persistSyncMetadata: () => {},
    setRemoteNotice: () => {},
    connectRealtimeForCurrentState: () => {},
    hasRealtimeChannel: () => true,
    render: () => {},
    saveProfileHistory: () => {},
    setIsApplyingRemoteState: () => {},
    translate: (key) => key,
  });
  return { api, saved, getState: () => state };
}

test("refresh and realtime answers never replace the open tournament with another one", () => {
  for (const source of ["refresh", "realtime"]) {
    const { api, saved, getState } = controller({ id: null, revision: 0, settings: {} });
    assert.equal(api.applyRemoteState({ id: "t1", revision: 44, status: "Avsluttet", settings: {} }, { source }), false, source);
    assert.equal(getState().id, null);
    assert.equal(saved.length, 0, `${source}: nothing written to local storage`);
  }
});

test("opening a tournament by its code still loads it", () => {
  const { api, getState } = controller({ id: null, revision: 0, settings: {} });
  assert.equal(api.applyRemoteState({ id: "t2", revision: 3, settings: {} }, { source: "invite" }), true);
  assert.equal(getState().id, "t2");
});

test("a finalize refused for a stale revision drops its saved intent so the next try can work", async () => {
  const context = vm.createContext({ window: {}, structuredClone, Date });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "tournament-finalization.js"), "utf8"), context);
  const state = { id: "t1", adminToken: "secret", revision: 4, status: "Runde pågår", rounds: [] };
  let intent = null;
  let attempt = 0;
  const revisions = [];
  const finalization = context.window.PadelstarTournamentFinalization.create({
    getState: () => state,
    isShared: () => true,
    isOnline: () => true,
    flushWrites: async () => true,
    getIntent: () => intent,
    saveIntent: (value) => { intent = value; },
    clearIntent: () => { intent = null; },
    call: async (_name, payload) => {
      revisions.push(payload.p_expected_revision);
      attempt += 1;
      if (attempt === 1) return { error: new Error("Tournament state changed") };
      return { data: { id: "t1", outcome: "cancelled", deleted: false, statisticsSaved: true } };
    },
    commit: async () => {},
    reportError: () => {},
  });
  assert.equal(await finalization.finalize("cancelled"), false);
  assert.equal(intent, null, "the stale intent is gone");
  state.revision = 6;
  assert.equal(await finalization.finalize("cancelled"), true);
  assert.deepEqual(revisions, [4, 6]);
});
