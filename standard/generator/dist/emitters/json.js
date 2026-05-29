import path from "node:path";
import { hex, sortById, toJsonStable, writeTextFile } from "../util.js";
export async function emitJson(spec, outDir) {
    const jsonDir = path.join(outDir, "json");
    await Promise.all([
        writeTextFile(path.join(jsonDir, "method_registry.generated.json"), toJsonStable({ methods: sortById(spec.methods).map(withIdHex) })),
        writeTextFile(path.join(jsonDir, "event_registry.generated.json"), toJsonStable({ events: sortById(spec.events).map(withIdHex) })),
        writeTextFile(path.join(jsonDir, "error_code.generated.json"), toJsonStable({ errors: sortById(spec.errors).map(withIdHex) })),
        writeTextFile(path.join(jsonDir, "capability_registry.generated.json"), toJsonStable({ capabilities: sortById(spec.capabilities).map(withIdHex) })),
        writeTextFile(path.join(jsonDir, "schema.generated.json"), toJsonStable({ schemas: spec.schemas })),
        writeTextFile(path.join(jsonDir, "legacy_mapping.generated.json"), toJsonStable({ legacyMappings: spec.legacyMappings }))
    ]);
}
function withIdHex(item) {
    return { ...item, idHex: hex(item.id) };
}
//# sourceMappingURL=json.js.map