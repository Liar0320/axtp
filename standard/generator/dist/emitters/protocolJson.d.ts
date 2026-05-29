import type { ProtocolModel } from "../protocolModel.js";
export declare function toProtocolJson(model: ProtocolModel): Record<string, unknown>;
export declare function emitProtocolJson(model: ProtocolModel, outDir: string): Promise<void>;
