# LLM Wiki Agent — Schema & Workflow Instructions

This wiki is maintained entirely by your coding agent. No API key or Node.js scripts needed — just open this repo in Codex, OpenCode, Cursor, Antigravity, or any agent that reads this file, and talk to it.

## How to Use

Describe what you want in plain English:
- *"Ingest this file: raw/papers/my-paper.md"*
- *"Ingest all new files"* (batch mode)
- *"What does the wiki say about transformer models?"*
- *"Check the wiki for orphan pages and contradictions"*
- *"Build the knowledge graph"*

Or use shorthand triggers:
- `ingest <file>` → runs the Ingest Workflow (single file)
- `ingest` → runs the Ingest Workflow (batch mode)
- `query: <question>` → runs the Query Workflow
- `lint` → runs the Lint Workflow
- `build graph` → runs the Graph Workflow

## Wiki Schema

Read `WIKI_SCHEMA.md` at the project root for the full wiki data model: directory layout, page format, frontmatter, naming conventions, index and log formats.

---

## Ingest Workflow

### Single File Mode

Triggered by: *"ingest <file>"*

Steps (in order):
1. Read `wiki/.ingest-cache.json` and compute the source file's SHA256
2. Check cache: if file is cached and output exists, skip it
3. Read the source document fully
4. Read `wiki/index.md` and `wiki/overview.md` for current wiki context
5. Write `wiki/sources/<slug>.md` — use the source page format defined in WIKI_SCHEMA.md
6. Update `wiki/index.md` — add entry under Sources section
7. Update `wiki/overview.md` — revise synthesis if warranted
8. Update/create entity pages for key people, companies, projects mentioned
9. Update/create concept pages for key ideas and frameworks discussed
10. Flag any contradictions with existing wiki content
11. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Title>`
12. Update `wiki/.ingest-cache.json` with the new entry

### Batch Mode

Triggered by: *"ingest"* (no file argument)

Steps:
1. Scan `raw/` directory recursively for all `.md` and `.txt` files
2. Read `wiki/.ingest-cache.json`
3. Classify each file: NEW / CHANGED / OUTPUT_MISSING / CACHED
4. Report scan results
5. For each file needing processing, execute single-file ingest
6. Update cache after each successful ingest

---

## Query Workflow

Triggered by: *"query: <question>"*

Steps:
1. Read `wiki/index.md` to identify relevant pages
2. Read those pages
3. Synthesize an answer with inline citations as `[[PageName]]` wikilinks
4. Ask the user if they want the answer filed as `wiki/syntheses/<slug>.md`

---

## Lint Workflow

Triggered by: *"lint"*

Check for:
- **Orphan pages** — wiki pages with no inbound `[[links]]` from other pages
- **Broken links** — `[[WikiLinks]]` pointing to pages that don't exist
- **Contradictions** — claims that conflict across pages
- **Stale summaries** — pages not updated after newer sources
- **Missing entity pages** — entities mentioned in 3+ pages but lacking their own page
- **Data gaps** — questions the wiki can't answer; suggest new sources

Output a lint report and ask if the user wants it saved to `wiki/lint-report.md`.

---

## Graph Workflow

Triggered by: *"build graph"*

First try: `pnpm dev:graph --open`

If Node.js/deps unavailable, build manually:
1. Search for all `[[wikilinks]]` across wiki pages
2. Build nodes (one per page) and edges (one per link)
3. Infer implicit relationships not captured by wikilinks — tag `INFERRED` with confidence score; low confidence → `AMBIGUOUS`
4. Write `graph/graph.json` with `{nodes, edges, built: date}`
5. Write `graph/graph.html` as a self-contained vis.js visualization

---

## CLI Quick Reference

```bash
pnpm install                          # install dependencies
pnpm dev:ingest                       # batch ingest — scan raw/, skip cached
pnpm dev:ingest raw/my-article.md     # single file ingest
pnpm dev:ingest --force               # re-ingest all files
pnpm dev:ingest raw/file.md --force   # force re-ingest single file
pnpm dev:ingest --dry-run             # preview what would be processed
pnpm dev:ingest --status              # show cache status
pnpm dev:ingest --clean               # clear ingest cache
pnpm dev:ingest --concurrency 3       # parallel batch ingest
pnpm dev:query "question"             # query via CLI
pnpm dev:lint                         # lint via CLI
pnpm dev:graph --open                 # build graph + open in browser
```
