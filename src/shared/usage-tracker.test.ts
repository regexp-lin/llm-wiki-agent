import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { usageTracker } from "./usage-tracker.js";

describe("usageTracker", () => {
  beforeEach(() => {
    usageTracker.reset();
  });

  it("tracks API usage", () => {
    usageTracker.record("claude-sonnet-4-6", 1000, 500, "ingest");
    const summary = usageTracker.getSummary();
    assert.equal(summary.callCount, 1);
    assert.equal(summary.totalInputTokens, 1000);
    assert.equal(summary.totalOutputTokens, 500);
  });

  it("accumulates multiple calls", () => {
    usageTracker.record("claude-sonnet-4-6", 1000, 500, "ingest");
    usageTracker.record("claude-haiku-4-5-20251001", 2000, 300, "graph");
    const summary = usageTracker.getSummary();
    assert.equal(summary.callCount, 2);
    assert.equal(summary.totalInputTokens, 3000);
    assert.equal(summary.totalOutputTokens, 800);
  });

  it("estimates cost", () => {
    usageTracker.record("claude-sonnet-4-6", 1000, 500, "ingest");
    const summary = usageTracker.getSummary();
    assert.ok(summary.estimatedCostUsd > 0);
  });

  it("resets properly", () => {
    usageTracker.record("claude-sonnet-4-6", 1000, 500, "ingest");
    usageTracker.reset();
    const summary = usageTracker.getSummary();
    assert.equal(summary.callCount, 0);
    assert.equal(summary.totalInputTokens, 0);
  });
});
