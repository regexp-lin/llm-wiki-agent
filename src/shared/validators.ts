import { z } from "zod";

export const PageUpdateSchema = z.object({
  path: z.string().min(1),
  content: z.string().min(1),
});

export const IngestResultSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  source_page: z.string().min(1),
  index_entry: z.string().min(1),
  overview_update: z.string().nullable(),
  entity_pages: z.array(PageUpdateSchema).default([]),
  concept_pages: z.array(PageUpdateSchema).default([]),
  contradictions: z.array(z.string()).default([]),
  log_entry: z.string().min(1),
});

export const InferredRelationSchema = z.object({
  to: z.string().min(1),
  relationship: z.string().optional(),
  confidence: z.number().min(0).max(1),
  type: z.enum(["INFERRED", "AMBIGUOUS"]),
});

export const PageSelectionSchema = z.array(z.string());
