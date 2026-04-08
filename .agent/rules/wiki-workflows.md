# Wiki Workflow Rules

When the user triggers a wiki operation, follow these rules:

## General
- Always read `WIKI_SCHEMA.md` before performing any wiki operation to understand page formats and naming conventions.
- Always append to `wiki/log.md` after any workflow completes.
- Use `[[PageName]]` wikilinks to cross-reference pages.

## Ingest
- Never modify files in `raw/` — they are immutable source documents.
- Always update `wiki/index.md` after creating new pages.
- Entity pages go in `wiki/entities/`, concept pages in `wiki/concepts/`.

## Query
- Always cite sources using `[[PageName]]` wikilink syntax.
- Include a `## Sources` section at the end of answers.

## Lint
- Structural checks (orphans, broken links) should be done before semantic checks.
- Offer to save the lint report to `wiki/lint-report.md`.

## Graph
- Prefer running `pnpm dev:graph --open` if dependencies are available.
- If building manually, write both `graph/graph.json` and `graph/graph.html`.
