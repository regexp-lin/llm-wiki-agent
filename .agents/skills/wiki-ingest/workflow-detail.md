# Wiki Ingest — Detailed Workflow

## 执行流程（单文件模式）

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

## 执行流程（批量模式）

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

## Agent 模式步骤

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

## 源文件要求

- 放在 `raw/` 目录下（raw 目录是不可变的，agent 不会修改）
- 格式：Markdown (.md) 或纯文本 (.txt)
- 内容：任何文本类的源文档（论文、文章、笔记、报告等）

## 产出示例

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

## CLI 选项

```bash
pnpm dev:ingest                          # 批量模式
pnpm dev:ingest raw/my-article.md        # 单文件模式
pnpm dev:ingest --force                  # 强制重新摄入所有
pnpm dev:ingest raw/file.md --force      # 强制重新摄入单文件
pnpm dev:ingest --dry-run                # 预览模式
pnpm dev:ingest --status                 # 查看缓存状态
pnpm dev:ingest --clean                  # 清除缓存
pnpm dev:ingest --concurrency 3          # 并行批量摄入
```
