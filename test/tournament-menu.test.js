// The four-item tournament menu (developer's request 2026-10-12): Lobby, Spillere, Kamper, Tabell/Cup; TV Mode only on
// tablets and computers; admin-only modules stay behind the same role checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

function load(file, extra = {}) {
  const context = { console, ...extra };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("app", file), context);
  return context;
}

const team = (...ids) => ({ players: ids.map((id) => ({ id, name: id })), displayName: ids.join(" & ") });
const t = (key, values = {}) => `${key}${values.count != null ? `:${values.count}` : ""}`;

test("Kamper leads with the current matches, then the next ones, then the finished ones (4.4)", () => {
  const sections = [];
  const document = { createElement: () => { const section = { innerHTML: "", className: "", children: [], append: (...cards) => section.children.push(...cards) }; return section; } };
  const container = { innerHTML: "", append: (section) => sections.push(section) };
  const { PadelstarMatchList } = load("match-list.js");
  const list = PadelstarMatchList.create({ appendEmptyText: () => {}, document, t });
  const matches = [
    { id: "w1", state: "waiting" }, { id: "f1", state: "finished" }, { id: "p1", state: "playing" }, { id: "a1", state: "awaitingApproval" },
  ];
  list.renderGroupedMatches(container, matches, "", (match) => match.id, { byStatus: true });
  assert.deepEqual(sections.map((section) => section.className), ["match-group match-group-current", "match-group match-group-next", "match-group"]);
  assert.match(sections[0].innerHTML, /matches\.current</);
  assert.deepEqual(sections[0].children, ["p1", "a1"], "playing and awaiting approval are both current");
  assert.deepEqual(sections[1].children, ["w1"]);
  sections.length = 0;
  list.renderGroupedMatches(container, [matches[2]], "", (match) => match.id, { byStatus: true });
  assert.match(sections[0].innerHTML, /matches\.currentOne</, "one court: 'Nåværende kamp'");
  sections.length = 0;
  list.renderGroupedMatches(container, matches, "", (match) => match.id);
  assert.equal(sections.length, 4, "the player's own match list keeps its detailed groups");
});

test("the fourth item is Tabell for Round Robin and Cup (the bracket, no table) for Cup (4.5)", () => {
  const labels = [{ dataset: { i18n: "common.standings" }, textContent: "" }, { dataset: { i18n: "common.standings" }, textContent: "" }];
  const box = () => ({ innerHTML: "", hidden: false, classList: { toggle(name, on) { this.owner.hidden = on; } } });
  const elements = { cupBracket: box(), playerCupBracket: box(), ownerStandingsList: box(), playerStandingsList: box() };
  Object.values(elements).forEach((element) => { element.classList.owner = element; });
  const state = { settings: { format: "roundRobin" }, cup: null };
  const { PadelstarCupBracket } = load("cup-bracket.js");
  const bracket = PadelstarCupBracket.create({ document: { querySelectorAll: () => labels }, elements, escapeHtml: String, getMatchById: () => null, getState: () => state, matchStateText: String, t });
  bracket.renderCupBracket();
  assert.ok(labels.every((label) => label.dataset.i18n === "common.standings"));
  assert.equal(elements.ownerStandingsList.hidden, false);
  assert.equal(elements.cupBracket.hidden, true);
  state.settings.format = "cup";
  state.cup = { bracket: { bracketSize: 4, rounds: [{ roundNumber: 1, slots: [{ type: "pending" }] }] } };
  bracket.renderCupBracket();
  assert.ok(labels.every((label) => label.dataset.i18n === "admin.cupFormat" && label.textContent === "admin.cupFormat"));
  assert.equal(elements.ownerStandingsList.hidden, true, "no table in a cup");
  assert.equal(elements.playerStandingsList.hidden, true);
  assert.equal(elements.cupBracket.hidden, false);
  assert.match(elements.playerCupBracket.innerHTML, /cup-bracket-rounds/, "players see the bracket too");
});

test("Spillere lists players in a match first, then the ones up next, withdrawn last (4.3)", () => {
  const rows = [];
  const node = () => ({ innerHTML: "", className: "", setAttribute() {}, append() {}, querySelector: () => ({ addEventListener() {} }) });
  const elements = { playersList: { innerHTML: "", append: (item) => rows.push(item) } };
  const players = ["idle", "later", "next", "playing", "out"].map((id) => ({ id, name: id, active: true }));
  players[4].withdrawn = true;
  const state = { rounds: [{}], players, courts: [{ id: "c1" }], inviteCode: "X" };
  const matches = [
    { state: "playing", teamOne: team("playing"), teamTwo: team("z") },
    { state: "waiting", queuePosition: 2, teamOne: team("later"), teamTwo: team("z") },
    { state: "waiting", queuePosition: 1, teamOne: team("next"), teamTwo: team("z") },
  ];
  const { PadelstarPlayerList } = load("player-list.js");
  PadelstarPlayerList.create({
    accentStyle: () => "", avatarMarkup: () => "", document: { createElement: node }, elements, escapeAttribute: String, escapeHtml: String,
    getState: () => state, getAllMatches: () => matches, leaderboardEntries: () => [], playerStatusLabel: () => "", t,
  }).renderPlayers();
  const order = rows.map((row) => row.innerHTML.match(/player-name-badge">([a-z]+)</)[1]);
  assert.deepEqual(order, ["playing", "next", "later", "idle", "out"]);
  assert.match(rows[1].innerHTML, /next-match-chip">matches\.nextUp/);
  assert.doesNotMatch(rows[0].innerHTML, /next-match-chip/);
});

test("TV Mode is hidden and ignored on phones, kept on tablets and computers (1.3)", () => {
  const css = read("styles", "workspace-nav.css");
  const block = css.slice(css.indexOf("@media (max-width: 599.98px), (pointer: coarse) and (max-height: 499.98px)"));
  assert.match(block, /#tvModeMenuButton,\s*#tvModeRailButton,\s*#tvModeBottomButton,\s*\[data-action="tv-mode"\] \{\s*display: none !important;/);
  const app = read("app", "app.js");
  assert.match(app, /const phoneScreenQuery = "\(max-width: 599\.98px\), \(pointer: coarse\) and \(max-height: 499\.98px\)";/);
  assert.match(app, /toggleTvModeFromMenu: \(\) => \{\s*if \(!hasActiveTournament\(\) \|\| isPhoneScreen\(\)\) return;/);
});

test("admin modules stay admin-only: the rail and tabs only show for an admin, and the routing checks the role (6.2)", () => {
  const rail = read("app", "workspace-rail.js");
  assert.match(rail, /const showRail = !adminHidden;/, "rail and bottom tabs follow the admin link, which follows the role");
  const routing = read("app", "module-routing.js");
  assert.match(routing, /requestedModule === "admin"\) return isCurrentUserAdmin\(\) \? "admin" : fallbackTournamentModule\(\)/);
  const navigation = read("app", "workspace-navigation.js");
  assert.match(navigation, /const isAdmin = deps\.isCurrentUserAdmin\(\) && !deps\.getSpectatorMode\(\);/);
  assert.match(navigation, /const requested = panel === "control" \? "lobby" : panel;/, "older callers asking for Styring land in the lobby");
  const html = read("index.html");
  const player = html.slice(html.indexOf('data-section="player"'), html.indexOf('id="workspaceBottomTabs"'));
  for (const id of ["resetTournamentButton", "tournamentSettingsForm", "playersList", "adminMatches", "shareTournamentButton"]) {
    assert.doesNotMatch(player, new RegExp(`id="${id}"`), `${id} stays out of the player view`);
  }
});
