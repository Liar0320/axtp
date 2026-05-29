import { GeneratorError } from "./errors.js";
import type { EventDefinition, MethodDefinition, ProtocolModel } from "./protocolModel.js";
import { hex } from "./util.js";

function fail(entry: string, field: string, message: string): never {
  throw new GeneratorError({
    code: "AXTP-GEN-1004",
    file: "protocol/axtp.protocol.yaml",
    entry,
    field,
    message
  });
}

function assertUnique<T>(items: T[], key: (item: T) => string | number, label: string, field: string): void {
  const seen = new Map<string | number, string>();
  for (const item of items as Array<T & { name: string }>) {
    const value = key(item);
    const existing = seen.get(value);
    if (existing) {
      fail(item.name, field, `duplicate ${label}: ${String(value)} (${existing} / ${item.name})`);
    }
    seen.set(value, item.name);
  }
}

function assertNoForbiddenKeys(value: unknown, path = "$"): void {
  if (!value || typeof value !== "object") return;
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

function assertDomainBits<T extends { name: string; domain: string; bitOffset: number }>(items: T[], label: string): void {
  const domains = new Map<string, T[]>();
  for (const item of items) {
    const entries = domains.get(item.domain) ?? [];
    entries.push(item);
    domains.set(item.domain, entries);
  }
  for (const [domain, entries] of domains) {
    const seen = new Map<number, string>();
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

function assertDomainName(name: string, domain: string, label: string): void {
  if (name.split(".")[0] !== domain) fail(name, "domain", `${label} domain must match name prefix`);
}

function assertMethodReferences(methods: MethodDefinition[], typeNames: Set<string>, eventNames: Set<string>, errorNames: Set<string>): void {
  for (const method of methods) {
    assertDomainName(method.name, method.domain, "method");
    if (!typeNames.has(method.request.type)) fail(method.name, "request.type", `missing type: ${method.request.type}`);
    if (!typeNames.has(method.response.type)) fail(method.name, "response.type", `missing type: ${method.response.type}`);
    for (const event of method.events) {
      if (!eventNames.has(event)) fail(method.name, "events", `missing event: ${event}`);
    }
    for (const error of method.errors) {
      if (!errorNames.has(error)) fail(method.name, "errors", `missing error: ${error}`);
    }
  }
}

function assertEventReferences(events: EventDefinition[], typeNames: Set<string>): void {
  for (const event of events) {
    assertDomainName(event.name, event.domain, "event");
    if (event.eventId < 0x8000) fail(event.name, "eventId", `eventId must be >= ${hex(0x8000)}`);
    if (!typeNames.has(event.payload.type)) fail(event.name, "payload.type", `missing type: ${event.payload.type}`);
  }
}

export function validateProtocolDefinition(model: ProtocolModel): string[] {
  assertNoForbiddenKeys(model.raw);

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
  if (!methodMasks || (methodMasks.derivedFrom !== "methods.bitOffset" && methodMasks.derivedFrom !== "methods[].bitOffset")) {
    fail("CapabilitySupportedMethodsResponse", "methodMasks", "capability.supportedMethods methodMasks must derive from methods[].bitOffset");
  }

  for (const transport of model.transports) {
    if (transport.frameProfile !== "none" && !frameProfileNames.has(transport.frameProfile)) {
      fail(transport.name, "frameProfile", `missing frame profile: ${transport.frameProfile}`);
    }
  }

  for (const profile of model.profiles) {
    for (const method of profile.requiredMethods) {
      if (!methodNames.has(method)) fail(profile.name, "requiredMethods", `missing method: ${method}`);
    }
    for (const event of profile.requiredEvents) {
      if (!eventNames.has(event)) fail(profile.name, "requiredEvents", `missing event: ${event}`);
    }
    for (const error of profile.requiredErrors) {
      if (!errorNames.has(error)) fail(profile.name, "requiredErrors", `missing error: ${error}`);
    }
    for (const type of profile.requiredTypes) {
      if (!typeNames.has(type)) fail(profile.name, "requiredTypes", `missing type: ${type}`);
    }
    for (const transport of profile.transportProfiles) {
      if (!transportNames.has(transport)) fail(profile.name, "transportProfiles", `missing transport: ${transport}`);
    }
    for (const frameProfile of profile.frameProfiles) {
      if (!frameProfileNames.has(frameProfile)) fail(profile.name, "frameProfiles", `missing frame profile: ${frameProfile}`);
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
