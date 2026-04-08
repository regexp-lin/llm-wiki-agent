# Architecture

本文档描述 LLM Wiki Agent Node.js 版的系统架构、设计决策和扩展指南。

---

## 整体架构

```
┌──────────────────────────────────────────────────────┐
│                   Code Agent IDEs                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Claude │ │ Cursor │ │ Codex  │ │ Antigravity  │  │
│  │  Code  │ │        │ │        │ │ / Gemini CLI │  │
│  └───┬────┘ └───┬────┘ └───┬────┘ └──────┬───────┘  │
│      │          │          │             │           │
│      ▼          ▼          ▼             ▼           │
│  CLAUDE.md  AGENTS.md  AGENTS.md    GEMINI.md       │
│  + .claude/ + .cursor/              + AGENTS.md     │
│    commands/  rules/                + .agent/rules/  │
│              skills/                                 │
│              agents/                                 │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │ WIKI_SCHEMA │  ← 所有 IDE 共享的 wiki 数据模型
            │     .md      │
            └──────┬──────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
   ┌──────────┐ ┌──────┐ ┌──────────┐
   │   wiki/  │ │ raw/ │ │  graph/  │
   │ (output) │ │(input│ │ (output) │
   └──────────┘ └──────┘ └──────────┘
         ▲                    ▲
         │                    │
         └────────┬───────────┘
                  │
      ┌───────────┴───────────┐
      │    CLI Tools (src/)   │
      │  ┌──────────────────┐ │
      │  │  src/cli/        │ │  ← CLI 入口 (commander)
      │  └────────┬─────────┘ │
      │           ▼           │
      │  ┌──────────────────┐ │
      │  │ src/workflows/   │ │  ← 业务逻辑
      │  └────────┬─────────┘ │
      │           ▼           │
      │  ┌──────────────────┐ │
      │  │  src/shared/     │ │  ← 共享模块
      │  └──────────────────┘ │
      └───────────────────────┘
```

---

## 分层设计

### Layer 1: IDE 指令层

每个 Code Agent IDE 有自己的指令文件格式和约定：

| IDE | 指令格式 | 文件 |
|---|---|---|
| Claude Code | Markdown + slash commands | `CLAUDE.md`, `.claude/commands/` |
| Cursor | MDC Rules + Skills + Agents | `.cursor/rules/*.mdc`, `.cursor/skills/*/SKILL.md`, `.cursor/agents/*.md` |
| Codex / OpenCode | Markdown | `AGENTS.md` |
| Antigravity / Gemini | Markdown | `GEMINI.md`, `.agent/rules/` |

所有 IDE 指令文件共享同一个 `WIKI_SCHEMA.md`，确保 wiki 数据模型的一致性。

#### Cursor Skills 架构

Cursor 使用 Skills 按需加载工作流指令，替代原来的 always-apply 单体规则：

```
.cursor/
├── rules/
│   ├── wiki-conventions.mdc      # always-apply 基础约定 (~30行)
│   └── wiki-source-code.mdc      # glob-based TypeScript 约定
├── skills/
│   ├── wiki-ingest/SKILL.md      # 知识摄入 (按需加载)
│   ├── wiki-query/SKILL.md       # 知识查询 (按需加载)
│   ├── wiki-lint/SKILL.md        # 健康检查 (按需加载)
│   └── wiki-graph/SKILL.md       # 知识图谱 (按需加载)
└── agents/
    └── wiki-researcher.md        # 深度分析 subagent
```

优势：token 消耗从 ~112 行 always-loaded 降至 ~30 行 always + ~60-80 行按需加载。

### Layer 2: Wiki Schema 层

`WIKI_SCHEMA.md` 是 wiki 的 single source of truth，定义：

- **目录结构** — `raw/`, `wiki/`, `graph/` 的用途
- **页面格式** — frontmatter 字段（title, type, tags, sources, last_updated）
- **命名约定** — source 用 kebab-case，entity/concept 用 TitleCase
- **索引格式** — `wiki/index.md` 的 section 结构
- **日志格式** — `wiki/log.md` 的条目格式

此文件同时被：
- IDE Agent 读取（了解 wiki 结构）
- CLI 工具嵌入 API prompt（让 LLM 了解 wiki 规范）

### Layer 3: CLI 工具层

```
src/
├── cli/            # 薄 CLI 入口，仅负责参数解析
│   ├── ingest.ts   # commander → workflows/ingest.ts
│   ├── query.ts    # commander → workflows/query.ts
│   ├── lint.ts     # commander → workflows/lint.ts
│   └── graph.ts    # commander → workflows/graph.ts
│
├── workflows/      # 业务逻辑，不依赖 CLI 框架
│   ├── ingest.ts   # 知识摄入
│   ├── query.ts    # 知识查询
│   ├── lint.ts     # 健康检查
│   └── graph.ts    # 图谱构建
│
└── shared/         # 跨工作流共享模块
    ├── types.ts    # TypeScript 类型定义
    ├── constants.ts # 路径、颜色、模型名
    ├── file-utils.ts # 文件读写
    ├── wiki-utils.ts # Wiki 页面工具
    └── llm-utils.ts  # LLM API 调用
```

**设计原则：**
- `cli/` 只做参数解析，不含业务逻辑
- `workflows/` 可被 CLI 和程序化调用
- `shared/` 提供共享模块供各流程复用

---

## 关键设计决策

### 1. WIKI_SCHEMA.md 与 IDE 指令分离

**问题：** 早期版本中 `CLAUDE.md` 既是 Claude Code 的指令文件，又被 `ingest.ts` / `query.ts` 作为 API prompt 的 schema 嵌入。这导致：
- IDE 特定内容（slash commands 表）混入 API prompt
- 其他 IDE 用户看不到 schema（因为他们读的是 `AGENTS.md`）

**方案：** 提取 `WIKI_SCHEMA.md` 作为纯 schema 文件：
- `constants.ts` 中 `SCHEMA_FILE` 指向 `WIKI_SCHEMA.md`
- 各 IDE 指令文件引用 `WIKI_SCHEMA.md` 而非重复定义
- API prompt 嵌入的是纯 schema，不含 IDE 指令

### 2. 模型名集中管理

```typescript
// src/shared/constants.ts
export const MODEL_SONNET = "claude-sonnet-4-6";
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
```

升级模型只需修改一处。

### 3. Lint 性能优化

通过 `buildPageNameMap()` 一次性构建映射，O(1) 查找，避免了每次查找时遍历文件系统，显著提升了在 `findOrphans` 和 `findBrokenLinks` 中的高频调用性能。

### 4. 增量图谱缓存

Graph 工作流使用 SHA256 内容哈希缓存：
- 首次构建：所有页面都需要 API 推断
- 后续构建：只处理内容变更的页面
- 缓存存储在 `graph/.cache.json`

---

## 数据流

### Ingest 数据流

```
raw/article.md
      │
      ▼
[读取源文件] → SHA256 hash
      │
      ▼
[读取 wiki/index.md + overview.md + 最近 source pages]
      │
      ▼
[读取 WIKI_SCHEMA.md]
      │
      ▼
[组装 Prompt: schema + context + source]
      │
      ▼
[Claude Sonnet API] → JSON response
      │
      ▼
[解析 JSON → IngestResult]
      │
      ├── wiki/sources/<slug>.md
      ├── wiki/entities/<Name>.md   × N
      ├── wiki/concepts/<Name>.md   × N
      ├── wiki/overview.md          (可选)
      ├── wiki/index.md             (更新)
      └── wiki/log.md               (追加)
```

### Graph 数据流

```
wiki/**/*.md
      │
      ▼
[Pass 1: 提取 [[wikilinks]]] → EXTRACTED edges
      │
      ▼
[Pass 2: SHA256 diff → 变更页面] → Claude Haiku × N → INFERRED/AMBIGUOUS edges
      │
      ▼
[Louvain 社区检测] → community IDs + colors
      │
      ├── graph/graph.json    (节点 + 边 + 日期)
      ├── graph/graph.html    (vis.js 交互可视化)
      └── graph/.cache.json   (SHA256 缓存更新)
```

---

## 类型系统

核心类型定义在 `src/shared/types.ts`：

```typescript
type PageType = "source" | "entity" | "concept" | "synthesis" | "unknown";

interface WikiPage { path, stem, content, type, title }
interface IngestResult { title, slug, source_page, index_entry, ... }
interface QueryOptions { question, savePath? }
interface LintReport { orphans, brokenLinks, missingEntities, ... }
interface GraphNode { id, label, type, color, path, group? }
interface GraphEdge { from, to, type, color, confidence, label? }
interface GraphData { nodes, edges, built }
```

---

## 扩展指南

### 添加新的 IDE 支持

1. 确定 IDE 的指令文件约定（文件名、格式、存放位置）
2. 创建对应的指令文件，引用 `WIKI_SCHEMA.md`
3. 在 README.md 的 "Supported Code Agent IDEs" 表格中添加条目

### 添加新的工作流

1. 在 `src/shared/types.ts` 中定义新的类型
2. 在 `src/workflows/` 中实现工作流逻辑
3. 在 `src/cli/` 中创建 CLI 入口
4. 在 `package.json` 的 `scripts` 和 `bin` 中添加命令
5. 更新所有 IDE 指令文件，添加新工作流的触发方式
6. 更新 `.claude/commands/` 添加 slash command
7. 创建 `.cursor/skills/wiki-<name>/SKILL.md` 和 `workflow-detail.md`
8. 更新 `.cursor/rules/wiki-conventions.mdc` 中的 Available Workflows 列表
9. 更新 `.agent/rules/wiki-workflows.md` 添加规则

### 更换 LLM Provider

当前使用 Anthropic Claude。如需更换：

1. 修改 `src/shared/llm-utils.ts` — 替换 `Anthropic` 客户端
2. 修改 `src/shared/constants.ts` — 更新模型名称
3. 修改各 `workflows/*.ts` — 调整 API 调用格式
4. 更新 `package.json` — 替换 SDK 依赖

---

## 技术栈

| 组件 | 技术 | 版本 |
|---|---|---|
| 运行时 | Node.js | >= 22.16.0 |
| 语言 | TypeScript | 最新稳定版 |
| 包管理 | pnpm | 最新稳定版 |
| LLM SDK | @anthropic-ai/sdk | 最新 |
| CLI | commander | 最新 |
| 图数据结构 | graphology | 最新 |
| 社区检测 | graphology-communities-louvain | 最新 |
| 浏览器打开 | open | 最新 |
| 代码检查 | ESLint + typescript-eslint | v9+ |
| 格式化 | Prettier | 最新 |
| TS 运行 | tsx | 最新 |
