#!/usr/bin/env node
import { Command } from "commander";
import { existsSync } from "node:fs";
import path from "node:path";
import { formatGeneratorError } from "./errors.js";
import { emitAll, emitMarkdown, emitProtocolDocs, emitTestVectors } from "./emitters/index.js";
import { loadSpec } from "./loader.js";
import { loadProtocolDocs, validateProtocolDocsConsistency } from "./protocolDocsValidator.js";
import { loadProtocolDefinition } from "./protocolLoader.js";
import { validateProtocolDefinition } from "./protocolValidator.js";
import { validateSpec } from "./validator.js";

function resolveInputPath(input: string): string {
  const direct = path.resolve(input);
  if (existsSync(direct) || !process.env.INIT_CWD) return direct;
  return path.resolve(process.env.INIT_CWD, input);
}

function resolveOutputPath(input: string): string {
  if (path.isAbsolute(input) || !process.env.INIT_CWD) return path.resolve(input);
  return path.resolve(process.env.INIT_CWD, input);
}

async function loadAndValidate(specPath: string) {
  const spec = await loadSpec(resolveInputPath(specPath));
  const messages = validateSpec(spec);
  return { spec, messages };
}

async function loadAndValidateProtocol(specPath: string) {
  const specRoot = resolveInputPath(specPath);
  const model = await loadProtocolDefinition(specRoot);
  const docs = await loadProtocolDocs(specRoot);
  const messages = [
    ...validateProtocolDefinition(model),
    ...validateProtocolDocsConsistency(model, docs)
  ];
  return { model, messages };
}

function defaultOut(specPath: string): string {
  return path.join(resolveInputPath(specPath), "out", "generated");
}

function defaultProtocolOut(specPath: string): string {
  return path.join(resolveInputPath(specPath), "generated");
}

const program = new Command();

program
  .name("axtp-gen")
  .description("AXTP Registry and Schema generator")
  .version("1.0.0");

program.command("validate")
  .description("validate registry and schema inputs")
  .requiredOption("--spec <path>", "AXTP spec root")
  .action(async (options) => {
    try {
      const { messages } = await loadAndValidate(options.spec);
      for (const message of messages) console.log(message);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("generate")
  .description("generate C++, Markdown, JSON and test vectors")
  .requiredOption("--spec <path>", "AXTP spec root")
  .option("--out <path>", "output directory")
  .action(async (options) => {
    try {
      const { spec, messages } = await loadAndValidate(options.spec);
      const out = options.out ? resolveOutputPath(options.out) : defaultOut(options.spec);
      await emitAll(spec, out);
      for (const message of messages) console.log(message);
      console.log(`[OK] generated outputs: ${out}`);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("validate-protocol")
  .description("validate protocol definition input")
  .requiredOption("--spec <path>", "AXTP repository root")
  .action(async (options) => {
    try {
      const { messages } = await loadAndValidateProtocol(options.spec);
      for (const message of messages) console.log(message);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("generate-protocol")
  .description("generate protocol definition JSON and Markdown")
  .requiredOption("--spec <path>", "AXTP repository root")
  .option("--out <path>", "output directory")
  .action(async (options) => {
    try {
      const { model, messages } = await loadAndValidateProtocol(options.spec);
      const out = options.out ? resolveOutputPath(options.out) : defaultProtocolOut(options.spec);
      await emitProtocolDocs(model, out);
      for (const message of messages) console.log(message);
      console.log(`[OK] generated protocol outputs: ${out}`);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("doc")
  .description("generate Markdown registry tables")
  .requiredOption("--spec <path>", "AXTP spec root")
  .option("--out <path>", "output directory")
  .action(async (options) => {
    try {
      const { spec } = await loadAndValidate(options.spec);
      const out = options.out ? resolveOutputPath(options.out) : path.join(defaultOut(options.spec), "docs");
      await emitMarkdown(spec, path.dirname(out));
      console.log(`[OK] generated docs: ${out}`);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("test-vector")
  .description("generate test vectors")
  .requiredOption("--spec <path>", "AXTP spec root")
  .option("--out <path>", "output directory")
  .action(async (options) => {
    try {
      const { spec } = await loadAndValidate(options.spec);
      const out = options.out ? resolveOutputPath(options.out) : path.join(defaultOut(options.spec), "test_vectors");
      await emitTestVectors(spec, path.dirname(out));
      console.log(`[OK] generated test vectors: ${out}`);
    } catch (error) {
      console.error(formatGeneratorError(error));
      process.exitCode = 1;
    }
  });

program.command("diff")
  .description("compare two registry/schema versions (P1 placeholder)")
  .requiredOption("--old <path>", "old spec root")
  .requiredOption("--new <path>", "new spec root")
  .action(() => {
    console.error("ERROR AXTP-GEN-1007\nmessage: diff is reserved for P1 and is not implemented in Generator v1 P0");
    process.exitCode = 1;
  });

program.parseAsync(process.argv);
