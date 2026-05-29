import path from "node:path";
import { toJsonStable, writeTextFile } from "../util.js";
export function toProtocolJson(model) {
    return {
        source: "protocol/axtp.protocol.yaml",
        protocol: model.protocol,
        overview: model.overview,
        architecture: model.architecture,
        guide: model.guide,
        frameProfiles: model.frameProfiles,
        transports: model.transports,
        payloadTypes: model.payloadTypes,
        control: model.control,
        stream: model.stream,
        compatibility: model.compatibility,
        types: model.types,
        methods: model.methods,
        events: model.events,
        errors: model.errors,
        profiles: model.profiles
    };
}
export async function emitProtocolJson(model, outDir) {
    await writeTextFile(path.join(outDir, "protocol.json"), toJsonStable(toProtocolJson(model)));
}
//# sourceMappingURL=protocolJson.js.map