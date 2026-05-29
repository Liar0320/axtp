import type { SpecModel } from "../models.js";
import type { ProtocolModel } from "../protocolModel.js";
export declare function emitAll(spec: SpecModel, outDir: string): Promise<void>;
export declare function emitProtocolDocs(model: ProtocolModel, outDir: string): Promise<void>;
export { emitMarkdown } from "./markdown.js";
export { emitProtocolJson } from "./protocolJson.js";
export { emitProtocolMarkdown } from "./protocolMarkdown.js";
export { emitTestVectors } from "./testVectors.js";
