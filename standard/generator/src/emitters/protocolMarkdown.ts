import path from "node:path";
import type {
  ErrorDefinition,
  EventDefinition,
  MethodDefinition,
  ProfileDefinition,
  ProtocolModel,
  TypeDefinition,
  TypeField
} from "../protocolModel.js";
import { hex, writeTextFile } from "../util.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, "<br>");
}

function list(values: string[] | undefined): string {
  return values && values.length > 0 ? values.map(esc).join("<br>") : "-";
}

function sentenceList(values: string[] | undefined): string[] {
  return values && values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

function table(headers: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ["_No entries._"];
  return [
    `| ${headers.map(esc).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(esc).join(" | ")} |`)
  ];
}

function optional(value: unknown): string {
  return value === undefined || value === "" ? "-" : String(value);
}

function formatMaybeHex(value: unknown, width = 2): string {
  return typeof value === "number" ? hex(value, width) : optional(value);
}

function sortedMethods(methods: MethodDefinition[]): MethodDefinition[] {
  return [...methods].sort((a, b) => a.methodId - b.methodId || a.name.localeCompare(b.name));
}

function sortedEvents(events: EventDefinition[]): EventDefinition[] {
  return [...events].sort((a, b) => a.eventId - b.eventId || a.name.localeCompare(b.name));
}

function sortedErrors(errors: ErrorDefinition[]): ErrorDefinition[] {
  return [...errors].sort((a, b) => a.code - b.code || a.name.localeCompare(b.name));
}

function sortedTypes(types: TypeDefinition[]): TypeDefinition[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name));
}

function sortedProfiles(profiles: ProfileDefinition[]): ProfileDefinition[] {
  return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
}

function renderFieldConstraint(field: TypeField): string {
  const constraints = [
    field.min === undefined ? undefined : `min=${field.min}`,
    field.max === undefined ? undefined : `max=${field.max}`,
    field.maxLength === undefined ? undefined : `maxLength=${field.maxLength}`,
    field.derivedFrom === undefined ? undefined : `derivedFrom=${field.derivedFrom}`,
    field.deprecated ? "deprecated" : undefined
  ].filter(Boolean);
  return constraints.length > 0 ? constraints.join(", ") : "-";
}

function renderType(type: TypeDefinition): string[] {
  return [
    `### ${type.name}`,
    "",
    `Kind: \`${type.kind}\``,
    "",
    ...table(
      ["Field ID", "Name", "Type", "Required", "Constraints", "Description"],
      type.fields.map((field) => [
        hex(field.fieldId, 2),
        field.name,
        field.type,
        field.required ? "yes" : "no",
        renderFieldConstraint(field),
        optional(field.description)
      ])
    )
  ];
}

function renderMethod(method: MethodDefinition): string[] {
  return [
    `### ${method.name}`,
    "",
    ...table(
      ["Property", "Value"],
      [
        ["Method ID", hex(method.methodId)],
        ["Domain", method.domain],
        ["Bit Offset", String(method.bitOffset)],
        ["Since", method.since],
        ["Status", method.status],
        ["Request Type", method.request.type],
        ["Response Type", method.response.type],
        ["Encodings", list(method.encodings)],
        ["Capabilities", list(method.capabilities)],
        ["Events", list(method.events)],
        ["Errors", list(method.errors)]
      ]
    )
  ];
}

function renderEvent(event: EventDefinition): string[] {
  return [
    `### ${event.name}`,
    "",
    ...table(
      ["Property", "Value"],
      [
        ["Event ID", hex(event.eventId)],
        ["Domain", event.domain],
        ["Bit Offset", String(event.bitOffset)],
        ["Since", event.since],
        ["Status", event.status],
        ["Payload Type", event.payload.type],
        ["Severity", optional(event.severity)],
        ["Trigger", list(event.trigger)],
        ["Capabilities", list(event.capabilities)]
      ]
    )
  ];
}

function renderProfile(profile: ProfileDefinition): string[] {
  return [
    `### ${profile.name}`,
    "",
    ...table(
      ["Property", "Value"],
      [
        ["Since", profile.since],
        ["Status", profile.status],
        ["Extends", optional(profile.extends)],
        ["Required Methods", list(profile.requiredMethods)],
        ["Required Events", list(profile.requiredEvents)],
        ["Required Types", list(profile.requiredTypes)],
        ["Required Errors", list(profile.requiredErrors)],
        ["Required Capabilities", list(profile.requiredCapabilities)],
        ["Transport Profiles", list(profile.transportProfiles)],
        ["Frame Profiles", list(profile.frameProfiles.length > 0 ? profile.frameProfiles : profile.frameProfile ? [profile.frameProfile] : [])],
        ["Notes", optional(profile.notes)]
      ]
    )
  ];
}

export function renderProtocolMarkdown(model: ProtocolModel): string {
  const lines: string[] = [
    `# ${model.overview.title}`,
    "",
    "> Generated from protocol/axtp.protocol.yaml. Do not edit by hand.",
    "",
    "## Overview",
    "",
    model.overview.summary,
    "",
    ...table(
      ["Property", "Value"],
      [
        ["Protocol", model.protocol.name],
        ["Version", model.protocol.version],
        ["Spec Version", String(model.protocol.specVersion)],
        ["Registry Version", model.protocol.registryVersion],
        ["Status", optional(model.protocol.status)]
      ]
    ),
    "",
    "## Design Goals / Non-Goals",
    "",
    "### Goals",
    "",
    ...sentenceList(model.overview.goals),
    "",
    "### Non-Goals",
    "",
    ...sentenceList(model.overview.nonGoals),
    "",
    "## Architecture",
    "",
    ...table(
      ["Layer", "Description"],
      model.architecture.layers.map((layer) => [layer.name, layer.description])
    ),
    "",
    "## Connection Lifecycle",
    "",
    ...table(
      ["Step", "From", "To", "Status", "Description"],
      model.architecture.lifecycle.map((step) => [
        step.step,
        optional(step.from),
        optional(step.to),
        optional(step.status),
        step.description
      ])
    ),
    "",
    "### Optional Lifecycle Extensions",
    "",
    ...table(
      ["Step", "From", "To", "Status", "Description"],
      model.architecture.optionalLifecycleExtensions.map((step) => [
        step.step,
        optional(step.from),
        optional(step.to),
        optional(step.status),
        step.description
      ])
    ),
    "",
    "## Frame Profiles",
    "",
    ...table(
      ["Name", "Magic", "L1", "L2", "Supports Mixing"],
      model.frameProfiles.map((profile) => [
        profile.name,
        formatMaybeHex(profile.magic),
        profile.l1,
        profile.l2,
        profile.supportsMixing ? "yes" : "no"
      ])
    ),
    "",
    "## Transport Profiles",
    "",
    ...table(
      ["Name", "Family", "Frame Profile", "Production", "Max Frame Size", "Usage"],
      model.transports.map((transport) => [
        transport.name,
        transport.family,
        transport.frameProfile,
        transport.production ? "yes" : "no",
        optional(transport.maxFrameSize),
        optional(transport.usage)
      ])
    ),
    "",
    "## Payload Types",
    "",
    ...table(
      ["Name", "ID", "Header Bytes", "Description"],
      model.payloadTypes.map((payload) => [
        payload.name,
        hex(payload.id, 2),
        String(payload.headerBytes),
        payload.description
      ])
    ),
    "",
    "## Control Rules",
    "",
    ...table(
      ["Required Opcodes", "Optional Opcodes", "Reserved Opcodes"],
      [[list(model.control.requiredOpcodes), list(model.control.optionalOpcodes), list(model.control.reservedOpcodes)]]
    ),
    "",
    ...sentenceList(model.control.rules),
    "",
    "## Capability Discovery",
    "",
    "Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.",
    "",
    ...table(
      ["Domain", "Methods"],
      [...new Set(model.methods.map((method) => method.domain))]
        .sort()
        .map((domain) => [
          domain,
          list(sortedMethods(model.methods).filter((method) => method.domain === domain).map((method) => `${method.bitOffset}: ${method.name}`))
        ])
    ),
    "",
    "## Stream Transfer Model",
    "",
    ...table(
      ["Header", "Size", "Fields"],
      [[
        model.stream.header.name,
        String(model.stream.header.size),
        list(model.stream.header.fields.map((field) => `${field.name}: ${field.type}`))
      ]]
    ),
    "",
    ...sentenceList(model.stream.rules),
    "",
    "## Methods Reference",
    "",
    ...sortedMethods(model.methods).flatMap((method) => [...renderMethod(method), ""]),
    "## Events Reference",
    "",
    ...sortedEvents(model.events).flatMap((event) => [...renderEvent(event), ""]),
    "## Types Reference",
    "",
    ...sortedTypes(model.types).flatMap((type) => [...renderType(type), ""]),
    "## Errors Reference",
    "",
    ...table(
      ["Code", "Name", "Category", "Severity", "Retryable", "Status", "Message"],
      sortedErrors(model.errors).map((error) => [
        hex(error.code),
        error.name,
        error.category,
        error.severity,
        error.retryable ? "yes" : "no",
        error.status,
        error.message
      ])
    ),
    "",
    "## Profiles Reference",
    "",
    ...sortedProfiles(model.profiles).flatMap((profile) => [...renderProfile(profile), ""])
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export async function emitProtocolMarkdown(model: ProtocolModel, outDir: string): Promise<void> {
  await writeTextFile(path.join(outDir, "protocol.md"), renderProtocolMarkdown(model));
}
