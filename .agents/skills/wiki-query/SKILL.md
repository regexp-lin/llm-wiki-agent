---
name: wiki-query
description: >-
  Query the wiki knowledge base to answer questions. Synthesizes answers from
  wiki pages with wikilink citations. Use when the user says "query:",
  "查询", asks a question about wiki content, or wants to search the
  knowledge base.
---

# Wiki Query

Synthesize answers from the wiki knowledge base with inline `[[PageName]]`
citations.

## Triggers
- `query: <question>`
- Any question about wiki content
- "查询" + question

## Steps

1. Read `wiki/index.md` to identify relevant pages
2. Read those pages with the Read tool
3. Synthesize an answer with inline `[[PageName]]` wikilink citations
4. Ask the user if they want the answer filed as `wiki/syntheses/<slug>.md`

## Page Selection

- Level 1: Keyword matching against index titles
  - Extract `[title](href)` links from index
  - Tokenize titles → filter tokens ≤3 chars
  - Intersect with question tokens
  - Always include `overview.md`, cap at 12 pages
- Level 2 (if insufficient): Use LLM to select relevant pages

## Save Option

If user wants to save: write `wiki/syntheses/<slug>.md` with synthesis
page format per WIKI_SCHEMA.md, update `wiki/index.md`, append `wiki/log.md`.

For detailed execution flow, read `.cursor/skills/wiki-query/workflow-detail.md`.
