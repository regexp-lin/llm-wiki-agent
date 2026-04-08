# Getting Started

本文档帮助你在 5 分钟内启动 LLM Wiki Agent。

---

## 前置条件

| 项目 | 要求 |
|---|---|
| Node.js | >= 22.16.0 (推荐使用 nvm/fnm 管理) |
| pnpm | 最新版 (通过 `corepack enable` 激活) |
| ANTHROPIC_API_KEY | 仅 CLI 模式需要；Agent 模式不需要 |

## 安装步骤

### 1. 克隆 / 进入项目

```bash
cd llm-wiki-agent-nodejs
```

### 2. 安装 Node.js 版本

项目根目录已有 `.nvmrc` 和 `.node-version` 文件，自动锁定 Node.js 22.16.0：

```bash
# nvm 用户
nvm install
nvm use

# fnm 用户
fnm use

# volta 用户（自动读取 .node-version）
volta install node
```

### 3. 安装依赖

```bash
pnpm install
```

### 4. 验证安装

```bash
pnpm typecheck   # TypeScript 类型检查，无错误即成功
pnpm build       # 编译到 dist/
```

---

## 两种使用模式

### Agent 模式（推荐）

在你喜欢的 Code Agent IDE 中打开本项目，直接用自然语言交互。无需设置 API Key。

```bash
# 选择你的 IDE
claude          # Claude Code
cursor          # Cursor
codex           # OpenAI Codex
gemini          # Gemini CLI / Antigravity
```

然后告诉 Agent 你想做什么：

```
ingest raw/papers/my-paper.md
query: what are the main themes?
lint
build graph
```

详细的 IDE 配置说明见 [IDE Setup Guide](ide-setup.md)。

### CLI 模式

CLI 模式直接调用 Anthropic API，需要设置环境变量：

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

然后使用 pnpm 脚本：

```bash
pnpm dev:ingest raw/papers/my-paper.md   # 摄入源文档
pnpm dev:query "question here"            # 查询知识库
pnpm dev:lint                             # 健康检查
pnpm dev:graph --open                     # 构建图谱并打开浏览器
```

详细的 CLI 用法见 [CLI Reference](cli-reference.md)。

---

## 快速体验

### Step 1: 准备源文档

在 `raw/` 目录下放入一个 Markdown 文件：

```bash
mkdir -p raw/articles
cat > raw/articles/test-article.md << 'EOF'
# Introduction to Large Language Models

Large Language Models (LLMs) like GPT-4 and Claude are neural networks
trained on vast amounts of text data. They can generate human-like text,
answer questions, and assist with coding tasks.

Key companies in the LLM space include OpenAI (creators of GPT-4),
Anthropic (creators of Claude), and Google (creators of Gemini).

## Applications

- Code generation and assistance
- Content creation and summarization
- Question answering and research
- Translation and language tasks
EOF
```

### Step 2: 摄入文档

**Agent 模式：**
```
ingest raw/articles/test-article.md
```

**CLI 模式：**
```bash
pnpm dev:ingest raw/articles/test-article.md
```

### Step 3: 查询知识

**Agent 模式：**
```
query: What are the main LLM companies?
```

**CLI 模式：**
```bash
pnpm dev:query "What are the main LLM companies?"
```

### Step 4: 检查 Wiki 产出

```bash
ls wiki/sources/       # 查看生成的 source page
ls wiki/entities/      # 查看生成的 entity pages
cat wiki/index.md      # 查看更新后的索引
cat wiki/log.md        # 查看操作日志
```

---

## 下一步

- [IDE Setup Guide](ide-setup.md) — 配置你的 IDE
- [Workflows Reference](workflows.md) — 深入了解四大工作流
- [CLI Reference](cli-reference.md) — CLI 命令详解
- [Architecture](architecture.md) — 系统架构与扩展
