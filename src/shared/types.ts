export type PageType = "source" | "entity" | "concept" | "synthesis" | "unknown";

export interface WikiPage {
  path: string;
  stem: string;
  content: string;
  type: PageType;
  title: string;
}

export interface IngestResult {
  title: string;
  slug: string;
  source_page: string;
  index_entry: string;
  overview_update: string | null;
  entity_pages: PageUpdate[];
  concept_pages: PageUpdate[];
  contradictions: string[];
  log_entry: string;
}

export interface PageUpdate {
  path: string;
  content: string;
}

export interface QueryOptions {
  question: string;
  savePath?: string;
}

export interface LintReport {
  orphans: string[];
  brokenLinks: BrokenLink[];
  missingEntities: string[];
  semanticReport: string;
  fullReport: string;
}

export interface BrokenLink {
  sourcePage: string;
  targetLink: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: PageType;
  color: string;
  path: string;
  group?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  color: string;
  confidence: number;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  built: string;
}

export interface InferredRelation {
  to: string;
  relationship?: string;
  confidence: number;
  type: "INFERRED" | "AMBIGUOUS";
}

export interface GraphCache {
  [filePath: string]: string;
}
