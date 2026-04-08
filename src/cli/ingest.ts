#!/usr/bin/env node
import { Command } from "commander";
import { ingest } from "../workflows/ingest.js";

const program = new Command();
program
  .name("wiki-ingest")
  .description("Ingest a source document into the LLM Wiki")
  .argument("<source>", "Path to source document")
  .action(async (source: string) => {
    await ingest(source);
  });

program.parse();
