# Wiki Lint — Detailed Workflow

## 执行流程

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

## 检查项目详情

| 检查类型 | 说明 | 是否需要 API |
|---|---|---|
| 孤立页面 | 没有任何页面链接到它 | 否 |
| 断链 | `[[PageName]]` 指向的页面不存在 | 否 |
| 缺失实体 | 被 3+ 个页面引用但没有独立页面 | 否 |
| 矛盾 | 不同页面之间的声明冲突 | 是 (Sonnet) |
| 过时内容 | 新源文档改变了结论但旧页面未更新 | 是 (Sonnet) |
| 数据缺口 | wiki 无法回答的重要问题 | 是 (Sonnet) |

## Agent 模式详细步骤

1. 使用 Glob 工具收集 `wiki/**/*.md`，排除 `index.md`、`log.md`、`lint-report.md`
2. 使用 Grep 工具搜索所有 `[[wikilinks]]` 模式
3. 构建两个集合：
   - 所有页面名称集合（从文件名推断）
   - 所有被引用名称集合（从 wikilinks 提取）
4. **孤立页面** = 存在但从未被引用的页面
5. **断链** = 被引用但不存在的页面名称
6. **缺失实体** = 被引用 ≥3 次但没有独立页面的名称
7. 读取各页面内容，检查语义层面的矛盾和过时问题
8. 汇总报告，格式化输出

## CLI 选项

```bash
pnpm dev:lint                    # 运行所有检查
pnpm dev:lint --save             # 运行并保存报告
```
