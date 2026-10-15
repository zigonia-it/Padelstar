const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ignored = fs.readFileSync(path.join(root, ".vercelignore"), "utf8")
  .split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));

test(".vercelignore keeps every asset the live site loads", () => {
  const served = ["index.html", "admin.html", "guide.html", "privacy.html", "tv.html", "service-worker.js", "manifest.webmanifest"];
  for (const dir of ["app", "styles"]) {
    for (const file of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      if (/\.(js|css)$/.test(file)) served.push(path.join(dir, file));
    }
  }
  const dirs = ignored.filter((entry) => !entry.includes("*") && !entry.includes("."));
  for (const file of served) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const ref of source.match(/assets\/[\w./-]+\.(png|jpe?g|webp|svg|gif|ico)/g) || []) {
      assert.ok(!dirs.some((dir) => ref.startsWith(`${dir}/`)), `${file} loads ${ref}, which .vercelignore excludes`);
      assert.ok(fs.existsSync(path.join(root, ref)), `${file} loads missing ${ref}`);
    }
  }
});

test(".vercelignore never excludes app code, styles, api or pages", () => {
  for (const entry of ignored) {
    assert.ok(!/^(app|styles|api|assets\/(icons|photos|brand|ui|avatars))(\/|$)/.test(entry), entry);
    assert.ok(!/\.(html|js|css|json|webmanifest)$/.test(entry), entry);
  }
});
