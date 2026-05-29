import path from "node:path";
import type {
  ErrorDefinition,
  EventDefinition,
  MethodDefinition,
  ProfileDefinition,
  ProtocolModel,
  SchemaDefinition,
  SchemaField,
  WireExample
} from "../protocolModel.js";
import { hex, writeTextFile } from "../util.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, "<br>");
}

function optional(value: unknown): string {
  return value === undefined || value === "" ? "-" : String(value);
}

function list(values: string[] | undefined): string {
  return values && values.length > 0 ? values.map(esc).join("<br>") : "-";
}

function inlineList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "`None`";
}

function sentenceList(values: string[] | undefined): string[] {
  return values && values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

type TableAlign = "left" | "center" | "right";

function alignMarker(align: TableAlign): string {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return "----";
}

function table(headers: string[], rows: string[][], aligns?: TableAlign[]): string[] {
  if (rows.length === 0) return ["_No fields._"];
  const alignment = aligns ?? headers.map(() => "left" as const);
  return [
    `| ${headers.map(esc).join(" | ")} |`,
    `| ${alignment.map(alignMarker).join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(esc).join(" | ")} |`)
  ];
}

function anchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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

function sortedProfiles(profiles: ProfileDefinition[]): ProfileDefinition[] {
  return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
}

function domainsFor(items: Array<{ domain: string }>): string[] {
  return [...new Set(items.map((item) => item.domain))].sort();
}

function methodsInDomain(model: ProtocolModel, domain: string): MethodDefinition[] {
  return sortedMethods(model.methods).filter((method) => method.domain === domain);
}

function eventsInDomain(model: ProtocolModel, domain: string): EventDefinition[] {
  return sortedEvents(model.events).filter((event) => event.domain === domain);
}

function typeMap(model: ProtocolModel): Map<string, SchemaDefinition> {
  return new Map(model.schemas.map((schema) => [schema.name, schema]));
}

function renderFieldConstraint(field: SchemaField): string {
  const constraints = [
    field.min === undefined ? undefined : `min=${field.min}`,
    field.max === undefined ? undefined : `max=${field.max}`,
    field.maxLength === undefined ? undefined : `maxLength=${field.maxLength}`,
    field.derivedFrom === undefined ? undefined : `derivedFrom=${field.derivedFrom}`,
    field.deprecated ? "deprecated" : undefined
  ].filter(Boolean);
  return constraints.length > 0 ? constraints.join(", ") : "None";
}

function renderDefaultBehavior(field: SchemaField): string {
  return field.required ? "N/A" : "Omit if not used.";
}

function renderFieldName(field: SchemaField): string {
  return field.required ? field.name : `?${field.name}`;
}

function renderTypeName(type: string): string {
  const names: Record<string, string> = {
    bool: "Boolean",
    bytes: "Bytes",
    enum: "Enum",
    bitmap: "Bitmap",
    string: "String",
    uint8: "UInt8",
    uint16: "UInt16",
    uint32: "UInt32",
    uint64: "UInt64",
    int8: "Int8",
    int16: "Int16",
    int32: "Int32",
    int64: "Int64"
  };
  return names[type] ?? type;
}

function renderFields(schema: SchemaDefinition | undefined): string[] {
  if (!schema || schema.fields.length === 0) return ["No fields."];
  return table(
    ["Name", "Type", "Field ID", "Description", "Value Restrictions", "?Default Behavior"],
    schema.fields.map((field) => [
      renderFieldName(field),
      renderTypeName(field.type),
      hex(field.fieldId, 2),
      optional(field.description),
      renderFieldConstraint(field),
      renderDefaultBehavior(field)
    ]),
    ["left", "center", "center", "left", "center", "left"]
  );
}

function renderInlineType(title: string, typeName: string, schemas: Map<string, SchemaDefinition>): string[] {
  const schema = schemas.get(typeName);
  return [
    `#### ${title}`,
    "",
    `Type: \`${typeName}\``,
    "",
    ...renderFields(schema)
  ];
}

function renderMethod(method: MethodDefinition, schemas: Map<string, SchemaDefinition>): string[] {
  return [
    `### ${method.name}`,
    "",
    method.description ?? "No description provided.",
    "",
    `- Method ID: \`${hex(method.methodId)}\``,
    `- Domain: \`${method.domain}\``,
    `- Bit Offset: \`${method.bitOffset}\``,
    `- Status: \`${method.status}\``,
    `- Added in v${method.since}`,
    `- Encodings: ${inlineList(method.encodings)}`,
    `- Required Capabilities: ${inlineList(method.capabilities)}`,
    `- Possible Events: ${inlineList(method.events)}`,
    `- Possible Errors: ${inlineList(method.errors)}`,
    "",
    ...renderInlineType("Request Fields", method.request.type, schemas),
    "",
    ...renderInlineType("Response Fields", method.response.type, schemas)
  ];
}

function renderEvent(event: EventDefinition, schemas: Map<string, SchemaDefinition>): string[] {
  return [
    `### ${event.name}`,
    "",
    event.description ?? "No description provided.",
    "",
    `- Event ID: \`${hex(event.eventId)}\``,
    `- Domain: \`${event.domain}\``,
    `- Bit Offset: \`${event.bitOffset}\``,
    `- Status: \`${event.status}\``,
    `- Severity: \`${optional(event.severity)}\``,
    `- Added in v${event.since}`,
    `- Trigger: ${inlineList(event.trigger)}`,
    `- Required Capabilities: ${inlineList(event.capabilities)}`,
    "",
    ...renderInlineType("Payload Fields", event.payload.type, schemas)
  ];
}

function renderAdditionalType(schema: SchemaDefinition): string[] {
  return [
    `## ${schema.name}`,
    "",
    schema.description ?? `Kind: \`${schema.kind}\``,
    "",
    ...renderFields(schema)
  ];
}

function renderProfile(profile: ProfileDefinition): string[] {
  return [
    `## ${profile.name}`,
    "",
    `- Status: \`${profile.status}\``,
    `- Added in v${profile.since}`,
    `- Extends: \`${optional(profile.extends)}\``,
    `- Required Methods: ${inlineList(profile.requiredMethods)}`,
    `- Required Events: ${inlineList(profile.requiredEvents)}`,
    `- Required Errors: ${inlineList(profile.requiredErrors)}`,
    `- Notes: ${optional(profile.notes)}`
  ];
}

function referencedTypeNames(model: ProtocolModel): Set<string> {
  return new Set([
    ...model.methods.flatMap((method) => [method.request.type, method.response.type]),
    ...model.events.map((event) => event.payload.type)
  ]);
}

function renderMainToc(model: ProtocolModel): string[] {
  const methodDomains = domainsFor(model.methods);
  const eventDomains = domainsFor(model.events);
  const referencedTypes = referencedTypeNames(model);
  const hasAdditionalTypes = model.schemas.some((schema) => !referencedTypes.has(schema.name));
  return [
    "## Main Table of Contents",
    "",
    "- [Overview](#overview)",
    "- [Design Goals / Non-Goals](#design-goals--non-goals)",
    "- [Connection Lifecycle](#connection-lifecycle)",
    "- [Capability Discovery](#capability-discovery)",
    "- [Methods](#methods)",
    ...methodDomains.map((domain) => `  - [${domain} Methods](#${anchor(`${domain} Methods`)})`),
    "- [Events](#events)",
    ...eventDomains.map((domain) => `  - [${domain} Events](#${anchor(`${domain} Events`)})`),
    ...(hasAdditionalTypes ? ["- [Additional Types](#additional-types)"] : []),
    "- [Errors Reference](#errors-reference)",
    "- [Profiles Reference](#profiles-reference)"
  ];
}

function renderImplementedDomainDirectory(model: ProtocolModel): string[] {
  return [
    "## Implemented Domains",
    "",
    ...table(
      ["Domain", "Methods", "Events"],
      domainsFor(model.methods).map((domain) => [
        domain,
        String(methodsInDomain(model, domain).length),
        String(eventsInDomain(model, domain).length)
      ])
    )
  ];
}

function renderMethodDomainToc(model: ProtocolModel, domain: string): string[] {
  return [
    "### Methods in this domain",
    "",
    ...methodsInDomain(model, domain).map((method) => `- [${method.name}](#${anchor(method.name)})`)
  ];
}

function renderEventDomainToc(model: ProtocolModel, domain: string): string[] {
  return [
    "### Events in this domain",
    "",
    ...eventsInDomain(model, domain).map((event) => `- [${event.name}](#${anchor(event.name)})`)
  ];
}

function renderTransportProfiles(model: ProtocolModel): string[] {
  const rows = model.transports.map((t) => [
    t.name,
    t.family,
    t.frameProfile === "none" ? "Unframed" : t.frameProfile,
    t.production ? "Yes" : "No (debug)",
    t.notes ?? t.usage ?? "-"
  ]);
  const lines: string[] = [
    "## Transport Profiles",
    "",
    "AXTP runs over multiple transports. Each transport binds to a fixed Frame Profile for the lifetime of the session.",
    "",
    ...table(
      ["Transport", "Family", "Frame Profile", "Production", "Notes"],
      rows
    ),
    "",
    "**Standard Frame** (12B L1 Header + CRC16) is the primary implementation target for TCP, WebSocket Binary, and USB HID High Speed.",
    "",
    "**Compact Frame** (4B L1 Header + CRC8) is a fallback for constrained transports with MTU ≤ 64B (HID-64, BLE, UART). See §15 of the Transport Profiles spec for the full degradation guide."
  ];

  const cloudEntry = model.guide.quickStart.find((g) => g.title === "Cloud Reverse Connection");
  if (cloudEntry) {
    lines.push(
      "",
      "### Cloud Reverse Connection",
      "",
      "When a device initiates a connection to a cloud endpoint, the Physical Client/Server roles are reversed from the typical local scenario, but the Logical Server role stays with the device:",
      "",
      "```text",
      "Physical Client: Device    Physical Server: Cloud",
      "Logical Client:  Cloud     Logical Server:  Device",
      "",
      ...cloudEntry.steps.map((s) => `  ${s}`),
      "```",
      "",
      "The key invariant: **the Logical Server always sends Hello**, regardless of who initiated the TCP/WebSocket connection."
    );
  }

  const dsRpcEntry = model.guide.quickStart.find((g) => g.title === "DS-RPC Debug Adapter");
  if (dsRpcEntry) {
    lines.push(
      "",
      "### DS-RPC Debug Adapter (WebSocket Text)",
      "",
      "For browser debugging and development tooling only. Not for production.",
      "",
      ...dsRpcEntry.steps.map((s) => `- ${s}`),
      "",
      "| DS-RPC (Unframed) | Framed Mode (AXTP) |",
      "| --- | --- |",
      "| WebSocket Upgrade | CONTROL OPEN/ACCEPT |",
      "| Hello (op=0) | RPC Hello |",
      "| Identify (op=2) | RPC Identify |",
      "| Identified (op=3) | RPC Identified |",
      "| REQUEST (op=7) | RPC Request |",
      "| REQUEST_RESPONSE (op=8) | RPC RequestResponse |",
      "| EVENT (op=6) | RPC Event |",
      "| WebSocket Close | CONTROL CLOSE |",
      "| — | STREAM (not supported in DS-RPC) |"
    );
  }

  return lines;
}

function renderPayloadTypes(model: ProtocolModel): string[] {
  const lines: string[] = [
    "## Payload Types",
    "",
    "Every AXTP Frame carries exactly one payload. The `PayloadType` field in the Frame Header selects the parser.",
    "",
    ...table(
      ["Type", "ID", "Header Size", "When to Use"],
      model.payloadTypes.map((pt) => [
        `\`${pt.name}\``,
        `0x${pt.id.toString(16).padStart(2, "0")}`,
        `${pt.headerBytes}B`,
        pt.selectionRule ?? pt.description
      ])
    )
  ];

  for (const pt of model.payloadTypes) {
    if (!pt.headerFields || pt.headerFields.length === 0) continue;
    lines.push(
      "",
      `### ${pt.name} Payload Header (${pt.headerBytes}B)`,
      "",
      pt.description,
      "",
      ...table(
        ["Field", "Type", "Size", "Description"],
        pt.headerFields.map((f) => [
          `\`${f.name}\``,
          f.type,
          typeof f.bytes === "number" ? `${f.bytes}B` : f.bytes,
          f.description
        ])
      )
    );
  }

  return lines;
}

function renderWireExamples(examples: WireExample[]): string[] {
  if (examples.length === 0) return [];
  const lines: string[] = [
    "## Wire Format Examples",
    "",
    "The following examples show the exact byte layout for a complete session establishment over USB HID High Speed (Standard Frame Profile). All integers are Little-Endian."
  ];

  for (const example of examples) {
    lines.push("", `### ${example.title}`, "", example.description, "");
    for (const step of example.steps) {
      lines.push(`#### ${step.label}`, "", `**Direction:** ${step.direction}`, "");
      if (step.asciiLayout) {
        lines.push("```text", step.asciiLayout.trimEnd(), "```", "");
      }
      if (step.hexBytes) {
        lines.push("**Hex bytes:**", "", "```text", step.hexBytes, "```", "");
      }
      if (step.fieldAnnotations.length > 0) {
        lines.push("**Field annotations:**", "");
        for (const ann of step.fieldAnnotations) {
          lines.push(`- \`${ann}\``);
        }
        lines.push("");
      }
    }
  }

  return lines;
}

export function renderProtocolMarkdown(model: ProtocolModel): string {
  const schemas = typeMap(model);
  const referencedTypes = referencedTypeNames(model);
  const additionalTypes = model.schemas
    .filter((schema) => !referencedTypes.has(schema.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [
    "<!-- This file was automatically generated. Do not edit directly! -->",
    "",
    `# ${model.overview.title}`,
    "",
    ...renderMainToc(model),
    "",
    ...renderImplementedDomainDirectory(model),
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
    ...renderTransportProfiles(model),
    "",
    ...renderPayloadTypes(model),
    "",
    ...renderWireExamples(model.wireExamples),
    "",
    "## Capability Discovery",
    "",
    "Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.",
    "",
    ...table(
      ["Domain", "Methods"],
      domainsFor(model.methods).map((domain) => [
        domain,
        list(methodsInDomain(model, domain).map((method) => `${method.bitOffset}: ${method.name}`))
      ])
    ),
    "",
    "# Methods",
    "",
    ...domainsFor(model.methods).flatMap((domain) => [
      `## ${domain} Methods`,
      "",
      ...renderMethodDomainToc(model, domain),
      "",
      ...methodsInDomain(model, domain).flatMap((method) => ["---", "", ...renderMethod(method, schemas), ""]),
      "---",
      ""
    ]),
    "# Events",
    "",
    ...domainsFor(model.events).flatMap((domain) => [
      `## ${domain} Events`,
      "",
      ...renderEventDomainToc(model, domain),
      "",
      ...eventsInDomain(model, domain).flatMap((event) => ["---", "", ...renderEvent(event, schemas), ""]),
      "---",
      ""
    ]),
    ...(additionalTypes.length > 0 ? [
      "# Additional Types",
      "",
      ...additionalTypes.flatMap((type) => [...renderAdditionalType(type), "", "---", ""])
    ] : []),
    "# Errors Reference",
    "",
    ...table(
      ["Code", "Name", "Category", "Severity", "Retryable", "Status", "Message"],
      sortedErrors(model.errors).map((error) => [
        hex(error.code),
        error.name,
        error.category,
        error.severity,
        error.retryable ? "Yes" : "No",
        error.status,
        error.message
      ])
    ),
    "",
    "# Profiles Reference",
    "",
    ...sortedProfiles(model.profiles).flatMap((profile) => [...renderProfile(profile), "", "---", ""])
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export async function emitProtocolMarkdown(model: ProtocolModel, outDir: string): Promise<void> {
  await writeTextFile(path.join(outDir, "protocol.md"), renderProtocolMarkdown(model));
}
