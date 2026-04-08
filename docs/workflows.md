# Workflows Reference

本文档详细描述 LLM Wiki Agent 的四大核心工作流。

---

## 1. Ingest — 知识摄入

将源文档转化为结构化的 wiki 页面。支持单文件和批量两种模式，基于 SHA256 内容哈希的缓存机制确保幂等性。

### 触发方式

| IDE | 触发方式 |
|---|---|
| Claude Code | `/wiki-ingest raw/file.md` 或 `ingest` (批量) |
| Cursor | `ingest raw/file.md` 或 `ingest` (批量) |
| Codex | `ingest raw/file.md` 或 `ingest` (批量) |
| Antigravity | `ingest raw/file.md` 或 `ingest` (批量) |
| CLI | `pnpm dev:ingest [source] [options]` |

### 执行流程（单文件模式）

```
输入: 源文件路径 (string), 可选 --force
  │
  ▼
1. 加载 wiki/.ingest-cache.json
  │
  ▼
2. 缓存判定
   ├── 计算文件 SHA256
   ├── 无缓存记录 → NEW
   ├── 哈希不匹配 → CHANGED
   ├── 输出文件缺失 → OUTPUT_MISSING
   ├── 完全匹配 → CACHED (跳过)
   └── --force → FORCED (强制处理)
  │
  ▼
3. 构建 Wiki 上下文
   ├── 读取 wiki/index.md
   ├── 读取 wiki/overview.md
   └── 读取最近 5 个 source pages (按修改时间排序)
  │
  ▼
4. 读取 Wiki Schema (WIKI_SCHEMA.md)
  │
  ▼
5. 调用 Claude Sonnet API
   ├── 组装 Prompt (schema + context + source)
   ├── max_tokens: 8192
   └── 返回结构化 JSON
  │
  ▼
6. 解析 JSON → 错误时保存 debug 文件
  │
  ▼
7. 批量写入文件
   ├── wiki/sources/<slug>.md     (source page)
   ├── wiki/entities/<Name>.md    (0~N 个 entity pages)
   ├── wiki/concepts/<Name>.md    (0~N 个 concept pages)
   ├── wiki/overview.md           (如需更新)
   ├── wiki/index.md              (添加新条目)
   └── wiki/log.md                (追加日志)
  │
  ▼
8. 更新 wiki/.ingest-cache.json
  │
  ▼
9. 报告矛盾 (如有)
  │
  ▼
输出: 完成摘要
```

### 执行流程（批量模式）

```
输入: 无参数, 可选 --force --dry-run --concurrency <n>
  │
  ▼
1. 递归扫描 raw/ 目录 (.md, .txt 文件)
  │
  ▼
2. 加载 wiki/.ingest-cache.json
  │
  ▼
3. 清理过期缓存条目 (源文件已删除的)
  │
  ▼
4. 对每个文件执行缓存判定
  │
  ▼
5. 输出扫描摘要
   ├── 总文件数
   ├── 需处理数 (按状态分类)
   └── 跳过数
  │
  ▼
6. --dry-run → 到此结束
  │
  ▼
7. 逐个（或并行）执行 ingest
   ├── 每个文件成功后更新缓存到磁盘
   └── 失败不中断批量流程
  │
  ▼
输出: 批量完成摘要 (processed / failed / skipped)
```

### 缓存判定逻辑

| 状态 | 含义 | 处理 |
|------|------|------|
| `NEW` | 缓存中无记录，首次处理 | 执行 ingest |
| `CHANGED` | 源文件内容已变化 | 重新 ingest |
| `OUTPUT_MISSING` | 源文件未变但输出被删除 | 重新 ingest |
| `CACHED` | 完全匹配，跳过 | 打印跳过消息 |
| `FORCED` | 用户强制重新处理 | 无条件执行 |

### Agent 模式步骤

Agent 模式（非 CLI）时，Agent 自己执行以下步骤：

**单文件:**
1. 读取 `wiki/.ingest-cache.json`，计算源文件 SHA256
2. 检查缓存，决定是否跳过
3. **读取源文件** — 使用 Read 工具读取 `raw/` 中的文件
4. **读取上下文** — 读取 `wiki/index.md` 和 `wiki/overview.md`
5. **写入 source page** — 在 `wiki/sources/` 中创建 `<slug>.md`
6. **更新 index** — 在 `wiki/index.md` 的 Sources 部分添加条目
7. **更新 overview** — 如有需要，修订 `wiki/overview.md`
8. **创建/更新 entity pages** — 在 `wiki/entities/` 中创建关键人物、公司、项目的页面
9. **创建/更新 concept pages** — 在 `wiki/concepts/` 中创建关键概念、框架的页面
10. **报告矛盾** — 如与现有 wiki 内容有矛盾，标记出来
11. **追加日志** — 在 `wiki/log.md` 中追加操作记录
12. **更新缓存** — 更新 `wiki/.ingest-cache.json`

**批量:** 先扫描 `raw/`、加载缓存、报告状态，然后对需要处理的文件逐个执行上述步骤。

### 源文件要求

- 放在 `raw/` 目录下（raw 目录是不可变的，agent 不会修改）
- 格式：Markdown (.md) 或纯文本 (.txt)
- 内容：任何文本类的源文档（论文、文章、笔记、报告等）

### 产出示例

摄入 `raw/articles/attention.md` 后会生成：

```
wiki/
├── sources/attention-is-all-you-need.md   # 新建：source page
├── entities/
│   ├── Google.md                          # 新建或更新
│   └── Transformer.md                     # 新建或更新
├── concepts/
│   ├── Attention.md                       # 新建或更新
│   └── SelfAttention.md                   # 新建或更新
├── index.md                               # 更新：添加新条目
├── overview.md                            # 更新：修订综合描述
├── log.md                                 # 更新：追加日志
└── .ingest-cache.json                     # 更新：记录缓存条目
```

---

## 2. Query — 知识查询

从 wiki 知识库中综合回答问题。

### 触发方式

| IDE | 触发方式 |
|---|---|
| Claude Code | `/wiki-query <question>` 或 `query: <question>` |
| Cursor | `query: <question>` |
| Codex | `query: <question>` |
| Antigravity | `query: <question>` |
| CLI | `pnpm dev:query "<question>"` |

### 执行流程

```
输入: 问题 (string), 可选保存路径
  │
  ▼
1. 读取 wiki/index.md (空则报错)
  │
  ▼
2. Level 1: 关键词匹配选择相关页面
   ├── 从 index 提取 [title](href) 链接
   ├── 标题分词 → 过滤 ≤3 字符的词
   ├── 与 question 做交集
   └── 始终包含 overview.md, 上限 12 页
  │
  ▼
3. Level 2 (匹配不足时): 调用 Haiku 选择
   └── 返回 JSON 路径数组
  │
  ▼
4. 读取选中页面内容
  │
  ▼
5. 调用 Claude Sonnet 综合回答
   ├── 使用 [[WikiLink]] 引用
   └── max_tokens: 4096
  │
  ▼
6. 输出答案
   ├── --save → 写入 wiki/syntheses/<slug>.md + 更新 index
   └── 追加 wiki/log.md
```

### --save 选项

CLI 模式下支持将回答保存为 wiki synthesis 页面：

```bash
pnpm dev:query "What is RAG?" --save syntheses/what-is-rag.md
```

Agent 模式下，agent 会在回答后询问是否保存。

---

## 3. Lint — 健康检查

检查 wiki 的结构性和语义性问题。

### 触发方式

| IDE | 触发方式 |
|---|---|
| Claude Code | `/wiki-lint` 或 `lint the wiki` |
| Cursor | `lint the wiki` 或 `lint` |
| Codex | `lint` |
| Antigravity | `lint` |
| CLI | `pnpm dev:lint` |

### 执行流程

```
输入: (无参数)
  │
  ▼
1. 收集所有 Wiki 页面 (排除 index/log/lint-report)
  │
  ▼
2. 预构建 name→path 映射 (性能优化)
  │
  ▼
3. 结构性检查 (零 API 调用)
   ├── findOrphans: 无入链的页面
   ├── findBrokenLinks: [[Link]] 目标不存在
   └── findMissingEntities: ≥3 次引用但无独立页面
  │
  ▼
4. 语义检查 (调用 Claude Sonnet)
   ├── 最多 20 页，每页截取 1500 字
   └── 输出: 矛盾/过时/空白/深度不足
  │
  ▼
5. 组装完整报告
   ├── --save → 写入 wiki/lint-report.md
   └── 追加 wiki/log.md
```

### 检查项目

| 检查类型 | 说明 | 是否需要 API |
|---|---|---|
| 孤立页面 | 没有任何页面链接到它 | 否 |
| 断链 | `[[PageName]]` 指向的页面不存在 | 否 |
| 缺失实体 | 被 3+ 个页面引用但没有独立页面 | 否 |
| 矛盾 | 不同页面之间的声明冲突 | 是 (Sonnet) |
| 过时内容 | 新源文档改变了结论但旧页面未更新 | 是 (Sonnet) |
| 数据缺口 | wiki 无法回答的重要问题 | 是 (Sonnet) |

---

## 4. Graph — 知识图谱

构建 wiki 页面间的关系图谱。

### 触发方式

| IDE | 触发方式 |
|---|---|
| Claude Code | `/wiki-graph` 或 `build the knowledge graph` |
| Cursor | `build the knowledge graph` 或 `build graph` |
| Codex | `build graph` |
| Antigravity | `build graph` |
| CLI | `pnpm dev:graph` |

### 执行流程

```
输入: infer (boolean, 默认 true), open (boolean, 默认 false)
  │
  ▼
1. 收集所有 Wiki 页面
  │
  ▼
2. Pass 1: 确定性边提取 (零 API 调用)
   ├── 遍历每页的 [[WikiLink]]
   ├── 去重
   └── 生成 EXTRACTED 类型边
  │
  ▼
3. Pass 2: 语义推断 (可选, 调用 Haiku)
   ├── SHA256 对比 → 仅处理变更页面
   ├── 解析 INFERRED/AMBIGUOUS 边
   └── 更新缓存
  │
  ▼
4. Louvain 社区检测
   ├── 构建无向图
   ├── 运行 Louvain 算法
   └── 分配社区 ID 和颜色
  │
  ▼
5. 输出
   ├── graph/graph.json (节点/边/日期)
   ├── graph/graph.html (vis.js 自包含可视化)
   └── 更新 .cache.json
  │
  ▼
6. 追加 wiki/log.md
```

### CLI 选项

```bash
pnpm dev:graph               # 默认：推断 + 不打开浏览器
pnpm dev:graph --open         # 构建后自动打开 graph.html
pnpm dev:graph --no-infer     # 跳过语义推断（更快，无 API 调用）
```

### 边类型

| 类型 | 说明 | 颜色 |
|---|---|---|
| `EXTRACTED` | 从 `[[wikilinks]]` 直接提取 | 深灰 (#555555) |
| `INFERRED` | 语义推断，高置信度 | 橙红 (#FF5722) |
| `AMBIGUOUS` | 语义推断，低置信度 | 浅灰 (#BDBDBD) |

### 节点类型颜色

| 类型 | 颜色 |
|---|---|
| `source` | 绿色 (#4CAF50) |
| `entity` | 蓝色 (#2196F3) |
| `concept` | 橙色 (#FF9800) |
| `synthesis` | 紫色 (#9C27B0) |
| `unknown` | 灰色 (#9E9E9E) |

### 增量缓存

Graph 工作流使用 SHA256 缓存机制（`graph/.cache.json`）：
- 每个页面的内容哈希被记录
- 下次构建时只处理内容变更的页面
- 这大幅减少了 API 调用次数

---

## 工作流对比

| 维度 | Ingest | Query | Lint | Graph |
|---|---|---|---|---|
| 输入 | 源文件路径（可选） | 问题 | 无 | 无 |
| API 调用 | 1 (Sonnet) per file | 1-2 (Haiku + Sonnet) | 1 (Sonnet) | 0-N (Haiku per page) |
| 写入文件 | 多个 wiki 页面 + 缓存 | 可选 synthesis | 可选 lint-report | graph.json + graph.html |
| 幂等性 | 是（基于内容哈希缓存） | 是（同问题可重复查询） | 是 | 是（相同内容不重复推断） |
| 批量模式 | 是（自动扫描 raw/） | 否 | 否 | 否 |
