const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = { console, structuredClone };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "app", "match-actions.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "app", "translations.js"), "utf8"), context);
const nb = vm.runInContext("padelstarTranslations.nb", context);
const en = vm.runInContext("padelstarTranslations.en", context);
const fill = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

function setup({ accept }) {
  const asked = []; const queued = [];
  const actions = context.PadelstarMatchActions.create({
    activateNextWaitingMatch() {}, getActiveRound: () => null, getMatchById: () => null, getRoundForMatch: () => null, getState: () => ({}),
    isSupabaseReady: () => true, markCupCompleteIfDone() {}, queueRemoteMatchAction: (match, action, teamIndex) => queued.push([action, teamIndex]),
    render() {}, renderLargeScore() {}, saveState() {}, showToast() {},
    requestConfirmation: async (message, title, acceptLabel) => { asked.push({ message, title, acceptLabel }); return accept; },
    t: (key, values) => fill(nb[key] ?? key, values),
  });
  return { actions, asked, queued };
}

const match = () => ({ id: "m1", state: "playing", teamOne: { displayName: "Ola / Kari" }, teamTwo: { displayName: "Per / Liv" } });

test("the walkover question names the team that is set as winner, in the title, the text and the confirm button", async () => {
  const { actions, asked, queued } = setup({ accept: true });
  await actions.setWalkover(match(), 1);
  assert.equal(asked[0].title, "Registrere walkover til Per / Liv?");
  assert.equal(asked[0].message, "Per / Liv blir da satt som vinner av denne kampen.");
  assert.equal(asked[0].acceptLabel, "Sett Per / Liv som vinner");
  assert.deepEqual(queued, [["walkover", 1]], "the team named in the question is the team sent as winner");
});

test("declining the walkover question changes nothing", async () => {
  const { actions, queued } = setup({ accept: false });
  await actions.setWalkover(match(), 0);
  assert.deepEqual(queued, []);
});

test("the walkover texts exist in Norwegian and English", () => {
  for (const key of ["messages.walkoverTitle", "messages.walkoverConfirm", "messages.walkoverAccept"]) {
    assert.match(nb[key], /\{team\}/, key);
    assert.match(en[key], /\{team\}/, key);
  }
});
