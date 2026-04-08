# CLI Reference

本文档详细说明 LLM Wiki Agent 的命令行接口。

---

## 前置条件

CLI 模式直接调用 Anthropic API，需要：

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

确保已安装依赖：

```bash
pnpm install
```

---

## 命令列表

### wiki-ingest — 摄入源文档

```bash
pnpm dev:ingest <source>
```

**参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `<source>` | 是 | 源文件路径（相对或绝对路径） |

**示例：**

```bash
# 摄入单个文件
pnpm dev:ingest raw/articles/my-article.md

# 使用绝对路径
pnpm dev:ingest /path/to/document.md

# 编译后运行
pnpm build
node dist/cli/ingest.js raw/articles/my-article.md
```

**输出：**

```
Ingesting: my-article.md  (hash: a1b2c3d4e5f6g7h8)
  calling Claude API...
  wrote: wiki/sources/my-article.md
  wrote: wiki/entities/OpenAI.md
  wrote: wiki/concepts/MachineLearning.md
  wrote: wiki/index.md
  wrote: wiki/log.md

Done. Ingested: My Article Title
```

**错误处理：**
- 源文件不存在 → 退出码 1
- API 响应解析失败 → 保存原始响应到 `.debug/ingest_debug.txt`

---

### wiki-query — 查询知识

```bash
pnpm dev:query <question> [--save [path]]
```

**参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `<question>` | 是 | 要查询的问题 |
| `--save [path]` | 否 | 保存回答为 wiki synthesis 页面 |

**示例：**

```bash
# 基本查询
pnpm dev:query "What are the main themes across all sources?"

# 查询并保存结果
pnpm dev:query "What is RAG?" --save syntheses/what-is-rag.md

# 编译后运行
node dist/cli/query.js "What are the main themes?"
```

**输出：**

```
  selecting relevant pages via Claude...
  synthesizing answer from 5 pages...

============================================================
# Main Themes Across Sources

Based on the wiki content, the main themes are:
...
============================================================
```

---

### wiki-lint — 健康检查

```bash
pnpm dev:lint [--save]
```

**参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `--save` | 否 | 将 lint 报告保存到 `wiki/lint-report.md` |

**示例：**

```bash
# 运行检查，仅输出到终端
pnpm dev:lint

# 运行检查并保存报告
pnpm dev:lint --save
```

**输出示例：**

```
=== Wiki Lint Report ===

## Orphan Pages (2)
- wiki/entities/OldCompany.md
- wiki/concepts/DeprecatedTech.md

## Broken Links (1)
- wiki/sources/paper-a.md → [[NonExistentPage]]

## Missing Entity Pages (1)
- "DeepMind" (referenced in 4 pages, no dedicated page)

## Semantic Issues
- Contradiction: wiki/sources/paper-a.md claims X, but wiki/sources/paper-b.md claims Y
...
```

---

### wiki-graph — 构建图谱

```bash
pnpm dev:graph [--no-infer] [--open]
```

**参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `--no-infer` | 否 | 跳过语义推断（更快，无 API 调用） |
| `--open` | 否 | 构建后自动在浏览器中打开 graph.html |

**示例：**

```bash
# 完整构建（包含语义推断）
pnpm dev:graph

# 快速构建（仅提取 wikilinks，无 API 调用）
pnpm dev:graph --no-infer

# 构建并打开浏览器
pnpm dev:graph --open

# 组合使用
pnpm dev:graph --no-infer --open
```

**输出：**

```
Building wiki graph...
  Pass 1: extracting wikilinks... 15 nodes, 23 edges
  Pass 2: inferring relationships... 3 new inferred edges
  Community detection: 4 communities
  wrote: graph/graph.json
  wrote: graph/graph.html

Graph built: 15 nodes, 26 edges
```

**产出文件：**

| 文件 | 说明 |
|---|---|
| `graph/graph.json` | 节点和边数据（JSON 格式） |
| `graph/graph.html` | 自包含的 vis.js 交互式可视化页面 |
| `graph/.cache.json` | SHA256 缓存（用于增量构建） |

---

## 开发命令

| 命令 | 说明 |
|---|---|
| `pnpm build` | TypeScript 编译到 `dist/` |
| `pnpm typecheck` | TypeScript 类型检查 (tsc --noEmit) |
| `pnpm lint` | ESLint 代码检查 |
| `pnpm format` | Prettier 格式化 |
| `pnpm format:check` | Prettier 格式检查（不修改文件） |

---

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | CLI 模式需要 | Anthropic API 密钥 |

Agent 模式不需要设置环境变量，API 调用由 IDE 的 agent 处理。

---

## 退出码

| 码 | 说明 |
|---|---|
| 0 | 成功 |
| 1 | 错误（文件不存在、API 错误、wiki 为空等） |
