import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(__dirname, "../..");
export const WIKI_DIR = path.join(REPO_ROOT, "wiki");
export const GRAPH_DIR = path.join(REPO_ROOT, "graph");
export const RAW_DIR = path.join(REPO_ROOT, "raw");
export const LOG_FILE = path.join(WIKI_DIR, "log.md");
export const INDEX_FILE = path.join(WIKI_DIR, "index.md");
export const OVERVIEW_FILE = path.join(WIKI_DIR, "overview.md");
export const SCHEMA_FILE = path.join(REPO_ROOT, "WIKI_SCHEMA.md");
export const GRAPH_JSON = path.join(GRAPH_DIR, "graph.json");
export const GRAPH_HTML = path.join(GRAPH_DIR, "graph.html");
export const CACHE_FILE = path.join(GRAPH_DIR, ".cache.json");
export const INGEST_CACHE_FILE = path.join(WIKI_DIR, ".ingest-cache.json");

export const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);

export const MODEL_SONNET = "claude-sonnet-4-6";
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";

export const TYPE_COLORS: Record<string, string> = {
  source: "#4CAF50",
  entity: "#2196F3",
  concept: "#FF9800",
  synthesis: "#9C27B0",
  unknown: "#9E9E9E",
};

export const EDGE_COLORS: Record<string, string> = {
  EXTRACTED: "#555555",
  INFERRED: "#FF5722",
  AMBIGUOUS: "#BDBDBD",
};

export const COMMUNITY_COLORS = [
  "#E91E63",
  "#00BCD4",
  "#8BC34A",
  "#FF5722",
  "#673AB7",
  "#FFC107",
  "#009688",
  "#F44336",
  "#3F51B5",
  "#CDDC39",
];

export const INDEX_TEMPLATE = `# Wiki Index

## Overview
- [Overview](overview.md) — living synthesis

## Sources

## Entities

## Concepts

## Syntheses
`;

export const EXCLUDED_PAGES = new Set(["index.md", "log.md", "lint-report.md"]);
