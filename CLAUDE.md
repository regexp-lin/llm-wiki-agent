# LLM Wiki Agent — Claude Code Instructions

This wiki is maintained entirely by Claude Code. No API key or Node.js scripts needed — just open this repo in Claude Code and talk to it.

## Slash Commands (Claude Code)

| Command | What to say |
|---|---|
| `/wiki-ingest` | `ingest raw/my-article.md` or just `ingest` (batch mode) |
| `/wiki-query` | `query: what are the main themes?` |
| `/wiki-lint` | `lint the wiki` |
| `/wiki-graph` | `build the knowledge graph` |

Or just describe what you want in plain English:
- *"Ingest this file: raw/papers/attention-is-all-you-need.md"*
- *"Ingest all new files"* (batch mode)
- *"What does the wiki say about transformer models?"*
- *"Check the wiki for orphan pages and contradictions"*
- *"Build the graph and show me what's connected to RAG"*

Claude Code reads this file automatically and follows the workflows below.

## Wiki Schema

Read `WIKI_SCHEMA.md` at the project root for the full wiki data model: directory layout, page format, frontmatter, naming conventions, index and log formats.

---

## Ingest Workflow

### Single File Mode

Triggered by: *"ingest <file>"* or `/wiki-ingest`

Steps (in order):
1. Read `wiki/.ingest-cache.json` and compute the source file's SHA256
2. Check cache: if file is cached and output exists, print "Skipped (cached)" and stop
3. Read the source document fully using the Read tool
4. Read `wiki/index.md` and `wiki/overview.md` for current wiki context
5. Write `wiki/sources/<slug>.md` — use the source page format per WIKI_SCHEMA.md
6. Update `wiki/index.md` — add entry under Sources section
7. Update `wiki/overview.md` — revise synthesis if warranted
8. Update/create entity pages for key people, companies, projects mentioned
9. Update/create concept pages for key ideas and frameworks discussed
10. Flag any contradictions with existing wiki content
11. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Title>`
12. Update `wiki/.ingest-cache.json` with the new entry

Use `--force` to bypass cache.

### Batch Mode

Triggered by: *"ingest"* (no file argument) or *"ingest all"*

Steps:
1. Scan `raw/` directory recursively for all `.md` and `.txt` files
2. Read `wiki/.ingest-cache.json`
3. Classify each file: NEW / CHANGED / OUTPUT_MISSING / CACHED
4. Report scan results
5. For each file that needs processing, execute single-file ingest
6. Update cache after each successful ingest

---

## Query Workflow

Triggered by: *"query: <question>"* or `/wiki-query`

Steps:
1. Read `wiki/index.md` to identify relevant pages
2. Read those pages with the Read tool
3. Synthesize an answer with inline citations as `[[PageName]]` wikilinks
4. Ask the user if they want the answer filed as `wiki/syntheses/<slug>.md`

---

## Lint Workflow

Triggered by: *"lint the wiki"* or `/wiki-lint`

Use Grep and Read tools to check for:
- **Orphan pages** — wiki pages with no inbound `[[links]]` from other pages
- **Broken links** — `[[WikiLinks]]` pointing to pages that don't exist
- **Contradictions** — claims that conflict across pages
- **Stale summaries** — pages not updated after newer sources
- **Missing entity pages** — entities mentioned in 3+ pages but lacking their own page
- **Data gaps** — questions the wiki can't answer; suggest new sources

Output a lint report and ask if the user wants it saved to `wiki/lint-report.md`.

---

## Graph Workflow

Triggered by: *"build the knowledge graph"* or `/wiki-graph`

When the user asks to build the graph, run `pnpm dev:graph` which:
- Pass 1: Parses all `[[wikilinks]]` → deterministic `EXTRACTED` edges
- Pass 2: Infers implicit relationships → `INFERRED` edges with confidence scores
- Runs Louvain community detection
- Outputs `graph/graph.json` + `graph/graph.html`

If Node.js/dependencies aren't set up, instead generate the graph data manually:
1. Use Grep to find all `[[wikilinks]]` across wiki pages
2. Build a node/edge list
3. Write `graph/graph.json` directly
4. Write `graph/graph.html` using the vis.js template
