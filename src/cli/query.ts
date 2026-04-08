#!/usr/bin/env node
import { Command } from "commander";
import { query } from "../workflows/query.js";

const program = new Command();
program
  .name("wiki-query")
  .description("Query the LLM Wiki")
  .argument("<question>", "Question to ask the wiki")
  .option("--save [path]", "Save answer to wiki")
  .action(async (question: string, opts: { save?: string | true }) => {
    const savePath = opts.save === true ? "" : opts.save;
    await query({ question, savePath });
  });

program.parse();
