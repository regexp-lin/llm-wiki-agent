import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestResultSchema, PageUpdateSchema, InferredRelationSchema } from "./validators.js";

describe("PageUpdateSchema", () => {
  it("accepts valid page update", () => {
    const result = PageUpdateSchema.safeParse({ path: "entities/Foo.md", content: "# Foo" });
    assert.ok(result.success);
  });

  it("rejects empty path", () => {
    const result = PageUpdateSchema.safeParse({ path: "", content: "# Foo" });
    assert.ok(!result.success);
  });

  it("rejects empty content", () => {
    const result = PageUpdateSchema.safeParse({ path: "entities/Foo.md", content: "" });
    assert.ok(!result.success);
  });
});

describe("IngestResultSchema", () => {
  const validData = {
    title: "Test Source",
    slug: "test-source",
    source_page: "# Test\ncontent",
    index_entry: "- [Test](sources/test.md)",
    overview_update: null,
    entity_pages: [],
    concept_pages: [],
    contradictions: [],
    log_entry: "## Added test",
  };

  it("accepts valid ingest result", () => {
    const result = IngestResultSchema.safeParse(validData);
    assert.ok(result.success);
  });

  it("rejects invalid slug format", () => {
    const result = IngestResultSchema.safeParse({ ...validData, slug: "Invalid Slug" });
    assert.ok(!result.success);
  });

  it("rejects missing title", () => {
    const noTitle = { ...validData, title: undefined };
    const result = IngestResultSchema.safeParse(noTitle);
    assert.ok(!result.success);
  });

  it("defaults entity_pages to empty array", () => {
    const data = { ...validData, entity_pages: undefined };
    const result = IngestResultSchema.safeParse(data);
    assert.ok(result.success);
    if (result.success) {
      assert.deepEqual(result.data.entity_pages, []);
    }
  });
});

describe("InferredRelationSchema", () => {
  it("accepts valid relation", () => {
    const result = InferredRelationSchema.safeParse({
      to: "concepts/Foo",
      relationship: "implements",
      confidence: 0.8,
      type: "INFERRED",
    });
    assert.ok(result.success);
  });

  it("rejects confidence out of range", () => {
    const result = InferredRelationSchema.safeParse({
      to: "concepts/Foo",
      confidence: 1.5,
      type: "INFERRED",
    });
    assert.ok(!result.success);
  });

  it("rejects invalid type", () => {
    const result = InferredRelationSchema.safeParse({
      to: "concepts/Foo",
      confidence: 0.8,
      type: "INVALID",
    });
    assert.ok(!result.success);
  });
});
