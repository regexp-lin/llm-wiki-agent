import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sha256Full, sha256Short } from "./crypto-utils.js";

describe("sha256Full", () => {
  it("returns 64 character hex string", () => {
    const hash = sha256Full("hello");
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    assert.equal(sha256Full("test"), sha256Full("test"));
  });

  it("produces different hashes for different inputs", () => {
    assert.notEqual(sha256Full("a"), sha256Full("b"));
  });
});

describe("sha256Short", () => {
  it("returns 16 character hex string", () => {
    const hash = sha256Short("hello");
    assert.equal(hash.length, 16);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it("is prefix of sha256Full", () => {
    const full = sha256Full("test");
    const short = sha256Short("test");
    assert.equal(full.slice(0, 16), short);
  });
});
