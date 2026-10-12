const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("the lobby tab holds Del turnering, Spillere, Regler and Banekø in that order, with one court form (4.2)", () => {
  const html = read("index.html");
  const admin = html.slice(html.indexOf('data-section="admin"'), html.indexOf('data-section="player"'));
  const order = ['id="lobbyPanel"', 'id="shareTournamentButton"', 'id="lobbyAddPlayerForm"', 'id="tournamentSettingsForm"', 'id="courtNamesForm"', 'id="courtQueue"', 'id="resetTournamentButton"'];
  order.reduce((previous, marker) => {
    const index = admin.indexOf(marker);
    assert.ok(index > previous, `${marker} comes after the module before it`);
    return index;
  }, -1);
  assert.doesNotMatch(html, /id="lobbyCourtNamesForm"|id="lobbySkipButton"|id="lobbyInviteCode"/, "no duplicate share or court blocks");
  const events = read("app", "admin-form-events.js");
  assert.match(events, /elements\.addPlayerForm\?\.addEventListener\("submit", submitAddPlayers\)/);
  assert.match(events, /elements\.lobbyAddPlayerForm\?\.addEventListener\("submit", submitAddPlayers\)/);
  assert.match(events, /elements\.courtNamesForm\?\.addEventListener\("submit", submitCourtNames\)/);
});

function listElement(active = false) {
  const el = { innerHTML: "", dataset: {}, children: [], contains: () => active };
  return el;
}
function courtSettings(elements, state, activeElement = null) {
  const context = { console, document: { activeElement } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("app", "court-settings.js"), context);
  return context.PadelstarCourtSettings.create({ elements, getState: () => state, translate: (k) => (k === "common.court" ? "Bane" : k), escapeAttribute: String, escapeHtml: String });
}

test("court names render in the lobby's rules module and lock once the tournament has started", () => {
  const form = () => ({ elements: { courtCount: { disabled: false, value: "" } }, querySelector: () => ({ disabled: false }) });
  const elements = { courtNamesList: listElement(), courtNamesForm: form() };
  const state = { rounds: [], status: "Klar", courts: [{ courtNumber: 1, name: "Center" }, { courtNumber: 2, name: "" }] };
  courtSettings(elements, state).renderCourtNames();
  assert.equal((elements.courtNamesList.innerHTML.match(/name="courtName"/g) ?? []).length, 2);
  assert.match(elements.courtNamesList.innerHTML, /value="Center"/);
  assert.doesNotMatch(elements.courtNamesList.innerHTML, /disabled/);
  assert.equal(elements.courtNamesForm.elements.courtCount.value, "2", "the count follows the tournament");
  state.rounds = [{}];
  courtSettings(elements, state).renderCourtNames();
  assert.match(elements.courtNamesList.innerHTML, /disabled/, "locked once the tournament has started");
});

test("typing in a court name is not overwritten by a re-render", () => {
  const list = listElement(true);
  list.children = [{}, {}];
  list.dataset.locked = "false";
  list.innerHTML = "<typing>";
  const elements = { courtNamesList: list, courtNamesForm: null };
  courtSettings(elements, { rounds: [], status: "Klar", courts: [{ courtNumber: 1 }, { courtNumber: 2 }] }, {}).renderCourtNames();
  assert.equal(list.innerHTML, "<typing>");
});

test("the lobby texts exist in both languages", () => {
  const i18n = vm.createContext({ window: {} });
  vm.runInContext(read("app", "translations.js"), i18n);
  for (const language of ["nb", "en"]) for (const key of ["lobby.addPlayers", "lobby.courts", "lobby.saveCourts"]) assert.ok(i18n.window.PadelstarTranslations[language][key], `${language} ${key}`);
});
