/**
 * Query 工作流评估脚本
 *
 * 测试 findRelevantPages 的检索质量（无需 API key）。
 * 传 --full 参数时运行完整的 LLM query（需要 ANTHROPIC_API_KEY）。
 */
import fs from "node:fs";
import path from "node:path";
import { findRelevantPages } from "../src/workflows/query.js";

const WIKI_DIR = path.resolve(import.meta.dirname, "../wiki");
const INDEX_FILE = path.join(WIKI_DIR, "index.md");

interface TestCase {
  id: number;
  query: string;
  expectedPages: string[];
  description: string;
}

const testCases: TestCase[] = [
  {
    id: 1,
    query: "ai-lowcode 是什么？",
    expectedPages: ["overview.md", "sources/architecture.md"],
    description: "简单实体查询（精确匹配）",
  },
  {
    id: 2,
    query: "DesignSchemaDocument 和 RuntimeSchemaDocument 有什么区别？",
    expectedPages: ["concepts/DesignSchemaDocument.md", "concepts/RuntimeSchemaDocument.md", "sources/schema-protocol.md"],
    description: "概念查询",
  },
  {
    id: 3,
    query: "设计器的核心数据流是怎样的？",
    expectedPages: ["sources/architecture.md", "concepts/DesignerEngine.md"],
    description: "架构层面查询",
  },
  {
    id: 4,
    query: "物料系统的注册和解析机制是怎样的？",
    expectedPages: ["sources/material-development.md", "concepts/MaterialRegistry.md", "concepts/ComponentResolver.md"],
    description: "跨文档综合查询",
  },
  {
    id: 5,
    query: "旧 LCP 平台和新 ai-lowcode 平台有哪些主要区别？",
    expectedPages: ["entities/LegacyLCP.md", "entities/AiLowcode.md"],
    description: "旧平台对比查询",
  },
  {
    id: 6,
    query: "任务10到任务17的完成情况汇总",
    expectedPages: ["sources/todo-10-", "sources/todo-17-"],
    description: "任务进度查询",
  },
  {
    id: 7,
    query: "How does the host integration work?",
    expectedPages: ["sources/host-integration.md", "concepts/HostContract.md"],
    description: "英文技术术语查询",
  },
  {
    id: 8,
    query: "当前 wiki 中有哪些尚未解决的技术风险？",
    expectedPages: ["overview.md", "sources/mvp-checklist.md"],
    description: "抽象问题（需要综合分析）",
  },
  {
    id: 9,
    query: "怎么写复杂业务逻辑？",
    expectedPages: ["sources/todo-result-b58dae3e.md", "sources/todo-spec-1a3f9166.md"],
    description: "模糊查询（语义匹配）",
  },
  {
    id: 10,
    query: "ValueExpression 的作用和用法",
    expectedPages: ["concepts/ValueExpression.md"],
    description: "细粒度技术查询",
  },
];

function evaluateRetrieval(
  testCase: TestCase,
  retrieved: { title: string; href: string; score: number }[],
): { hits: number; misses: string[]; precision: number; retrievedPaths: string[] } {
  const retrievedPaths = retrieved.map((r) => r.href);
  let hits = 0;
  const misses: string[] = [];

  for (const expected of testCase.expectedPages) {
    const found = retrievedPaths.some((rp) => rp.includes(expected));
    if (found) {
      hits++;
    } else {
      misses.push(expected);
    }
  }

  const precision = testCase.expectedPages.length > 0
    ? hits / testCase.expectedPages.length
    : 0;

  return { hits, misses, precision, retrievedPaths };
}

async function runRetrievalEval(): Promise<void> {
  const indexContent = fs.readFileSync(INDEX_FILE, "utf-8");

  console.log("=" .repeat(70));
  console.log("LLM Wiki Query — 检索阶段评估（findRelevantPages）");
  console.log("=" .repeat(70));
  console.log();

  let totalPrecision = 0;
  const results: Array<{
    id: number;
    description: string;
    precision: number;
    hits: number;
    total: number;
  }> = [];

  for (const tc of testCases) {
    const retrieved = findRelevantPages(tc.query, indexContent);
    const eval_ = evaluateRetrieval(tc, retrieved);

    console.log(`--- Case ${tc.id}: ${tc.description} ---`);
    console.log(`  Query: "${tc.query}"`);
    console.log(`  Retrieved (${retrieved.length} pages):`);
    for (const r of retrieved.slice(0, 8)) {
      console.log(`    [score=${r.score}] ${r.href} — ${r.title}`);
    }
    if (retrieved.length > 8) {
      console.log(`    ... and ${retrieved.length - 8} more`);
    }
    console.log(`  Expected: ${tc.expectedPages.join(", ")}`);
    console.log(`  Hits: ${eval_.hits}/${tc.expectedPages.length} (${(eval_.precision * 100).toFixed(0)}%)`);
    if (eval_.misses.length > 0) {
      console.log(`  Misses: ${eval_.misses.join(", ")}`);
    }
    console.log();

    totalPrecision += eval_.precision;
    results.push({
      id: tc.id,
      description: tc.description,
      precision: eval_.precision,
      hits: eval_.hits,
      total: tc.expectedPages.length,
    });
  }

  const avgPrecision = totalPrecision / testCases.length;

  console.log("=" .repeat(70));
  console.log("评估汇总");
  console.log("=" .repeat(70));
  console.log();
  console.log("| Case | 描述 | 命中率 | 命中/期望 |");
  console.log("|------|------|--------|-----------|");
  for (const r of results) {
    console.log(
      `| ${r.id} | ${r.description} | ${(r.precision * 100).toFixed(0)}% | ${r.hits}/${r.total} |`,
    );
  }
  console.log();
  console.log(`平均召回率: ${(avgPrecision * 100).toFixed(1)}%`);
  console.log();

  if (avgPrecision >= 0.8) {
    console.log("评价: 优秀 — 检索阶段能覆盖大部分期望页面");
  } else if (avgPrecision >= 0.6) {
    console.log("评价: 良好 — 检索阶段基本可用，但部分场景有遗漏");
  } else if (avgPrecision >= 0.4) {
    console.log("评价: 一般 — 检索阶段存在较多遗漏，需要依赖 LLM fallback");
  } else {
    console.log("评价: 较差 — 关键词匹配对当前 wiki 内容效果不佳");
  }
}

async function main(): Promise<void> {
  const fullMode = process.argv.includes("--full");

  await runRetrievalEval();

  if (fullMode) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("\n⚠ --full 模式需要 ANTHROPIC_API_KEY 环境变量");
      process.exit(1);
    }
    console.log("\n完整 Query 测试暂未实现（需要实际 API 调用）");
  }
}

main().catch(console.error);
