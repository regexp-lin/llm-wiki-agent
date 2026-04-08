# Wiki Query — Detailed Workflow

## 执行流程

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

## Agent 模式步骤

Agent 模式（非 CLI）时，Agent 自己执行以下步骤：

1. 读取 `wiki/index.md`，确认 wiki 非空
2. 根据问题的关键词，在 index 中选择相关页面
3. 使用 Read 工具读取选中的页面
4. 综合所有页面内容，以 `[[PageName]]` wikilink 引用形式回答问题
5. 询问用户是否保存为 `wiki/syntheses/<slug>.md`
6. 如保存：写入 synthesis 页面、更新 index、追加 log

## --save 选项

CLI 模式下支持将回答保存为 wiki synthesis 页面：

```bash
pnpm dev:query "What is RAG?" --save syntheses/what-is-rag.md
```

Agent 模式下，agent 会在回答后询问是否保存。

## CLI 选项

```bash
pnpm dev:query "question"                           # 查询
pnpm dev:query "question" --save syntheses/slug.md   # 查询并保存
```
