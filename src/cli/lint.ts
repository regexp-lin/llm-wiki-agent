#!/usr/bin/env node
import { Command } from "commander";
import { runLint } from "../workflows/lint.js";

const program = new Command();
program
  .name("wiki-lint")
  .description("Lint the LLM Wiki for health issues")
  .option("--save", "Save lint report to wiki/lint-report.md")
  .action(async (opts: { save?: boolean }) => {
    await runLint(opts.save);
  });

program.parse();
