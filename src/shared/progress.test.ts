import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProgressTracker } from "./progress.js";

describe("ProgressTracker", () => {
  it("can be instantiated and ticked", () => {
    const tracker = new ProgressTracker(3, "test");
    assert.doesNotThrow(() => {
      tracker.tick("item 1");
      tracker.tick("item 2");
      tracker.tick("item 3");
    });
  });

  it("works without item label", () => {
    const tracker = new ProgressTracker(1, "test");
    assert.doesNotThrow(() => {
      tracker.tick();
    });
  });
});
