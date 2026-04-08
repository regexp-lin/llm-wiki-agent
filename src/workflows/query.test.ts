import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findRelevantPages } from "./query.js";

const sampleIndex = `# Wiki Index

## Overview
- [Overview](overview.md) — living synthesis

## Sources
- [Architecture Guide](sources/architecture.md) — system architecture overview
- [Development Guide](sources/development-guide.md) — developer setup instructions
- [Error Codes Reference](sources/error-codes.md) — complete error code listing

## Entities
- [React](entities/React.md) — UI framework
- [Node.js](entities/NodeJs.md) — runtime environment
- [Vite](entities/Vite.md) — build tool

## Concepts
- [Material Registry](concepts/MaterialRegistry.md) — component registration
- [Host Contract](concepts/HostContract.md) — host integration API
`;

describe("findRelevantPages", () => {
  it("finds pages matching question keywords", () => {
    const result = findRelevantPages("What is the architecture?", sampleIndex);
    const hrefs = result.map((r) => r.href);
    assert.ok(hrefs.includes("sources/architecture.md"));
  });

  it("always includes overview", () => {
    const result = findRelevantPages("random question", sampleIndex);
    assert.ok(result.some((r) => r.href === "overview.md"));
  });

  it("returns pages sorted by score", () => {
    const result = findRelevantPages("React architecture", sampleIndex);
    const scores = result.map((r) => r.score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i - 1]! >= scores[i]!);
    }
  });

  it("handles short keywords like API, LLM", () => {
    const result = findRelevantPages("How does the Host Contract API work?", sampleIndex);
    const hrefs = result.map((r) => r.href);
    assert.ok(hrefs.includes("concepts/HostContract.md"));
  });

  it("caps at 12 results plus overview", () => {
    const result = findRelevantPages("architecture development error react node vite", sampleIndex);
    assert.ok(result.length <= 13);
  });
});
