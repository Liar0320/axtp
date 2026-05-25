import type { SpecModel } from "../models.js";
import { emitCpp } from "./cpp.js";
import { emitJson } from "./json.js";
import { emitMarkdown } from "./markdown.js";
import { emitTestVectors } from "./testVectors.js";

export async function emitAll(spec: SpecModel, outDir: string): Promise<void> {
  await Promise.all([
    emitCpp(spec, outDir),
    emitMarkdown(spec, outDir),
    emitJson(spec, outDir),
    emitTestVectors(spec, outDir)
  ]);
}

export { emitMarkdown } from "./markdown.js";
export { emitTestVectors } from "./testVectors.js";
