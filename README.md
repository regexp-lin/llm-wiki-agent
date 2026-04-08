# LLM Wiki Agent — Node.js

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

English | [中文](README_zh.md)

**A coding agent skill (Node.js/TypeScript version).** Drop source documents into `raw/` and tell the agent to ingest — it reads them, extracts knowledge, and builds a persistent interlinked wiki. Every new source makes the wiki richer. You never write it.

> A Node.js/TypeScript based wiki agent with architectural improvements: shared modules, type safety, and better performance.

> 💡 **Philosophy & Concept**: See [LLM Wiki Pattern](docs/llm-wiki/llm-wiki.md) to understand why building a persistent, compounding knowledge base with LLMs is more powerful than query-time RAG.

```
pnpm dev:ingest raw/papers/attention-is-all-you-need.md
```

```
wiki/
├── index.md          catalog of all pages — updated on every ingest
├── log.md            append-only record of every operation
├── overview.md       living synthesis across all sources
├── sources/          one summary page per source document
├── entities/         people, companies, projects — auto-created
├── concepts/         ideas, frameworks, methods — auto-created
└── syntheses/        query answers filed back as wiki pages
graph/
├── graph.json        persistent node/edge data (SHA256-cached)
└── graph.html        interactive vis.js visualization — open in any browser
```

## Install

**Requires:** Node.js >= 22.16.0, pnpm

```bash
cd llm-wiki-agent-nodejs
pnpm install
```

## Supported Code Agent IDEs

Open in any of these agents — no API key setup needed for agent-native use:

| IDE / Agent | Instruction File | Extra Config |
|---|---|---|
| **Claude Code** | `CLAUDE.md` | `.claude/commands/` (slash commands) |
| **Cursor** | `AGENTS.md` + `.cursor/rules/` | `.cursor/rules/*.mdc` (project rules) |
| **Codex (OpenAI)** | `AGENTS.md` | — |
| **OpenCode** | `AGENTS.md` | — |
| **Antigravity** | `GEMINI.md` + `AGENTS.md` | `.agent/rules/` (supplementary rules) |
| **Gemini CLI** | `GEMINI.md` | — |

```bash
claude          # reads CLAUDE.md + .claude/commands/
cursor          # reads AGENTS.md + .cursor/rules/
codex           # reads AGENTS.md
opencode        # reads AGENTS.md
gemini          # reads GEMINI.md
# Antigravity   reads GEMINI.md → AGENTS.md → .agent/rules/
```

### Wiki Schema

All IDE instruction files reference `WIKI_SCHEMA.md` — the single source of truth for wiki data model, page formats, and naming conventions. This file is also used by the CLI tools as the prompt schema.

## Usage

### Via Agent (Recommended)

Tell the agent what you want:

```
ingest raw/papers/my-paper.md          # ingest a source into the wiki
query: what are the main themes?       # synthesize answer from wiki pages
lint                                   # find orphans, contradictions, gaps
build graph                            # build graph.html from all wikilinks
```

Claude Code also supports slash commands: `/wiki-ingest`, `/wiki-query`, `/wiki-lint`, `/wiki-graph`.

### Via CLI (Requires ANTHROPIC_API_KEY)

```bash
# Development mode (tsx)
pnpm dev:ingest raw/papers/my-paper.md
pnpm dev:query "what are the main themes?"
pnpm dev:lint
pnpm dev:graph --open

# Build & run compiled
pnpm build
node dist/cli/ingest.js raw/papers/my-paper.md
```

## Architecture

```
src/
├── shared/                  # Shared modules
│   ├── types.ts             # All TypeScript interfaces
│   ├── constants.ts         # Paths, colors, model names
│   ├── file-utils.ts        # readFile, writeFile, appendLog
│   ├── wiki-utils.ts        # extractWikilinks, pageNameToPath, allWikiPages
│   └── llm-utils.ts         # parseJsonFromResponse, API client
│
├── workflows/               # Four core workflows
│   ├── ingest.ts            # Knowledge ingestion
│   ├── query.ts             # Knowledge query
│   ├── lint.ts              # Health check
│   └── graph.ts             # Knowledge graph building
│
└── cli/                     # CLI entry points
    ├── ingest.ts
    ├── query.ts
    ├── lint.ts
    └── graph.ts
```

### Key Features

| Aspect | Detail |
|---|---|
| Code reuse | Shared `file-utils.ts` module |
| Type safety | TypeScript strict mode |
| Model management | `constants.ts` central config |
| Lint performance | `buildPageNameMap()` O(1) lookup |
| Project structure | `src/{shared,workflows,cli}/` layered logic |
| Code standards | ESLint + Prettier |
| IDE support | Claude Code, Cursor, Codex, Antigravity, Gemini CLI |

## Tech Stack

- **Runtime:** Node.js 22.16.0 + TypeScript
- **LLM:** Anthropic Claude (via `@anthropic-ai/sdk`)
- **Graph:** graphology + graphology-communities-louvain + vis.js
- **CLI:** commander
- **Dev tools:** ESLint, Prettier, tsx

## Development

```bash
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm format       # Prettier formatting
pnpm build        # Compile to dist/
```

## Documentation

See the `docs/` directory for detailed documentation:
- [LLM Wiki Pattern Philosophy](docs/llm-wiki/llm-wiki.md) — The core idea of compounding knowledge bases vs RAG
- [Getting Started](docs/getting-started.md) — Quick start guide
- [IDE Setup Guide](docs/ide-setup.md) — IDE-specific configuration
- [Workflows Reference](docs/workflows.md) — Detailed workflow documentation
- [CLI Reference](docs/cli-reference.md) — Command-line interface usage
- [Architecture](docs/architecture.md) — System architecture and extension guide

## License

MIT License — see [LICENSE](LICENSE) for details.
