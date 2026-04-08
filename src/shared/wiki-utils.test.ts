import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractWikilinks, extractFrontmatterType, extractTitle } from "./wiki-utils.js";

describe("extractWikilinks", () => {
  it("extracts single wikilink", () => {
    assert.deepEqual(extractWikilinks("see [[Foo]]"), ["Foo"]);
  });

  it("extracts multiple wikilinks", () => {
    assert.deepEqual(extractWikilinks("[[A]] and [[B]]"), ["A", "B"]);
  });

  it("deduplicates", () => {
    assert.deepEqual(extractWikilinks("[[A]] and [[A]]"), ["A"]);
  });

  it("returns empty for no links", () => {
    assert.deepEqual(extractWikilinks("no links here"), []);
  });

  it("handles nested brackets", () => {
    assert.deepEqual(extractWikilinks("[[Link With Spaces]]"), ["Link With Spaces"]);
  });
});

describe("extractFrontmatterType", () => {
  it("extracts source type", () => {
    assert.equal(extractFrontmatterType("type: source"), "source");
  });

  it("extracts entity type", () => {
    assert.equal(extractFrontmatterType("type: entity"), "entity");
  });

  it("extracts concept type", () => {
    assert.equal(extractFrontmatterType("type: concept"), "concept");
  });

  it("extracts synthesis type", () => {
    assert.equal(extractFrontmatterType("type: synthesis"), "synthesis");
  });

  it("handles quoted type", () => {
    assert.equal(extractFrontmatterType('type: "source"'), "source");
  });

  it("returns unknown for missing type", () => {
    assert.equal(extractFrontmatterType("no frontmatter"), "unknown");
  });

  it("returns unknown for invalid type", () => {
    assert.equal(extractFrontmatterType("type: invalid"), "unknown");
  });
});

describe("extractTitle", () => {
  it("extracts title from frontmatter", () => {
    assert.equal(extractTitle('title: "My Page"', "/wiki/test.md"), "My Page");
  });

  it("extracts unquoted title", () => {
    assert.equal(extractTitle("title: My Page", "/wiki/test.md"), "My Page");
  });

  it("falls back to filename", () => {
    assert.equal(extractTitle("no title here", "/wiki/test-page.md"), "test-page");
  });
});
