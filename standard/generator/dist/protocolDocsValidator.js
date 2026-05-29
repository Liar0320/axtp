import { readFile } from "node:fs/promises";
import path from "node:path";
import { GeneratorError } from "./errors.js";
function fail(file, entry, message) {
    throw new GeneratorError({
        code: "AXTP-GEN-1004",
        file,
        entry,
        message
    });
}
function requirePattern(text, pattern, file, entry, message) {
    if (!pattern.test(text))
        fail(file, entry, message);
}
function assertYamlStreamHeader(model) {
    const expected = [
        ["streamId", "uint32"],
        ["seqId", "uint32"],
        ["cursor", "uint64"]
    ];
    const fields = model.stream.header.fields;
    if (model.stream.header.size !== 16 || fields.length !== expected.length) {
        fail("protocol/axtp.protocol.yaml", "stream.header", "YAML stream.header must match the 16B STREAM header defined in 06-AXTP-Stream-Spec.md");
    }
    for (const forbidden of ["seq", "position", "chunkLength", "flags"]) {
        if (fields.some((field) => field.name === forbidden)) {
            fail("protocol/axtp.protocol.yaml", "stream.header", `YAML stream.header must not contain legacy field: ${forbidden}`);
        }
    }
    expected.forEach(([name, type], index) => {
        const field = fields[index];
        if (!field || field.name !== name || field.type !== type) {
            fail("protocol/axtp.protocol.yaml", "stream.header", "YAML stream.header must be streamId:uint32, seqId:uint32, cursor:uint64");
        }
    });
}
function assertYamlControl(model) {
    if (!model.control.requiredOpcodes.includes("OPEN") || !model.control.requiredOpcodes.includes("ACCEPT")) {
        fail("protocol/axtp.protocol.yaml", "control.requiredOpcodes", "YAML control.requiredOpcodes must include OPEN and ACCEPT");
    }
    if (model.control.requiredOpcodes.includes("READY")) {
        fail("protocol/axtp.protocol.yaml", "control.requiredOpcodes", "READY must not be a required opcode in AXTP v1 Core");
    }
    if (!model.control.optionalOpcodes.includes("READY")) {
        fail("protocol/axtp.protocol.yaml", "control.optionalOpcodes", "YAML control.optionalOpcodes must include READY");
    }
}
function assertYamlCapability(model) {
    const supportedMethodsResponse = model.types.find((type) => type.name === "CapabilitySupportedMethodsResponse");
    const methodMasks = supportedMethodsResponse?.fields.find((field) => field.name === "methodMasks");
    if (!methodMasks || methodMasks.derivedFrom !== "methods[].bitOffset") {
        fail("protocol/axtp.protocol.yaml", "CapabilitySupportedMethodsResponse.methodMasks", "methodMasks must derive from methods[].bitOffset");
    }
}
export async function loadProtocolDocs(specRoot) {
    const docsRoot = path.join(specRoot, "standard", "docs", "00-spec");
    const [streamSpec, controlSpec, typesSpec] = await Promise.all([
        readFile(path.join(docsRoot, "06-AXTP-Stream-Spec.md"), "utf8"),
        readFile(path.join(docsRoot, "04-AXTP-Control-Session-Spec.md"), "utf8"),
        readFile(path.join(docsRoot, "12-AXTP-Types-and-Capability-Spec.md"), "utf8")
    ]);
    return { streamSpec, controlSpec, typesSpec };
}
export function validateProtocolDocsConsistency(model, docs) {
    requirePattern(docs.streamSpec, /STREAM Header[^\n]*16B|16B STREAM Header/, "standard/docs/00-spec/06-AXTP-Stream-Spec.md", "STREAM Header", "stream spec must define a 16B STREAM Header");
    requirePattern(docs.streamSpec, /streamId:uint32/, "standard/docs/00-spec/06-AXTP-Stream-Spec.md", "STREAM Header", "stream spec must define streamId:uint32");
    requirePattern(docs.streamSpec, /seqId:uint32/, "standard/docs/00-spec/06-AXTP-Stream-Spec.md", "STREAM Header", "stream spec must define seqId:uint32");
    requirePattern(docs.streamSpec, /cursor:uint64/, "standard/docs/00-spec/06-AXTP-Stream-Spec.md", "STREAM Header", "stream spec must define cursor:uint64");
    requirePattern(docs.controlSpec, /OPEN[\s\S]*ACCEPT/, "standard/docs/00-spec/04-AXTP-Control-Session-Spec.md", "OPEN/ACCEPT", "control spec must define OPEN and ACCEPT");
    requirePattern(docs.controlSpec, /READY[\s\S]{0,80}可选/, "standard/docs/00-spec/04-AXTP-Control-Session-Spec.md", "READY", "control spec must define READY as optional");
    requirePattern(docs.controlSpec, /默认握手只要求 OPEN \/ ACCEPT/, "standard/docs/00-spec/04-AXTP-Control-Session-Spec.md", "READY", "control spec must state that default handshake only requires OPEN / ACCEPT");
    requirePattern(docs.typesSpec, /methods\[\]\.bitOffset/, "standard/docs/00-spec/12-AXTP-Types-and-Capability-Spec.md", "capability.supportedMethods", "types spec must derive method bitmap from methods[].bitOffset");
    assertYamlStreamHeader(model);
    assertYamlControl(model);
    assertYamlCapability(model);
    return [
        "[OK] standard/docs/00-spec: STREAM header facts checked",
        "[OK] standard/docs/00-spec: CONTROL OPEN/ACCEPT/READY facts checked",
        "[OK] standard/docs/00-spec: capability bitmap facts checked"
    ];
}
//# sourceMappingURL=protocolDocsValidator.js.map