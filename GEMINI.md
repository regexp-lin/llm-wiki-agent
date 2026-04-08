# LLM Wiki Agent — Gemini CLI / Antigravity Instructions

This wiki is maintained entirely by the coding agent. No API key or Node.js scripts needed — just open this repo with `gemini` or Antigravity and talk to it.

## How to Use

Describe what you want in plain English:
- *"Ingest this file: raw/papers/my-paper.md"*
- *"What does the wiki say about transformer models?"*
- *"Check the wiki for orphan pages and contradictions"*
- *"Build the knowledge graph"*

Or use shorthand triggers:
- `ingest <file>` → runs the Ingest Workflow
- `query: <question>` → runs the Query Workflow
- `lint` → runs the Lint Workflow
- `build graph` → runs the Graph Workflow

## Wiki Schema

Read `WIKI_SCHEMA.md` at the project root for the full wiki data model: directory layout, page format, frontmatter, naming conventions, index and log formats.

---

## Ingest Workflow

Triggered by: *"ingest <file>"*

1. Read the source document fully
2. Read `wiki/index.md` and `wiki/overview.md` for current wiki context
3. Write `wiki/sources/<slug>.md` (source page format per WIKI_SCHEMA.md)
4. Update `wiki/index.md` — add entry under Sources
5. Update `wiki/overview.md` — revise synthesis if warranted
6. Update/create entity and concept pages
7. Flag contradictions with existing wiki content
8. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Title>`

---

## Query Workflow

Triggered by: *"query: <question>"*

1. Read `wiki/index.md` — identify relevant pages
2. Read those pages
3. Synthesize answer with `[[PageName]]` citations
4. Offer to save as `wiki/syntheses/<slug>.md`

---

## Lint Workflow

Triggered by: *"lint"*

Check for: orphan pages, broken links, contradictions, stale content, missing entity pages, data gaps.

---

## Graph Workflow

Triggered by: *"build graph"*

Try `pnpm dev:graph --open` first. If unavailable, build graph.json and graph.html manually from wikilinks.
