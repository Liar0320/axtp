import type { SpecModel } from "../models.js";
import type { ProtocolModel } from "../protocolModel.js";
import { emitCpp } from "./cpp.js";
import { emitJson } from "./json.js";
import { emitMarkdown } from "./markdown.js";
import { emitProtocolJson } from "./protocolJson.js";
import { emitProtocolMarkdown } from "./protocolMarkdown.js";
import { emitTestVectors } from "./testVectors.js";

export async function emitAll(spec: SpecModel, outDir: string): Promise<void> {
  await Promise.all([
    emitCpp(spec, outDir),
    emitMarkdown(spec, outDir),
    emitJson(spec, outDir),
    emitTestVectors(spec, outDir)
  ]);
}

export async function emitProtocolDocs(model: ProtocolModel, outDir: string): Promise<void> {
  await Promise.all([
    emitProtocolJson(model, outDir),
    emitProtocolMarkdown(model, outDir)
  ]);
}

export { emitMarkdown } from "./markdown.js";
export { emitProtocolJson } from "./protocolJson.js";
export { emitProtocolMarkdown } from "./protocolMarkdown.js";
export { emitTestVectors } from "./testVectors.js";
