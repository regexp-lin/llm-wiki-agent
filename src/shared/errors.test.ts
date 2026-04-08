import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WikiError, WikiErrorCode } from "./errors.js";

describe("WikiError", () => {
  it("has correct properties", () => {
    const error = new WikiError("test error", WikiErrorCode.FILE_NOT_FOUND, { path: "/test" });
    assert.equal(error.message, "test error");
    assert.equal(error.code, WikiErrorCode.FILE_NOT_FOUND);
    assert.deepEqual(error.details, { path: "/test" });
    assert.equal(error.name, "WikiError");
  });

  it("is instanceof Error", () => {
    const error = new WikiError("test", WikiErrorCode.API_ERROR);
    assert.ok(error instanceof Error);
    assert.ok(error instanceof WikiError);
  });

  it("works without details", () => {
    const error = new WikiError("test", WikiErrorCode.WIKI_EMPTY);
    assert.equal(error.details, undefined);
  });
});
