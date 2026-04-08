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
pnpm dev:ingest [source] [options]
```

**参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `[source]` | 否 | 源文件路径（省略则扫描 raw/ 目录进行批量处理） |

**选项：**

| 选项 | 说明 |
|---|---|
| `--force` | 强制重新 ingest，忽略缓存 |
| `--dry-run` | 仅预览哪些文件会被处理，不执行 |
| `--clean` | 清除 ingest 缓存并退出 |
| `--status` | 显示所有文件的缓存状态并退出 |
| `--concurrency <n>` | 批量模式下的并行 worker 数（默认 1） |

**示例：**

```bash
# 批量模式 — 扫描 raw/ 目录，自动跳过已处理文件
pnpm dev:ingest

# 单文件模式 — 指定文件，有缓存则跳过
pnpm dev:ingest raw/papers/attention.md

# 单文件 + 强制重新处理
pnpm dev:ingest raw/papers/attention.md --force

# 批量 + 强制全部重新处理
pnpm dev:ingest --force

# 预览模式 — 查看哪些文件会被处理
pnpm dev:ingest --dry-run

# 预览 + 强制 — 查看如果全部重新处理会有哪些
pnpm dev:ingest --dry-run --force

# 查看缓存状态
pnpm dev:ingest --status

# 清除缓存
pnpm dev:ingest --clean

# 并行批量处理 (3 个 worker)
pnpm dev:ingest --concurrency 3

# 编译后运行
pnpm build
node dist/cli/ingest.js raw/articles/my-article.md
```

**批量模式输出示例：**

```
Scan complete: 5 files found
  To process: 2
  Skipped:    3
    [+NEW] raw/papers/new-paper.md
    [~CHANGED] raw/articles/updated-article.md

[1/2] Ingesting: raw/papers/new-paper.md
  calling Claude API...
  wrote: wiki/sources/new-paper.md
  wrote: wiki/entities/SomeEntity.md
  wrote: wiki/index.md
  wrote: wiki/log.md
Done. Ingested: New Paper Title

[2/2] Ingesting: raw/articles/updated-article.md
  calling Claude API...
  wrote: wiki/sources/updated-article.md
  wrote: wiki/index.md
  wrote: wiki/log.md
Done. Ingested: Updated Article Title

Batch complete. Processed: 2, Failed: 0, Skipped: 3
```

**--status 输出示例：**

```
Ingest cache: 3 entries

  Status  | Path                                    | Title
  --------|-----------------------------------------|------
  CACHED  | raw/papers/attention.md                 | Attention Is All You Need
  CHANGED | raw/articles/rag-survey.md              | RAG Survey
  CACHED  | raw/papers/bert.md                      | BERT

  Not cached (1):
    [NEW]     raw/papers/new-paper.md
```

**Dry-run 输出示例：**

```
Scan complete: 5 files found
  To process: 2
  Skipped:    3
    [+NEW] raw/papers/new-paper.md
    [~CHANGED] raw/articles/updated-article.md

--dry-run: no files were processed.
```

**错误处理：**
- 源文件不存在 → 退出码 1
- API 响应解析失败 → 保存原始响应到 `.debug/ingest_debug.txt`
- 批量模式单文件失败 → 继续处理下一个文件

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
