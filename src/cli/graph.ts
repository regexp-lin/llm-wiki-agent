#!/usr/bin/env node
import { Command } from "commander";
import { buildGraph } from "../workflows/graph.js";

const program = new Command();
program
  .name("wiki-graph")
  .description("Build LLM Wiki knowledge graph")
  .option("--no-infer", "Skip semantic inference (faster)")
  .option("--open", "Open graph.html in browser")
  .action(async (opts: { infer: boolean; open?: boolean }) => {
    await buildGraph(opts.infer, opts.open);
  });

program.parse();
