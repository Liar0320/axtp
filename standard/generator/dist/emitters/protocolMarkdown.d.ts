import type { ProtocolModel } from "../protocolModel.js";
export declare function renderProtocolMarkdown(model: ProtocolModel): string;
export declare function emitProtocolMarkdown(model: ProtocolModel, outDir: string): Promise<void>;
