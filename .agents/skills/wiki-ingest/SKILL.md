---
name: wiki-ingest
description: >-
  Ingest source documents into the wiki knowledge base. Creates source pages,
  entity pages, concept pages, and updates the index. Use when the user says
  "ingest", "摄入", mentions adding a document to the wiki, or wants to
  process files from the raw/ directory.
---

# Wiki Ingest

Ingest source documents from `raw/` into the wiki. Supports single-file and
batch modes with SHA256-based caching for idempotency.

## Triggers
- `ingest <file>` — single file mode
- `ingest` / `ingest all` — batch mode (scan raw/ for new/changed files)
- `--force` or "force re-ingest" — bypass cache

## Single File Steps

1. Read `wiki/.ingest-cache.json` and compute source file SHA256
2. Cache check: skip if cached + output exists (unless --force)
3. Read the source document fully
4. Read `wiki/index.md` and `wiki/overview.md` for context
5. Write `wiki/sources/<slug>.md` per WIKI_SCHEMA.md format
6. Update `wiki/index.md` — add entry under Sources
7. Update `wiki/overview.md` — revise synthesis if warranted
8. Update/create entity pages in `wiki/entities/`
9. Update/create concept pages in `wiki/concepts/`
10. Flag contradictions with existing wiki content
11. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Title>`
12. Update `wiki/.ingest-cache.json`

## Batch Mode Steps

1. Scan `raw/` recursively for `.md` and `.txt` files
2. Load cache, classify each: NEW / CHANGED / OUTPUT_MISSING / CACHED
3. Report scan results (counts by status)
4. Execute single-file steps for each file needing processing
5. Update cache after each success

## Cache States

| State | Meaning | Action |
|-------|---------|--------|
| NEW | No cache record | Ingest |
| CHANGED | Content hash differs | Re-ingest |
| OUTPUT_MISSING | Source unchanged, output deleted | Re-ingest |
| CACHED | Full match | Skip |
| FORCED | User forced | Ingest unconditionally |

For detailed execution flow and advanced options, read `.cursor/skills/wiki-ingest/workflow-detail.md`.
