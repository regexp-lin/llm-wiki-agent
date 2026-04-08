---
name: wiki-graph
description: >-
  Build a knowledge graph from wiki pages. Extracts wikilinks, infers implicit
  relationships, runs community detection, and generates an interactive
  visualization. Use when the user says "build graph", "图谱", "knowledge
  graph", or wants to visualize wiki connections.
---

# Wiki Graph

Build a knowledge graph from wiki page relationships.

## Triggers
- `build graph` / `build the knowledge graph`
- "构建图谱" / "知识图谱"

## Steps

1. Collect all wiki pages
2. **Pass 1 — Extract**: Parse all `[[wikilinks]]` → EXTRACTED edges (zero API)
3. **Pass 2 — Infer** (optional): SHA256 diff → changed pages → Claude API →
   INFERRED / AMBIGUOUS edges
4. **Community Detection**: Louvain algorithm → community IDs + colors
5. Output `graph/graph.json` + `graph/graph.html` (vis.js)
6. Update `graph/.cache.json`
7. Append `wiki/log.md`

## Edge Types

| Type | Source | Color |
|------|--------|-------|
| EXTRACTED | [[wikilinks]] | #555555 |
| INFERRED | Semantic, high confidence | #FF5722 |
| AMBIGUOUS | Semantic, low confidence | #BDBDBD |

## Node Type Colors

| Type | Color |
|------|-------|
| source | Green (#4CAF50) |
| entity | Blue (#2196F3) |
| concept | Orange (#FF9800) |
| synthesis | Purple (#9C27B0) |
| unknown | Gray (#9E9E9E) |

## CLI Fallback
If Node.js available: `pnpm dev:graph`
Otherwise: build graph data manually using Grep + Read tools.

For detailed execution flow, read `.cursor/skills/wiki-graph/workflow-detail.md`.
