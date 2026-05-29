import { GeneratorError } from "./errors.js";
import { hex } from "./util.js";
function fail(entry, field, message) {
    throw new GeneratorError({
        code: "AXTP-GEN-1004",
        file: "protocol/axtp.protocol.yaml",
        entry,
        field,
        message
    });
}
function assertUnique(items, key, label, field) {
    const seen = new Map();
    for (const item of items) {
        const value = key(item);
        const existing = seen.get(value);
        if (existing) {
            fail(item.name, field, `duplicate ${label}: ${String(value)} (${existing} / ${item.name})`);
        }
        seen.set(value, item.name);
    }
}
function assertNoForbiddenKeys(value, path = "$") {
    if (!value || typeof value !== "object")
        return;
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === "bitmapId" || key === "requests" || key === "requiredRequests") {
            fail(path, key, `forbidden legacy Protocol Definition field: ${key}`);
        }
        assertNoForbiddenKeys(child, `${path}.${key}`);
    }
}
function assertNoUnsupportedProfileKeys(value) {
    const profiles = value?.profiles;
    if (!Array.isArray(profiles))
        return;
    profiles.forEach((profile, index) => {
        if (profile && typeof profile === "object" && "requiredCapabilities" in profile) {
            fail(`profiles[${index}]`, "requiredCapabilities", "profiles[].requiredCapabilities is not defined by 13-AXTP-Profiles-Registry-Spec.md");
        }
    });
}
function assertDomainBits(items, label) {
    const domains = new Map();
    for (const item of items) {
        const entries = domains.get(item.domain) ?? [];
        entries.push(item);
        domains.set(item.domain, entries);
    }
    for (const [domain, entries] of domains) {
        const seen = new Map();
        for (const item of entries) {
            if (seen.has(item.bitOffset)) {
                fail(item.name, "bitOffset", `duplicate ${label} bitOffset in domain ${domain}: ${item.bitOffset}`);
            }
            seen.set(item.bitOffset, item.name);
        }
        const bits = [...seen.keys()].sort((a, b) => a - b);
        bits.forEach((bit, index) => {
            if (bit !== index) {
                fail(domain, "bitOffset", `${label} bitOffset must be contiguous from 0 in domain ${domain}: ${bits.join(",")}`);
            }
        });
    }
}
function assertDomainName(name, domain, label) {
    if (name.split(".")[0] !== domain)
        fail(name, "domain", `${label} domain must match name prefix`);
}
function assertMethodReferences(methods, typeNames, eventNames, errorNames) {
    for (const method of methods) {
        assertDomainName(method.name, method.domain, "method");
        if (!method.description || method.description.trim() === "")
            fail(method.name, "description", "method description is required by 09-AXTP-Methods-Registry-Spec.md");
        if (!typeNames.has(method.request.type))
            fail(method.name, "request.type", `missing type: ${method.request.type}`);
        if (!typeNames.has(method.response.type))
            fail(method.name, "response.type", `missing type: ${method.response.type}`);
        for (const event of method.events) {
            if (!eventNames.has(event))
                fail(method.name, "events", `missing event: ${event}`);
        }
        for (const error of method.errors) {
            if (!errorNames.has(error))
                fail(method.name, "errors", `missing error: ${error}`);
        }
    }
}
function assertEventReferences(events, typeNames) {
    for (const event of events) {
        assertDomainName(event.name, event.domain, "event");
        if (event.eventId < 0x8000)
            fail(event.name, "eventId", `eventId must be >= ${hex(0x8000)}`);
        if (!typeNames.has(event.payload.type))
            fail(event.name, "payload.type", `missing type: ${event.payload.type}`);
    }
}
function assertDomainIdAlignment(methods, events) {
    const methodDomainIds = new Map();
    for (const method of methods) {
        const domainId = method.methodId >> 8;
        const existing = methodDomainIds.get(method.domain);
        if (existing !== undefined && existing !== domainId) {
            fail(method.name, "methodId", `methodId high byte must be stable within domain ${method.domain}`);
        }
        methodDomainIds.set(method.domain, domainId);
    }
    for (const event of events) {
        const methodDomainId = methodDomainIds.get(event.domain);
        if (methodDomainId === undefined)
            continue;
        const expected = 0x80 | methodDomainId;
        const actual = event.eventId >> 8;
        if (actual !== expected) {
            fail(event.name, "eventId", `eventId high byte must align with domain ${event.domain}: expected ${hex(expected, 2)}`);
        }
    }
}
function assertTypeDefinitions(types) {
    const allowedKinds = new Set(["object", "enum", "bitmap", "alias", "bytes"]);
    const builtins = new Set(["bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "string", "bytes", "enum"]);
    const typeNames = new Set(types.map((type) => type.name));
    for (const type of types) {
        if (!allowedKinds.has(type.kind))
            fail(type.name, "kind", `unsupported type kind: ${type.kind}`);
        if (type.kind !== "object")
            continue;
        const fieldIds = new Map();
        for (const field of type.fields) {
            if (field.fieldId < 1 || field.fieldId > 0xff)
                fail(type.name, "fieldId", `fieldId must be a 1-byte value: ${field.name}`);
            const existing = fieldIds.get(field.fieldId);
            if (existing)
                fail(type.name, "fieldId", `duplicate fieldId ${hex(field.fieldId, 2)} (${existing} / ${field.name})`);
            fieldIds.set(field.fieldId, field.name);
            if (!builtins.has(field.type) && !typeNames.has(field.type)) {
                fail(type.name, "type", `field ${field.name} references missing type: ${field.type}`);
            }
        }
    }
}
function assertEmptyTypeUsage(model) {
    const types = new Map(model.types.map((type) => [type.name, type]));
    const empty = types.get("Empty");
    if (!empty || empty.kind !== "object" || empty.fields.length !== 0) {
        fail("types.Empty", "type", "09-AXTP-Methods-Registry-Spec.md requires empty request/response to use Empty");
    }
    for (const method of model.methods) {
        const requestType = types.get(method.request.type);
        const responseType = types.get(method.response.type);
        if (requestType && requestType.fields.length === 0 && method.request.type !== "Empty") {
            fail(method.name, "request.type", "empty request must use Empty");
        }
        if (responseType && responseType.fields.length === 0 && method.response.type !== "Empty") {
            fail(method.name, "response.type", "empty response must use Empty");
        }
    }
}
function expectedErrorCategory(code) {
    if (code <= 0x00ff)
        return "common";
    if (code <= 0x01ff)
        return "frame";
    if (code <= 0x02ff)
        return "control";
    if (code <= 0x03ff)
        return "rpc";
    if (code <= 0x04ff)
        return "stream";
    if (code <= 0x6fff)
        return "business";
    if (code <= 0x7eff)
        return "vendor";
    if (code <= 0x7fff)
        return "legacy";
    return "invalid";
}
function assertErrorRanges(errors) {
    for (const error of errors) {
        const expected = expectedErrorCategory(error.code);
        if (expected === "invalid")
            fail(error.name, "code", `error code must be <= ${hex(0x7fff)}`);
        if (error.category !== expected) {
            fail(error.name, "category", `error category must be ${expected} for code ${hex(error.code)}`);
        }
    }
}
function assertStreamHeader(model) {
    const expected = [
        ["streamId", "uint32"],
        ["seqId", "uint32"],
        ["cursor", "uint64"]
    ];
    const fields = model.stream.header.fields;
    if (model.stream.header.size !== 16) {
        fail("stream.header", "size", "STREAM header size must be 16 bytes");
    }
    for (const forbidden of ["seq", "position", "chunkLength", "flags"]) {
        if (fields.some((field) => field.name === forbidden)) {
            fail("stream.header", "fields", `STREAM header must not contain legacy field: ${forbidden}`);
        }
    }
    if (fields.length !== expected.length) {
        fail("stream.header", "fields", "STREAM header must contain streamId:uint32, seqId:uint32 and cursor:uint64");
    }
    expected.forEach(([name, type], index) => {
        const field = fields[index];
        if (!field || field.name !== name || field.type !== type) {
            fail("stream.header", "fields", "STREAM header must be streamId:uint32, seqId:uint32, cursor:uint64");
        }
    });
}
function assertControlOpcodes(model) {
    for (const opcode of ["OPEN", "ACCEPT"]) {
        if (!model.control.requiredOpcodes.includes(opcode))
            fail("control.requiredOpcodes", opcode, `${opcode} is required by 04-AXTP-Control-Session-Spec.md`);
    }
    if (model.control.requiredOpcodes.includes("READY"))
        fail("control.requiredOpcodes", "READY", "READY is optional and must not be required");
    if (!model.control.optionalOpcodes.includes("READY"))
        fail("control.optionalOpcodes", "READY", "READY must be optional/reserved");
    for (const opcode of ["ACK", "NACK", "RESUME", "HEARTBEAT", "HEARTBEAT_ACK", "CLOSE", "CLOSE_ACK"]) {
        if (model.control.reservedOpcodes.includes(opcode))
            fail("control.reservedOpcodes", opcode, `${opcode} is defined by 04-AXTP-Control-Session-Spec.md and must not be listed as reserved`);
    }
}
export function validateProtocolDefinition(model) {
    assertNoForbiddenKeys(model.raw);
    assertNoUnsupportedProfileKeys(model.raw);
    assertStreamHeader(model);
    assertControlOpcodes(model);
    assertUnique(model.methods, (item) => item.name, "method name", "name");
    assertUnique(model.methods, (item) => item.methodId, "methodId", "methodId");
    assertUnique(model.events, (item) => item.name, "event name", "name");
    assertUnique(model.events, (item) => item.eventId, "eventId", "eventId");
    assertUnique(model.errors, (item) => item.name, "error name", "name");
    assertUnique(model.errors, (item) => item.code, "error code", "code");
    assertUnique(model.types, (item) => item.name, "type name", "name");
    assertUnique(model.transports, (item) => item.name, "transport name", "name");
    assertUnique(model.profiles, (item) => item.name, "profile name", "name");
    assertDomainBits(model.methods, "method");
    assertDomainBits(model.events, "event");
    assertDomainIdAlignment(model.methods, model.events);
    assertTypeDefinitions(model.types);
    assertEmptyTypeUsage(model);
    assertErrorRanges(model.errors);
    const typeNames = new Set(model.types.map((item) => item.name));
    const methodNames = new Set(model.methods.map((item) => item.name));
    const eventNames = new Set(model.events.map((item) => item.name));
    const errorNames = new Set(model.errors.map((item) => item.name));
    const transportNames = new Set(model.transports.map((item) => item.name));
    const frameProfileNames = new Set(model.frameProfiles.map((item) => item.name));
    assertMethodReferences(model.methods, typeNames, eventNames, errorNames);
    assertEventReferences(model.events, typeNames);
    const supportedMethodsResponse = model.types.find((item) => item.name === "CapabilitySupportedMethodsResponse");
    const methodMasks = supportedMethodsResponse?.fields.find((field) => field.name === "methodMasks");
    if (!methodMasks || methodMasks.derivedFrom !== "methods[].bitOffset") {
        fail("CapabilitySupportedMethodsResponse", "methodMasks", "capability.supportedMethods methodMasks must derive from methods[].bitOffset");
    }
    for (const transport of model.transports) {
        if (transport.frameProfile !== "none" && !frameProfileNames.has(transport.frameProfile)) {
            fail(transport.name, "frameProfile", `missing frame profile: ${transport.frameProfile}`);
        }
    }
    for (const profile of model.profiles) {
        for (const method of profile.requiredMethods) {
            if (!methodNames.has(method))
                fail(profile.name, "requiredMethods", `missing method: ${method}`);
        }
        for (const event of profile.requiredEvents) {
            if (!eventNames.has(event))
                fail(profile.name, "requiredEvents", `missing event: ${event}`);
        }
        for (const error of profile.requiredErrors) {
            if (!errorNames.has(error))
                fail(profile.name, "requiredErrors", `missing error: ${error}`);
        }
        for (const type of profile.requiredTypes) {
            if (!typeNames.has(type))
                fail(profile.name, "requiredTypes", `missing type: ${type}`);
        }
        for (const transport of profile.transportProfiles) {
            if (!transportNames.has(transport))
                fail(profile.name, "transportProfiles", `missing transport: ${transport}`);
        }
        const usedFrameProfiles = new Set(profile.transportProfiles
            .map((transportName) => model.transports.find((transport) => transport.name === transportName)?.frameProfile)
            .filter((frameProfile) => Boolean(frameProfile) && frameProfile !== "none"));
        if (profile.frameProfile) {
            for (const frameProfile of usedFrameProfiles) {
                if (frameProfile !== profile.frameProfile) {
                    fail(profile.name, "frameProfile", `frameProfile ${profile.frameProfile} does not match transport frame profile ${frameProfile}`);
                }
            }
        }
        for (const frameProfile of profile.frameProfiles) {
            if (!frameProfileNames.has(frameProfile))
                fail(profile.name, "frameProfiles", `missing frame profile: ${frameProfile}`);
        }
        if (profile.frameProfiles.length > 0) {
            const declared = new Set(profile.frameProfiles);
            for (const frameProfile of usedFrameProfiles) {
                if (!declared.has(frameProfile))
                    fail(profile.name, "frameProfiles", `missing transport frame profile: ${frameProfile}`);
            }
            for (const frameProfile of declared) {
                if (!usedFrameProfiles.has(frameProfile))
                    fail(profile.name, "frameProfiles", `frame profile is not used by transportProfiles: ${frameProfile}`);
            }
        }
        if (profile.frameProfile && !frameProfileNames.has(profile.frameProfile)) {
            fail(profile.name, "frameProfile", `missing frame profile: ${profile.frameProfile}`);
        }
    }
    return [
        `[OK] protocol/axtp.protocol.yaml: ${model.methods.length} methods checked`,
        `[OK] protocol/axtp.protocol.yaml: ${model.events.length} events checked`,
        `[OK] protocol/axtp.protocol.yaml: ${model.errors.length} errors checked`,
        `[OK] protocol/axtp.protocol.yaml: ${model.types.length} types checked`,
        `[OK] protocol/axtp.protocol.yaml: ${model.profiles.length} profiles checked`
    ];
}
//# sourceMappingURL=protocolValidator.js.map