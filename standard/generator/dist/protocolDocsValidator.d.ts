import type { ProtocolModel } from "./protocolModel.js";
export interface ProtocolDocsText {
    streamSpec: string;
    controlSpec: string;
    typesSpec: string;
}
export declare function loadProtocolDocs(specRoot: string): Promise<ProtocolDocsText>;
export declare function validateProtocolDocsConsistency(model: ProtocolModel, docs: ProtocolDocsText): string[];
