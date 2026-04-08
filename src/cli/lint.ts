#!/usr/bin/env node
import { Command } from "commander";
import { runLint } from "../workflows/lint.js";
import { WikiError } from "../shared/errors.js";

const program = new Command();
program
  .name("wiki-lint")
  .description("Lint the LLM Wiki for health issues")
  .option("--save", "Save lint report to wiki/lint-report.md")
  .action(async (opts: { save?: boolean }) => {
    try {
      await runLint(opts.save);
    } catch (error) {
      if (error instanceof WikiError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

program.parse();
