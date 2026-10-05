// The colour system (2026-09-20): one token set (styles/tokens.css), two themes, no colour literals in components.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const tokens = read("styles", "tokens.css");

function block(selector) {
  const start = tokens.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block exists`);
  const body = tokens.slice(start, tokens.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
}
const dark = block(":root");
const light = block('[data-theme="light"]');

// Padelstar 1.0 design system (claude.ai "Padelstar" design-system artifact, tokens.json): Floodlight (:root, dark)
// and Daylight ([data-theme=light]). Legacy names stay as aliases onto the new roles so the older layers follow.
const DARK = {
  "--surface-page": "#0b0b0b", "--surface-card": "#171717", "--surface-raised": "#222222", "--surface-sunken": "#2a2a2a",
  "--surface-inverse": "#f5f4f0", "--on-inverse": "#0b0b0b",
  "--ink-heading": "#f5f4f0", "--ink-body": "#cfccc4", "--ink-muted": "#9b988f", "--ink-faint": "#9b988f", "--ink-disabled": "#5b5953",
  "--ball": "#dcf55a", "--on-ball": "#0b0b0b", "--ball-text": "#dcf55a",
  "--live": "#ff6b78", "--court": "#8fb8f2", "--positive": "#6fe0a4", "--negative": "#ff6b78", "--warning": "#f2c14e",
  "--focus-ring": "#dcf55a", "--border-control": "#6e6b64",
  "--accent-blue": "#dcf55a", "--accent-cyan": "#8fb8f2", "--btn-primary-from": "#dcf55a", "--btn-primary-to": "#dcf55a", "--btn-primary-ink": "#0b0b0b",
};
const LIGHT = {
  "--surface-page": "#f4f1ea", "--surface-card": "#ffffff", "--surface-raised": "#fbfaf6", "--surface-sunken": "#eae6dc",
  "--surface-inverse": "#141414", "--on-inverse": "#ffffff",
  "--ink-heading": "#141414", "--ink-body": "#3b3a36", "--ink-muted": "#66645c", "--ink-faint": "#66645c", "--ink-disabled": "#8f8c82",
  "--ball": "#d7f34a", "--on-ball": "#141414", "--ball-text": "#4a5a0a",
  "--live": "#c4162a", "--court": "#1d4f91", "--positive": "#1c7445", "--negative": "#c4162a", "--warning": "#7a5600",
  "--focus-ring": "#141414", "--border-control": "#8a877d",
  "--accent-blue": "#4a5a0a", "--accent-cyan": "#1d4f91", "--btn-primary-from": "#d7f34a", "--btn-primary-to": "#d7f34a", "--btn-primary-ink": "#141414",
};

test("tokens.css holds exactly the specified values for the dark theme (:root) and the light theme ([data-theme=light])", () => {
  for (const [name, value] of Object.entries(DARK)) assert.equal(dark[name], value, `dark ${name}`);
  for (const [name, value] of Object.entries(LIGHT)) assert.equal(light[name], value, `light ${name}`);
  assert.equal(dark["color-scheme"] ?? tokens.match(/:root \{\s*color-scheme:\s*(\w+)/)?.[1], "dark");
  assert.match(tokens, /\[data-theme="light"\] \{\s*color-scheme: light;/);
});

test("the two themes are tuned separately: light is not an inversion, and cards stay white", () => {
  assert.equal(LIGHT["--surface-card"], "#ffffff");
  assert.notEqual(LIGHT["--surface-page"], "#ffffff", "the page does the darkening, not the cards");
  assert.notEqual(DARK["--ball"], LIGHT["--ball"], "the ball is tuned per ground");
  assert.notEqual(DARK["--ball-text"], LIGHT["--ball-text"], "on a light ground the accent as text is a deep olive, never the fill");
  assert.ok(lum(DARK["--surface-card"]) > lum(DARK["--surface-page"]), "on dark, cards are lighter than the page");
});

function lum(hex) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("contrast floor: text tokens 4.5:1 on every surface, headline-scale accents 3:1, in both themes", () => {
  for (const [theme, set] of [["dark", DARK], ["light", LIGHT]]) {
    for (const surface of ["--surface-page", "--surface-card", "--surface-raised", "--surface-sunken"]) {
      for (const ink of ["--ink-heading", "--ink-body", "--ink-muted", "--ink-faint", "--positive", "--negative", "--warning", "--live", "--ball-text", "--accent-blue"]) {
        assert.ok(contrast(set[ink], set[surface]) >= 4.5, `${theme}: ${ink} on ${surface} = ${contrast(set[ink], set[surface]).toFixed(2)}`);
      }
      assert.ok(contrast(set["--court"], set[surface]) >= 3, `${theme}: --court (tag scale) on ${surface}`);
    }
    assert.ok(contrast(set["--on-ball"], set["--ball"]) >= 4.5, `${theme}: text on the ball`);
    assert.ok(contrast(set["--on-inverse"], set["--surface-inverse"]) >= 4.5, `${theme}: text on the inverse card`);
    assert.ok(contrast(set["--focus-ring"], set["--surface-page"]) >= 3, `${theme}: focus ring visible on the page`);
  }
  assert.match(tokens, /:root \{[^}]*--accent-text:\s*var\(--ball-text\)/);
  assert.match(tokens, /\[data-theme="light"\] \{[^}]*--accent-text:\s*var\(--ball-text\)/);
});

test("the primary button is the ball: solid fill, ink 4.5:1 on it in both themes", () => {
  for (const set of [DARK, LIGHT]) {
    assert.equal(set["--btn-primary-from"], set["--ball"]);
    assert.equal(set["--btn-primary-to"], set["--ball"]);
    assert.equal(set["--btn-primary-ink"], set["--on-ball"]);
    assert.ok(contrast(set["--btn-primary-ink"], set["--btn-primary-from"]) >= 4.5);
  }
});

test("the primary shadow is themed (a tight deep one on light, the wide glow on dark) and every primary button uses it", () => {
  assert.notEqual(dark["--btn-primary-shadow"], light["--btn-primary-shadow"]);
  const css = ["components-v2.css", "components.css", "styles.css", "ui-consistency.css", "redesign.css"].map((f) => read("styles", f)).join("\n");
  assert.ok((css.match(/var\(--btn-primary-shadow\)/g) ?? []).length >= 5, "the primary buttons take their shadow from the token");
  assert.doesNotMatch(css, /\.ds-btn-primary \{[^}]*box-shadow: 0 10px 26px/, "no local glow on the primary button");
});

test("the classic overrides do not replace the primary gradient or shadow (the buttons a person actually sees)", () => {
  const css = read("styles", "ui-consistency.css");
  const primary = css.match(/body\[data-theme="classic"\] \.primary, body\[data-theme="classic"\] button\.primary \{[^}]*\}/)[0];
  assert.match(primary, /linear-gradient\(180deg, var\(--btn-primary-from\), var\(--btn-primary-to\)\)/);
  assert.match(primary, /box-shadow: var\(--btn-primary-shadow\)/);
  const landing = css.match(/body\[data-theme="classic"\] \.landing-cta:not\(\.landing-cta-secondary\) \{[^}]*\}/)[0];
  assert.match(landing, /var\(--btn-primary-from\), var\(--btn-primary-to\)/);
  assert.match(landing, /var\(--btn-primary-shadow\)/);
});

test("the accent ramp (blue into the logo's violet) fills progress bars; violet is never a text colour", () => {
  assert.match(read("styles", "components.css"), /\.progress-track span \{[^}]*background: var\(--ramp-accent\)/);
  assert.match(read("styles", "create-wizard.css"), /\.wizard-progress-bar\.is-active \{\s*background: var\(--ramp-accent\)/);
  const css = fs.readdirSync(path.join(root, "styles")).filter((f) => f.endsWith(".css") && f !== "tokens.css").map((f) => read("styles", f)).join("\n");
  assert.doesNotMatch(css, /(^|[^-])color:\s*var\(--(accent-violet|accent-violet-deep|chrome-[a-z]+)\)/m, "violet and chrome are not text colours");
});

test("components use tokens: no colour literal outside styles/tokens.css (scripts/color-audit.js)", () => {
  const { audit } = require("../scripts/color-audit.js");
  const found = audit();
  assert.deepEqual(found.map((f) => `${f.file}:${f.line} ${f.hits.join(" ")}`), []);
});

test("every stylesheet page loads tokens.css first, and the generated light layer is gone", () => {
  const styles = fs.readdirSync(path.join(root, "styles"));
  for (const gone of ["theme-light.css", "theme-light-manual.css", "tv-light.css", "tv-light-manual.css"]) assert.ok(!styles.includes(gone), `${gone} was removed`);
  assert.ok(!fs.existsSync(path.join(root, "scripts", "build-light-theme.js")));
  assert.match(read("app", "color-mode.js"), /setAttribute\?\.\("data-theme", mode\)/);
  assert.doesNotMatch(read("app", "color-mode.js"), /data-theme-mode/);
});

test("legacy variables are aliases of the tokens, so old rules follow the theme", () => {
  const base = read("styles", "base.css");
  for (const [legacy, token] of [["--ds-page", "--surface-page"], ["--ds-text", "--ink-heading"], ["--ds-border", "--border-default"], ["--gold", "--accent-blue"], ["--danger", "--negative"], ["--finished", "--positive"]]) {
    assert.match(base, new RegExp(`${legacy}:\\s*var\\(${token}\\)`), `${legacy} -> ${token}`);
  }
  assert.doesNotMatch(base, /--warning:\s*var\(--warning\)/, "no self-reference");
});

const accents = (() => { const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read("app", "accent-system.js"), ctx); return ctx.PadelstarAccentSystem; })();

test("the roster gem palette matches the design and comes from one helper: gemFill, gemInk, gemTint", () => {
  const expected = ["#1a59f2", "#e67a0a", "#148f42", "#d12e52", "#7030d1", "#0a8080", "#c70a33", "#b88c00", "#8a6a10", "#616b7a", "#9e560f", "#052e9e", "#0a7538", "#991020", "#8524b8", "#1f2126"];
  assert.deepEqual(JSON.parse(JSON.stringify(accents.accents.map((key) => accents.palette[key]))), expected);
  const hex = /^#[0-9a-f]{6}$/;
  for (const key of accents.accents) {
    const g = accents.gem(key);
    assert.equal(accents.gemFill(key), accents.palette[key], "the fill is the base hex in both themes");
    assert.equal(g.gemFill, accents.palette[key]);
    assert.match(g.gemInk.dark, hex); assert.match(g.gemInk.light, hex);
    assert.equal(accents.gemInk(key, "dark"), g.gemInk.dark);
    assert.equal(accents.gemInk(key, "light"), g.gemInk.light);
    const [r, gr, b] = [1, 3, 5].map((i) => parseInt(accents.palette[key].slice(i, i + 2), 16));
    assert.equal(accents.gemTint(key), `rgba(${r}, ${gr}, ${b}, 0.09)`);
  }
});

test("gem initials: lightened 45 % on dark, darkened 30 % on light; readable on the card of each theme", () => {
  let darkest = 99, lightest = 99;
  for (const key of accents.accents) {
    const base = accents.palette[key];
    const mixed = (target, amount) => `#${[1, 3, 5].map((i) => Math.round(parseInt(base.slice(i, i + 2), 16) + (target - parseInt(base.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, "0")).join("")}`;
    assert.equal(accents.gemInk(key, "dark"), mixed(255, 0.45), `${key} dark ink`);
    assert.equal(accents.gemInk(key, "light"), mixed(0, 0.3), `${key} light ink`);
    darkest = Math.min(darkest, contrast(accents.gemInk(key, "dark"), DARK["--surface-card"]));
    lightest = Math.min(lightest, contrast(accents.gemInk(key, "light"), LIGHT["--surface-card"]));
  }
  assert.ok(lightest >= 4.5, `light initials on white: worst ${lightest.toFixed(2)}`);
  assert.ok(darkest >= 3.5, `dark initials on the dark card: worst ${darkest.toFixed(2)} (the specified formula; the darkest hues are the limit)`);
});

test("accentStyle emits the gem variables and the ink switches with the theme (light-dark)", () => {
  const style = accents.accentStyle("blue");
  assert.match(style, /--gem-fill: #1a59f2;/);
  assert.match(style, /--gem-ink: light-dark\(#123ea9, #81a4f8\);/);
  assert.match(style, /--gem-tint: rgba\(26, 89, 242, 0\.09\);/);
  assert.match(style, /--player-accent: #1a59f2;/, "the existing variables are unchanged");
  const css = read("styles", "components-v2.css");
  assert.match(css, /\.ds-avatar-gem-inner \{[^}]*color: var\(--gem-ink/);
});

test("the header switch writes data-theme on <html> and the choice is remembered", () => {
  const html = read("index.html");
  assert.match(html, /class="theme-toggle"[\s\S]*data-theme-option="light"[\s\S]*data-theme-option="dark"/);
  const lib = (() => { const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read("app", "color-mode.js"), ctx); return ctx.PadelstarColorMode; })();
  const attrs = {}; const data = {};
  const document = { documentElement: { style: {}, setAttribute: (k, v) => { attrs[k] = v; } }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const mode = lib.create({ document, storage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } }, matchMedia: () => ({ matches: false }) });
  mode.bind();
  assert.equal(attrs["data-theme"], "dark");
  mode.setPreference("light");
  assert.equal(attrs["data-theme"], "light");
  assert.equal(data["padelstar-theme"], "light");
});
