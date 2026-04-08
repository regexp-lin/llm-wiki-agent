#!/usr/bin/env node
import { Command } from "commander";
import { buildGraph } from "../workflows/graph.js";
import { WikiError } from "../shared/errors.js";

const program = new Command();
program
  .name("wiki-graph")
  .description("Build LLM Wiki knowledge graph")
  .option("--no-infer", "Skip semantic inference (faster)")
  .option("--open", "Open graph.html in browser")
  .action(async (opts: { infer: boolean; open?: boolean }) => {
    try {
      await buildGraph(opts.infer, opts.open);
    } catch (error) {
      if (error instanceof WikiError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

program.parse();
