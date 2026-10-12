// A blocked or deleted account: the app drops the session the server ended, says why, and the system owner finds users by name.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const context = { console, document: { documentElement: { lang: "nb" }, querySelector: () => null } };
context.window = context;
vm.createContext(context);
vm.runInContext(read("app", "account-auth.js"), context);
vm.runInContext(read("app", "system-admin.js"), context);
const { create } = context.PadelstarAccountAuth;
const admin = context.PadelstarSystemAdmin;

function setup(auth) {
  const notice = { textContent: "", classList: { toggle() {} } };
  const signOuts = [];
  const client = { auth: { ...auth, signOut: async (options) => { signOuts.push(options); return { error: null }; } } };
  const accountAuth = create({ getClient: () => client, getElements: () => ({ accountAuthNotice: notice }), translate: (key) => key });
  return { accountAuth, notice, signOuts };
}

test("a session the server ended (blocked or deleted account) is dropped locally with a message", async () => {
  for (const code of ["session_not_found", "user_not_found", "user_banned"]) {
    const { accountAuth, notice, signOuts } = setup({ getUser: async () => ({ data: { user: null }, error: { code, status: 403 } }) });
    assert.equal(await accountAuth.refresh(), null);
    assert.deepEqual(JSON.parse(JSON.stringify(signOuts)), [{ scope: "local" }], code);
    assert.equal(notice.textContent, code === "user_banned" ? "account.authBlocked" : "account.authSessionEnded");
  }
});

test("a network failure or a plain signed-out state keeps the stored session and says nothing", async () => {
  for (const error of [null, { code: undefined, status: 0, name: "AuthRetryableFetchError" }]) {
    const { accountAuth, notice, signOuts } = setup({ getUser: async () => ({ data: { user: null }, error }) });
    await accountAuth.refresh();
    assert.equal(signOuts.length, 0);
    assert.equal(notice.textContent, "");
  }
});

test("signing in to a blocked account says the account is blocked, not that the password is wrong", async () => {
  const run = async (code) => {
    const { accountAuth, notice } = setup({ signInWithPassword: async () => ({ data: null, error: { code, status: 400 } }) });
    const form = { elements: { email: { value: "a@b.no" }, password: { value: "x" } }, querySelector: () => null };
    assert.equal(await accountAuth.signIn({ preventDefault() {}, currentTarget: form }), false);
    return notice.textContent;
  };
  assert.equal(await run("user_banned"), "account.authBlocked");
  assert.equal(await run("invalid_credentials"), "account.authFailed");
});

test("every language has the two new account messages", () => {
  const source = read("app", "translations.js");
  for (const key of ["account.authBlocked", "account.authSessionEnded"]) {
    assert.equal(source.split(`"${key}"`).length - 1, 8, `${key} in nb, nn, en, es, de, fr, sv, da`);
  }
});

test("the user list shows the profile name, and block/delete confirmations name the person", () => {
  const t = admin.TEXT.nb;
  const html = admin.renderUserList({ total: 1, limit: 25, offset: 0, rows: [{ id: "u1", email: "vera@example.com", display_name: "Vera <b>Offer</b>", blocked: false }] }, t);
  assert.match(html, /Vera &lt;b&gt;Offer&lt;\/b&gt;/, "the name is shown, escaped");
  assert.match(html, /data-user-email="vera@example.com \(Vera &lt;b&gt;Offer&lt;\/b&gt;\)"/);
  assert.match(t.searchUsers, /navn/);
});

test("the request guard migration refuses blocked and deleted accounts before every API request", () => {
  const sql = read("supabase", "migrations", "20261012100000_blocked_account_request_guard.sql");
  assert.match(sql, /alter role authenticator set pgrst\.db_pre_request = ''public\.check_account_access''/);
  assert.match(sql, /banned_until is null or u\.banned_until <= now\(\)/);
  assert.match(sql, /errcode = '42501'/);
  assert.match(sql, /notify pgrst, 'reload config'/);
});
