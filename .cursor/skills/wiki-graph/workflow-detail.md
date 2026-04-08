# Wiki Graph — Detailed Workflow

## 执行流程

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

## 边类型

| 类型 | 说明 | 颜色 |
|---|---|---|
| `EXTRACTED` | 从 `[[wikilinks]]` 直接提取 | 深灰 (#555555) |
| `INFERRED` | 语义推断，高置信度 | 橙红 (#FF5722) |
| `AMBIGUOUS` | 语义推断，低置信度 | 浅灰 (#BDBDBD) |

## 节点类型颜色

| 类型 | 颜色 |
|---|---|
| `source` | 绿色 (#4CAF50) |
| `entity` | 蓝色 (#2196F3) |
| `concept` | 橙色 (#FF9800) |
| `synthesis` | 紫色 (#9C27B0) |
| `unknown` | 灰色 (#9E9E9E) |

## 增量缓存

Graph 工作流使用 SHA256 缓存机制（`graph/.cache.json`）：
- 每个页面的内容哈希被记录
- 下次构建时只处理内容变更的页面
- 这大幅减少了 API 调用次数

## Agent 模式步骤

当 Agent 手动构建图谱时（无 CLI）：

1. 使用 Grep 在 `wiki/` 中搜索所有 `[[wikilinks]]`
2. 构建节点列表（每个 wiki 页面一个节点）
3. 构建边列表（每个 wikilink 一条边）
4. 推断隐含关系（标记为 INFERRED 或 AMBIGUOUS）
5. 写入 `graph/graph.json`
6. 写入 `graph/graph.html`（使用 vis.js 模板生成自包含可视化页面）

## CLI 选项

```bash
pnpm dev:graph               # 默认：推断 + 不打开浏览器
pnpm dev:graph --open         # 构建后自动打开 graph.html
pnpm dev:graph --no-infer     # 跳过语义推断（更快，无 API 调用）
```
