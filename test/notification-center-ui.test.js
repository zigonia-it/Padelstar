const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = { console };
context.window = context;
vm.createContext(context);
for (const file of ["notification-center.js", "notification-center-ui.js"]) vm.runInContext(fs.readFileSync(path.join(root, "app", file), "utf8"), context);

function element() {
  const node = { hidden: false, handlers: {}, children: [], attrs: {}, dataset: {}, checked: true, disabled: false, textContent: "", innerHTML: "", open: false,
    classList: { set: new Set(["hidden"]), toggle(name, on) { on ? this.set.add(name) : this.set.delete(name); }, contains(name) { return this.set.has(name); } },
    addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute(name, value) { this.attrs[name] = value; },
    append(...items) { this.children.push(...items); }, showModal() { this.open = true; }, close() { this.open = false; } };
  return node;
}
function fakeDocument() {
  const nodes = Object.fromEntries(["#notificationBellButton", "#notificationBellBadge", "#notificationCenterDialog", "#notificationCenterList", "#notificationMarkAllRead", "#notificationCenterClose"].map((id) => [id, element()]));
  return { nodes, createElement: () => Object.assign(element(), { classList: element().classList }), querySelector: (selector) => nodes[selector] ?? null };
}
function memory() { const data = {}; return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } }; }

const ME = "p-me";
const team = (...ids) => ({ displayName: ids.join(" & "), players: ids.map((id) => ({ id, name: id })) });
const state = (matchState, extra = {}) => ({ id: "t1", selectedPlayerId: ME, status: "Runde pågår", rounds: [{ matches: [{ id: "m1", state: matchState, courtName: "Bane 1", teamOne: team(ME, "mate"), teamTwo: team("a", "b"), ...extra }] }] });

function build({ spectator = false } = {}) {
  const doc = fakeDocument();
  const buzzed = [];
  const toasts = [];
  let current = state("waiting");
  const ui = context.PadelstarNotificationCenterUi.create({
    document: doc, storage: memory(), getState: () => current, isSpectator: () => spectator, t: (key, values = {}) => `${key}${Object.keys(values).length ? `:${Object.values(values).join("/")}` : ""}`,
    showToast: (message) => toasts.push(message), showModule: () => {}, vibrate: (n) => buzzed.push(n),
  });
  ui.bind();
  return { ui, doc, buzzed, toasts, setState: (next) => { current = next; } };
}

test("a ready match vibrates with pattern 1, toasts, and shows an unread badge on the bell", () => {
  const { ui, doc, buzzed, toasts, setState } = build();
  assert.equal(doc.nodes["#notificationBellButton"].classList.contains("hidden"), false, "the bell shows for a player");
  const before = state("waiting");
  const after = state("playing");
  setState(after);
  const fresh = ui.handleStateChange(before, after);
  assert.equal(fresh.length, 1);
  assert.deepEqual(buzzed, [1]);
  assert.match(toasts[0], /notifications\.center\.matchReady\.title/);
  ui.render();
  assert.equal(doc.nodes["#notificationBellBadge"].textContent, "1");
  assert.equal(doc.nodes["#notificationBellBadge"].classList.contains("hidden"), false);
});

test("another update vibrates with pattern 2; nothing repeats for the same event", () => {
  const { ui, buzzed, setState } = build();
  const before = state("playing");
  const after = state("awaitingApproval", { approval: { status: "pending", submittedAt: "s1", approvals: [{ teamIndex: 1 }] } });
  setState(after);
  assert.equal(ui.handleStateChange(before, after).length, 1);
  assert.equal(ui.handleStateChange(before, after).length, 0, "already stored");
  assert.deepEqual(buzzed, [2]);
});

test("spectators are never notified", () => {
  const spectator = build({ spectator: true });
  assert.equal(spectator.ui.handleStateChange(state("waiting"), state("playing")).length, 0);
  assert.equal(spectator.doc.nodes["#notificationBellButton"].classList.contains("hidden"), true, "no bell for spectators");
});

test("opening the center lists items; clicking one marks it read, mark-all clears the badge", () => {
  const { ui, doc } = build();
  ui.handleStateChange(state("waiting"), state("playing"));
  ui.handleStateChange(state("playing"), state("finished", { correctionHistory: [{ at: "x" }] }));
  ui.open();
  assert.equal(doc.nodes["#notificationCenterDialog"].open, true);
  assert.equal(doc.nodes["#notificationCenterList"].children.length, 2);
  assert.equal(doc.nodes["#notificationMarkAllRead"].disabled, false);
  const first = doc.nodes["#notificationCenterList"].children[0].children[0];
  first.handlers.click();
  assert.equal(ui.store.unreadCount("t1", ME), 1);
  doc.nodes["#notificationMarkAllRead"].handlers.click();
  assert.equal(ui.store.unreadCount("t1", ME), 0);
  assert.equal(doc.nodes["#notificationBellBadge"].classList.contains("hidden"), true);
});

test("a notification error never breaks state syncing", () => {
  const { ui } = build();
  assert.equal(ui.handleStateChange({ id: "t1", rounds: "not-a-list" }, null).length, 0);
});

test("the bell, dialog, script and styles are in the page and precached", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of ["notificationBellButton", "notificationBellBadge", "notificationCenterDialog", "notificationCenterList", "notificationMarkAllRead", "notificationCenterClose"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /app\/notification-center-ui\.js\?v=padelstar-notification-center-\d+/);
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  for (const file of ["app/notification-center.js", "app/notification-center-ui.js", "styles/notification-center.css"]) assert.ok(worker.includes(`./${file}`), file);
  assert.match(fs.readFileSync(path.join(root, "app", "core", "remote-state-controller.js"), "utf8"), /onRemoteStateApplied\?\.\(state, nextState/);
});

function withSettings(supported) {
  const doc = fakeDocument();
  for (const id of ["#notificationSettingsVibration", "#notificationSettingsVibrationHint"]) doc.nodes[id] = element();
  const buzzed = [];
  const mem = memory();
  const ui = context.PadelstarNotificationCenterUi.create({
    document: doc, storage: mem, getState: () => state("waiting"), isSpectator: () => false, t: (key) => key, showToast: () => {}, showModule: () => {},
    vibrate: (n) => buzzed.push(n),
  });
  context.navigator = supported ? { vibrate: () => true } : {};
  ui.bind();
  return { ui, doc, buzzed, mem };
}

test("the profile switch turns vibration off, and a real notification follows it; no sound controls remain", () => {
  const { doc, buzzed, mem, ui } = withSettings(true);
  const s = doc.nodes;
  assert.equal(s["#notificationSettingsVibration"].checked, true);
  ui.handleStateChange(state("waiting"), state("playing"));
  assert.equal(buzzed.length, 1);
  s["#notificationSettingsVibration"].checked = false;
  s["#notificationSettingsVibration"].handlers.change();
  assert.equal(mem.getItem("padelstar-vibration"), "off");
  ui.handleStateChange(state("playing"), state("finished", { correctionHistory: [{ at: "x" }] }));
  assert.equal(buzzed.length, 1, "vibration stays off");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of ["notificationSettingsSound", "notificationSoundToggle", "notificationSettingsTest"]) assert.doesNotMatch(html, new RegExp(`id="${id}"`), id);
});

test("on a device without vibration the switch is disabled and explained", () => {
  const { doc } = withSettings(false);
  assert.equal(doc.nodes["#notificationSettingsVibration"].disabled, true);
  assert.equal(doc.nodes["#notificationSettingsVibration"].checked, false);
  assert.equal(doc.nodes["#notificationSettingsVibrationHint"].classList.contains("hidden"), false);
});

test("the selections are toggle switches (role=switch), not plain check marks", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of ["notificationSettingsVibration"]) {
    assert.match(html, new RegExp(`<input type="checkbox" role="switch" class="switch" id="${id}"`), id);
  }
  const css = fs.readFileSync(path.join(root, "styles", "notification-center.css"), "utf8");
  assert.match(css, /input\.switch\s*\{[^}]*appearance:\s*none/);
  assert.match(css, /input\.switch:checked::after/);
  const switchCss = css.slice(css.indexOf("/* Toggle switches"), css.indexOf("prefers-reduced-motion"));
  assert.match(switchCss, /var\(--ui-blue-soft/, "the switch accent is the same blue as the eyebrow text (\"Denne enheten\")");
  assert.doesNotMatch(switchCss, /--gold-bright/);
});
