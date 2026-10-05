// The home join card (Padelstar 1.0): a code or a whole join link opens the join form with the code filled in.
const assert = require("node:assert/strict");
const test = require("node:test");
require("../app/home-join.js");

const join = globalThis.PadelstarHomeJoin;

test("parseJoinCode accepts a bare code, any case, with separators", () => {
  assert.equal(join.codeLength, 8);
  assert.equal(join.parseJoinCode("ABCD1234"), "ABCD1234");
  assert.equal(join.parseJoinCode(" abcd-1234 "), "ABCD1234");
  assert.equal(join.parseJoinCode("abcd 1234"), "ABCD1234");
});

test("parseJoinCode reads the code out of a pasted join link", () => {
  assert.equal(join.parseJoinCode("https://padelstar.app/?join=ABCD1234"), "ABCD1234");
  assert.equal(join.parseJoinCode("https://padelstar.app/?lang=nb&code=wxyz9876#top"), "WXYZ9876");
});

test("parseJoinCode rejects anything that is not exactly eight characters", () => {
  for (const input of ["", null, undefined, "ABC123", "ABCD12345", "https://padelstar.app/", "æøå"]) {
    assert.equal(join.parseJoinCode(input), "", String(input));
  }
});
