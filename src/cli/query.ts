#!/usr/bin/env node
import { Command } from "commander";
import { query, slugify } from "../workflows/query.js";
import { WikiError } from "../shared/errors.js";

const program = new Command();
program
  .name("wiki-query")
  .description("Query the LLM Wiki")
  .argument("<question>", "Question to ask the wiki")
  .option("--save [path]", "Save answer to wiki")
  .action(async (question: string, opts: { save?: string | true }) => {
    try {
      const savePath =
        opts.save === true
          ? `syntheses/${slugify(question.slice(0, 60))}.md`
          : opts.save;
      await query({ question, savePath });
    } catch (error) {
      if (error instanceof WikiError) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }
  });

program.parse();
