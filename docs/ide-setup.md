# IDE Setup Guide

本文档详细说明如何在各个 Code Agent IDE 中接入和使用 LLM Wiki Agent。

---

## 概览

LLM Wiki Agent 通过 **指令文件** 告诉 Code Agent IDE 如何维护 wiki。不同 IDE 读取不同的指令文件：

| IDE | 主指令文件 | 额外配置 | Schema |
|---|---|---|---|
| Claude Code | `CLAUDE.md` | `.claude/commands/*.md` | `WIKI_SCHEMA.md` |
| Cursor | `AGENTS.md` | `.cursor/rules/*.mdc`, `.cursor/skills/*/SKILL.md`, `.cursor/agents/*.md` | `WIKI_SCHEMA.md` |
| Codex (OpenAI) | `AGENTS.md` | — | `WIKI_SCHEMA.md` |
| OpenCode | `AGENTS.md` | — | `WIKI_SCHEMA.md` |
| Antigravity | `GEMINI.md` → `AGENTS.md` | `.agent/rules/*.md` | `WIKI_SCHEMA.md` |
| Gemini CLI | `GEMINI.md` | — | `WIKI_SCHEMA.md` |

所有 IDE 指令文件引用同一个 `WIKI_SCHEMA.md` 作为 wiki 数据模型的 single source of truth。

---

## Claude Code

### 安装

确保已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)。

### 启动

```bash
cd llm-wiki-agent-nodejs
claude
```

Claude Code 自动读取：
- `CLAUDE.md` — 工作流指令和 slash commands 表
- `.claude/commands/` — 四个 slash command 定义文件

### 使用

Claude Code 支持 slash commands：

```
/wiki-ingest raw/papers/my-paper.md    # 摄入源文档
/wiki-query What are the main themes?  # 查询知识
/wiki-lint                              # 健康检查
/wiki-graph                             # 构建图谱
```

也可以直接用自然语言：

```
请把 raw/articles/attention.md 摄入 wiki
wiki 里关于 transformer 模型有什么内容？
检查 wiki 有没有孤立页面或矛盾
构建知识图谱
```

### 文件说明

| 文件 | 作用 |
|---|---|
| `CLAUDE.md` | 主指令文件，定义 slash commands 表和四大工作流步骤 |
| `.claude/commands/wiki-ingest.md` | `/wiki-ingest` 命令的详细参数和步骤 |
| `.claude/commands/wiki-query.md` | `/wiki-query` 命令的详细参数和步骤 |
| `.claude/commands/wiki-lint.md` | `/wiki-lint` 命令的详细步骤 |
| `.claude/commands/wiki-graph.md` | `/wiki-graph` 命令的详细步骤 |

---

## Cursor

### 安装

确保已安装 [Cursor IDE](https://cursor.com)。

### 启动

在 Cursor 中打开 `llm-wiki-agent-nodejs` 目录：

```bash
cursor llm-wiki-agent-nodejs
```

Cursor 自动读取：
- `AGENTS.md` — 跨工具通用指令（Cursor 支持读取 AGENTS.md）
- `.cursor/rules/*.mdc` — Cursor 专属项目规则
- `.cursor/skills/*/SKILL.md` — Skills（按需智能加载的工作流指令）

### 项目规则 (Rules)

| 文件 | 生效范围 | 说明 |
|---|---|---|
| `.cursor/rules/wiki-conventions.mdc` | always apply | Wiki 基础约定（命名、不可变性、索引规范） |
| `.cursor/rules/wiki-source-code.mdc` | `src/**/*.ts` | TypeScript 源码开发约定 |

### Skills（按需加载的工作流）

四大核心工作流以 Skills 形式提供，仅在触发时加载，节省 context window：

| Skill | 目录 | 触发词 |
|---|---|---|
| wiki-ingest | `.cursor/skills/wiki-ingest/` | `ingest`、"摄入"、添加文档到 wiki |
| wiki-query | `.cursor/skills/wiki-query/` | `query:`、"查询"、关于 wiki 的问题 |
| wiki-lint | `.cursor/skills/wiki-lint/` | `lint`、"检查"、health check |
| wiki-graph | `.cursor/skills/wiki-graph/` | `build graph`、"图谱"、knowledge graph |

每个 Skill 目录包含：
- `SKILL.md` — 核心指令（Cursor 自动读取）
- `workflow-detail.md` — 详细执行流程（按需参考）

### Subagent

| 文件 | 说明 |
|---|---|
| `.cursor/agents/wiki-researcher.md` | 深度 wiki 分析专家，用于复杂的跨页面分析任务 |

### 使用

在 Cursor 的 Agent 模式 (Cmd+I / Ctrl+I) 或 Chat 中使用：

```
ingest raw/papers/my-paper.md
query: what are the main themes?
lint the wiki
build the knowledge graph
```

### 自定义规则

如需添加自定义规则，在 `.cursor/rules/` 下创建新的 `.mdc` 文件：

```
---
description: My custom rule
globs: ["**/*.md"]
alwaysApply: false
---

Your rule content here...
```

---

## Codex (OpenAI)

### 安装

确保已安装 [OpenAI Codex](https://openai.com/codex)。

### 启动

```bash
cd llm-wiki-agent-nodejs
codex
```

Codex 自动读取 `AGENTS.md`，按以下优先级层叠合并：
1. `~/.codex/AGENTS.md` (全局规则，如有)
2. 项目根目录 `AGENTS.md` (项目规则)

### 使用

直接在 Codex 中用自然语言描述：

```
ingest raw/papers/my-paper.md
query: what are the main themes?
lint
build graph
```

### 多指令集（进阶）

Codex 支持命名变体（如 `AGENTS.review.md`），如需为特定工作流创建专用指令：

```
AGENTS.md              # 默认
AGENTS.review.md       # codex --agents review
AGENTS.ingest.md       # codex --agents ingest
```

---

## Antigravity

### 安装

确保已安装 [Antigravity](https://antigravity.codes)（v1.20.3+）。

### 启动

在 Antigravity 中打开 `llm-wiki-agent-nodejs` 项目。

Antigravity 按以下优先级读取配置：
1. `GEMINI.md` — 最高优先级（Antigravity 专属）
2. `AGENTS.md` — 跨工具基础规则
3. `.agent/rules/` — 补充性模块化规则

### 使用

```
ingest raw/papers/my-paper.md
query: what are the main themes?
lint
build graph
```

### 配置文件说明

| 文件 | 作用 |
|---|---|
| `GEMINI.md` | Antigravity 优先读取的指令文件，包含工作流触发词和步骤 |
| `AGENTS.md` | 跨工具通用指令，作为 GEMINI.md 的补充 |
| `.agent/rules/wiki-workflows.md` | 补充性规则：各工作流的具体约束和最佳实践 |

### 全局规则

如需添加全局规则（对所有项目生效）：

```bash
mkdir -p ~/.gemini
# 在 ~/.gemini/GEMINI.md 或 ~/.gemini/AGENTS.md 中添加全局规则
```

---

## Gemini CLI

### 安装

确保已安装 [Gemini CLI](https://github.com/google-gemini/gemini-cli)。

### 启动

```bash
cd llm-wiki-agent-nodejs
gemini
```

Gemini CLI 读取 `GEMINI.md`。

### 使用

```
ingest raw/papers/my-paper.md
query: what are the main themes?
lint
build graph
```

---

## OpenCode

### 启动

```bash
cd llm-wiki-agent-nodejs
opencode
```

OpenCode 读取 `AGENTS.md`，使用方式与 Codex 相同。

---

## 多 IDE 协作

所有 IDE 操作同一个 `wiki/` 目录，数据完全互通：

```
Claude Code 用户 → 用 /wiki-ingest 摄入文档
Cursor 用户     → 用 Agent 查询知识
Codex 用户      → 用 lint 检查健康状态
```

Wiki 数据（`wiki/`、`graph/`）是 IDE 无关的纯 Markdown 文件，任何 IDE 都可以读写。

### 最佳实践

1. **团队统一**：在 `AGENTS.md` 中定义团队共享规则，各 IDE 都会读取。
2. **版本控制**：将 `wiki/` 和 `graph/` 纳入 git，所有团队成员共享知识库。
3. **Schema 一致性**：不要直接修改 `WIKI_SCHEMA.md` 中定义的格式，否则 CLI 工具和 Agent 指令可能不一致。
