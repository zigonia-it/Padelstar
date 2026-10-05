// Motion tokens (2026-10-05): one set of durations and easings in styles/tokens.css, with a reduced-motion layer
// that removes movement and scale so rules built from the tokens degrade to a crossfade. Spec: docs/technical/motion.md.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const tokens = fs.readFileSync(path.join(__dirname, "..", "styles", "tokens.css"), "utf8");
const motionStart = tokens.indexOf("MOTION TOKENS");
const reducedStart = tokens.indexOf("@media (prefers-reduced-motion: reduce)", motionStart);
const declarations = (css) => Object.fromEntries([...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
const motion = declarations(tokens.slice(motionStart, reducedStart));
const reduced = declarations(tokens.slice(reducedStart));

test("tokens.css defines the motion durations, easings, distances and scales", () => {
  assert.ok(motionStart > 0 && reducedStart > motionStart, "motion block and its reduced-motion layer exist");
  for (const name of ["--motion-instant", "--motion-quick", "--motion-base", "--motion-slow", "--motion-celebrate", "--motion-pulse", "--motion-stagger"]) {
    assert.match(motion[name] ?? "", /^\d+(\.\d+)?m?s$/, `${name} is a duration`);
  }
  for (const name of ["--ease-standard", "--ease-out", "--ease-in", "--ease-pop"]) assert.match(motion[name] ?? "", /^cubic-bezier\(/, `${name} is an easing`);
  const ms = (value) => value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
  const ladder = ["--motion-instant", "--motion-quick", "--motion-base", "--motion-slow", "--motion-celebrate"].map((name) => ms(motion[name]));
  assert.deepEqual([...ladder].sort((a, b) => a - b), ladder, "durations grow from instant to celebrate");
  assert.ok(ms(motion["--motion-slow"]) <= 400, "nothing a person waits on runs longer than 400ms");
});

test("reduced motion keeps no movement, scale, overshoot or stagger", () => {
  assert.equal(reduced["--motion-distance-sm"], "0px");
  assert.equal(reduced["--motion-distance-md"], "0px");
  assert.equal(reduced["--motion-scale-press"], "1");
  assert.equal(reduced["--motion-scale-pop"], "1");
  assert.equal(reduced["--motion-stagger"], "0ms");
  assert.equal(reduced["--ease-pop"], "var(--ease-out)");
});
