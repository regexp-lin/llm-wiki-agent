import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fitPagesIntoBudget } from "./context-manager.js";

describe("fitPagesIntoBudget", () => {
  it("fits all pages when within budget", () => {
    const pages = [
      { path: "a.md", content: "short" },
      { path: "b.md", content: "also short" },
    ];
    const result = fitPagesIntoBudget(pages, {
      maxTotalTokens: 1000,
      reservedForOutput: 0,
      reservedForPromptFrame: 0,
    });
    assert.equal(result.length, 2);
    assert.ok(result.every((r) => !r.truncated));
  });

  it("truncates pages exceeding budget", () => {
    const longContent = "a".repeat(5000);
    const pages = [{ path: "long.md", content: longContent }];
    const result = fitPagesIntoBudget(pages, {
      maxTotalTokens: 500,
      reservedForOutput: 0,
      reservedForPromptFrame: 0,
    });
    assert.equal(result.length, 1);
    assert.ok(result[0]!.truncated);
    assert.ok(result[0]!.content.length < longContent.length);
  });

  it("truncates later pages when budget is tight", () => {
    const pages = [
      { path: "a.md", content: "x".repeat(1000) },
      { path: "b.md", content: "y".repeat(1000) },
      { path: "c.md", content: "z".repeat(1000) },
    ];
    const result = fitPagesIntoBudget(pages, {
      maxTotalTokens: 600,
      reservedForOutput: 0,
      reservedForPromptFrame: 0,
    });
    assert.equal(result.length, 3);
    assert.ok(result[2]!.truncated);
  });

  it("drops pages entirely when no budget remains", () => {
    const pages = [
      { path: "a.md", content: "x".repeat(2000) },
      { path: "b.md", content: "y".repeat(2000) },
    ];
    const result = fitPagesIntoBudget(pages, {
      maxTotalTokens: 300,
      reservedForOutput: 0,
      reservedForPromptFrame: 0,
    });
    assert.equal(result.length, 1);
    assert.ok(result[0]!.truncated);
  });

  it("handles empty pages array", () => {
    const result = fitPagesIntoBudget([]);
    assert.equal(result.length, 0);
  });
});
