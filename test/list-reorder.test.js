// Standings reorder (2026-10-10): rows slide from their old place to their new one, matched by player id, a row that
// climbed is marked, a changed points value ticks, and nothing moves on a list's first paint.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function fakeElement(textContent = "") {
  const classes = new Set();
  return {
    textContent,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), has: (name) => classes.has(name) },
    addEventListener() {}, removeEventListener() {},
  };
}

function fakeRow(key, top, points) {
  const row = fakeElement();
  row.dataset = { reorderKey: key };
  row.top = top;
  row.points = fakeElement(points);
  row.animations = [];
  row.getBoundingClientRect = () => ({ top: row.top, height: 40 });
  row.querySelector = () => row.points;
  row.animate = (frames) => row.animations.push(frames);
  return row;
}

function load() {
  const context = {
    console,
    Element: { prototype: { animate() {} } },
    document: { documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    matchMedia: () => ({ matches: false }),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("app/list-reorder.js"), context, { filename: "list-reorder.js" });
  return context.PadelstarListReorder;
}

test("a row that moved slides from its old place, a climber is marked and changed points tick", () => {
  const reorder = load();
  let rows = [fakeRow("ada", 0, "3"), fakeRow("bo", 40, "1")];
  const container = { querySelectorAll: () => rows };
  reorder.rebuild(container, () => {
    rows = [fakeRow("bo", 0, "4"), fakeRow("ada", 40, "3")];
  }, { pointsSelector: "strong" });
  const [bo, ada] = rows;
  assert.equal(bo.animations.length, 1);
  assert.equal(bo.animations[0][0].transform, "translateY(40px)");
  assert.equal(ada.animations[0][0].transform, "translateY(-40px)");
  assert.ok(bo.classList.has("is-climbing"));
  assert.ok(!ada.classList.has("is-climbing"));
  assert.ok(bo.points.classList.has("is-ticking"));
  assert.ok(!ada.points.classList.has("is-ticking"));
});

test("the first paint of a list does not move", () => {
  const reorder = load();
  let rows = [];
  const container = { querySelectorAll: () => rows };
  reorder.rebuild(container, () => { rows = [fakeRow("ada", 0, "3")]; }, { pointsSelector: "strong" });
  assert.equal(rows[0].animations.length, 0);
  assert.ok(!rows[0].points.classList.has("is-ticking"));
});

test("app and TV standings rows carry a stable key and both pages load the helper", () => {
  assert.match(read("app/standings.js"), /dataset\.reorderKey = entry\.player\.id/);
  assert.match(read("app/tv-mode.js"), /data-reorder-key="\$\{escapeHtml\(entry\.player\.id/);
  for (const page of ["index.html", "tv.html", "service-worker.js"]) assert.match(read(page), /app\/list-reorder\.js\?v=/, page);
});
