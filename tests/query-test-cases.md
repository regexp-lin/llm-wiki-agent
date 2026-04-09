# Query 测试用例

用于评估 llm-wiki-agent-nodejs 的 Query 工作流检索和回答质量。

## 测试用例设计原则

- 覆盖不同复杂度：简单事实查询 → 跨页面综合 → 抽象分析
- 覆盖中英文混合场景
- 包含预期涉及的 wiki 页面，用于评估检索准确率

---

## 测试用例

### Case 1: 简单实体查询（精确匹配）

- **Query**: `ai-lowcode 是什么？`
- **期望涉及页面**: `overview.md`, `sources/architecture.md`, `entities/AiLowcode.md`
- **评估重点**: 能否命中核心 entity 页面

### Case 2: 概念查询

- **Query**: `DesignSchemaDocument 和 RuntimeSchemaDocument 有什么区别？`
- **期望涉及页面**: `concepts/DesignSchemaDocument.md`, `concepts/RuntimeSchemaDocument.md`, `sources/schema-protocol.md`
- **评估重点**: 能否同时命中两个 concept 页面

### Case 3: 架构层面查询

- **Query**: `设计器的核心数据流是怎样的？`
- **期望涉及页面**: `sources/architecture.md`, `concepts/DesignerEngine.md`, `concepts/CanvasSystem.md`, `concepts/HistoryStack.md`
- **评估重点**: 能否通过"设计器"匹配到相关页面

### Case 4: 跨文档综合查询

- **Query**: `物料系统的注册和解析机制是怎样的？`
- **期望涉及页面**: `sources/material-development.md`, `concepts/MaterialRegistry.md`, `concepts/MaterialDefinition.md`, `concepts/ComponentResolver.md`
- **评估重点**: 能否综合多个 concept 页面回答

### Case 5: 旧平台对比查询

- **Query**: `旧 LCP 平台和新 ai-lowcode 平台有哪些主要区别？`
- **期望涉及页面**: `entities/LegacyLCP.md`, `entities/AiLowcode.md`, `sources/todo-lcp-ai-lowcode-*`
- **评估重点**: 能否跨 entity + source 综合对比

### Case 6: 任务进度查询

- **Query**: `任务10到任务17的完成情况汇总`
- **期望涉及页面**: `sources/todo-10-*`, `sources/todo-11-*`, ..., `sources/todo-17-*`
- **评估重点**: 能否匹配以数字编号的任务页面

### Case 7: 英文技术术语查询

- **Query**: `How does the host integration work?`
- **期望涉及页面**: `sources/host-integration.md`, `concepts/HostContract.md`, `concepts/LCModule.md`
- **评估重点**: 英文查询能否匹配中文标题的页面

### Case 8: 抽象问题（需要综合分析）

- **Query**: `当前 wiki 中有哪些尚未解决的技术风险？`
- **期望涉及页面**: `overview.md`, `sources/mvp-checklist.md`, lint 相关页面
- **评估重点**: 需要 LLM 语义理解，关键词匹配可能失效

### Case 9: 模糊查询（语义匹配）

- **Query**: `怎么写复杂业务逻辑？`
- **期望涉及页面**: `sources/todo-result-b58dae3e.md`（复杂业务逻辑怎么写 —— 分析结论）, `sources/todo-spec-1a3f9166.md`
- **评估重点**: "怎么写" 这种口语化表达能否匹配到正确的 source

### Case 10: 细粒度技术查询

- **Query**: `ValueExpression 的作用和用法`
- **期望涉及页面**: `concepts/ValueExpression.md`, `concepts/PageStateModel.md`
- **评估重点**: 能否通过精确概念名匹配

---

## 运行方式

```bash
# 仅测试检索阶段（无需 API key）
pnpm tsx tests/query-eval.ts

# 完整查询测试（需要 ANTHROPIC_API_KEY）
# ANTHROPIC_API_KEY=sk-xxx pnpm tsx tests/query-eval.ts --full
```
