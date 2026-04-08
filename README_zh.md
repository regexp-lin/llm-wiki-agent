# LLM Wiki Agent — Node.js

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

**一个用于代码智能体 (Coding Agent) 的技能组件 (Node.js/TypeScript 版本)。** 将你的源文档丢进 `raw/` 目录并让智能体去处理（ingest）—— 它会自动阅读、提取知识，并构建一个持久的、互相链接的维基库。每一个新源文档都能丰富这个维基。你完全不需要亲手编写它。

> 一个基于 Node.js/TypeScript 的维基智能体，包含架构层面的改进：共享模块、类型安全以及更好的性能。

> 💡 **理念与概念**: 查看 [LLM Wiki Pattern](docs/llm-wiki/llm-wiki.md) 了解为什么使用 LLM 构建持久的、具备复利效应的知识库比使用查询时的 RAG 更强大。

```
pnpm dev:ingest raw/papers/attention-is-all-you-need.md
```

```
wiki/
├── index.md          所有页面的目录 — 每次执行 ingest 操作都会更新
├── log.md            仅允许追加记录的每一次操作日志
├── overview.md       跨越所有源文档的动态综合摘要
├── sources/          每个源文档对应一个摘要页面
├── entities/         人物、公司、项目 — 自动生成
├── concepts/         想法、框架、方法 — 自动生成
└── syntheses/        查询回答将作为维基页面被归档
graph/
├── graph.json        持久的节点/边数据 (SHA256 缓存)
└── graph.html        交互式 vis.js 可视化图表 — 可在任何浏览器中打开
```

## 安装

**环境要求:** Node.js >= 22.16.0, pnpm

```bash
cd llm-wiki-agent-nodejs
pnpm install
```

## 支持的代码智能体 IDE

可以在以下任何智能体中打开 — 在原生智能体环境中使用不需要配置 API Key：

| IDE / 智能体 | 指令文件 | 额外配置 |
|---|---|---|
| **Claude Code** | `CLAUDE.md` | `.claude/commands/` (反斜杠快捷指令) |
| **Cursor** | `AGENTS.md` + `.cursor/rules/` | `.cursor/rules/*.mdc` (项目规则) |
| **Codex (OpenAI)** | `AGENTS.md` | — |
| **OpenCode** | `AGENTS.md` | — |
| **Antigravity** | `GEMINI.md` + `AGENTS.md` | `.agent/rules/` (补充规则) |
| **Gemini CLI** | `GEMINI.md` | — |

```bash
claude          # 读取 CLAUDE.md + .claude/commands/
cursor          # 读取 AGENTS.md + .cursor/rules/
codex           # 读取 AGENTS.md
opencode        # 读取 AGENTS.md
gemini          # 读取 GEMINI.md
# Antigravity   读取 GEMINI.md → AGENTS.md → .agent/rules/
```

### 维基数据结构 (Wiki Schema)

所有的 IDE 指令文件都引用了 `WIKI_SCHEMA.md` — 它是关于维基数据模型、页面格式和命名约定的唯一规范。该文件同时也被 CLI 工具用作 prompt 模式定义。

## 使用方法

### 通过智能体使用 (推荐)

直接告诉智能体你想要做什么：

```
ingest raw/papers/my-paper.md          # 摄入一个源文档到维基中
query: what are the main themes?       # 从维基页面中综合得出回答
lint                                   # 查找孤立页面、矛盾点和空白内容
build graph                            # 从所有的维基链接生成 graph.html
```

Claude Code 还支持快捷指令：`/wiki-ingest`, `/wiki-query`, `/wiki-lint`, `/wiki-graph`。

### 通过 CLI 使用 (需要 ANTHROPIC_API_KEY)

```bash
# 开发模式 (tsx)
pnpm dev:ingest raw/papers/my-paper.md
pnpm dev:query "what are the main themes?"
pnpm dev:lint
pnpm dev:graph --open

# 构建和运行编译后版本
pnpm build
node dist/cli/ingest.js raw/papers/my-paper.md
```

## 架构组成

```
src/
├── shared/                  # 共享模块
│   ├── types.ts             # 所有的 TypeScript 接口定义
│   ├── constants.ts         # 路径、颜色、模型名称等常数
│   ├── file-utils.ts        # readFile, writeFile, appendLog
│   ├── wiki-utils.ts        # extractWikilinks, pageNameToPath, allWikiPages
│   └── llm-utils.ts         # parseJsonFromResponse, API client
│
├── workflows/               # 四个核心工作流
│   ├── ingest.ts            # 知识摄入处理
│   ├── query.ts             # 知识库查询
│   ├── lint.ts              # 健康度检查
│   └── graph.ts             # 知识图谱构建
│
└── cli/                     # CLI 入口
    ├── ingest.ts
    ├── query.ts
    ├── lint.ts
    └── graph.ts
```

### 核心特性

| 特性层面 | 详情描述 |
|---|---|
| 代码复用 | 使用共享的 `file-utils.ts` 等模块处理公共逻辑 |
| 类型安全 | 启用了 TypeScript 严格模式 |
| 模型管理 | 使用 `constants.ts` 集中配置 |
| Lint 性能 | 使用 `buildPageNameMap()` 实现 O(1) 查找 |
| 项目结构 | `src/{shared,workflows,cli}/` 各层逻辑分离 |
| 代码水准 | ESLint + Prettier |
| IDE 支持 | Claude Code, Cursor, Codex, Antigravity, Gemini CLI |

## 技术栈

- **运行环境:** Node.js 22.16.0 + TypeScript
- **大模型支持:** Anthropic Claude (通过 `@anthropic-ai/sdk`)
- **知识图谱:** graphology + graphology-communities-louvain + vis.js
- **命令行工具:** commander
- **开发工具:** ESLint, Prettier, tsx

## 开发指南

```bash
pnpm typecheck    # 校验 TypeScript 类型
pnpm lint         # 执行 ESLint 检查
pnpm format       # 执行 Prettier 格式化
pnpm build        # 编译代码到 dist/ 目录
```

## 详细文档

查看 `docs/` 目录以获取完整的文档资料：
- [大语言模型维基模式理念](docs/llm-wiki/llm-wiki.md) — 解释具备复利效应的知识库与 RAG 区别的核心思想
- [快速入门](docs/getting-started.md) — 快速启动引导
- [IDE 设定指南](docs/ide-setup.md) — 针对各种不同 IDE 的特定配置指令
- [工作流程参考手册](docs/workflows.md) — 详细记录不同 workflow 工作方式的配套文档
- [命令行接口全览](docs/cli-reference.md) — CLI 命令行模式的相关手册说明
- [架构指南](docs/architecture.md) — 系统组件与进一步二次开发的架构说明

## 开源协议许

采用 MIT 许可证 — 详情请查看 [LICENSE](LICENSE) 文件说明。
