import path from "node:path";
import { hex, writeTextFile } from "../util.js";
function esc(value) {
    return String(value ?? "")
        .replace(/\|/g, "\\|")
        .replace(/\n+/g, "<br>");
}
function optional(value) {
    return value === undefined || value === "" ? "-" : String(value);
}
function list(values) {
    return values && values.length > 0 ? values.map(esc).join("<br>") : "-";
}
function sentenceList(values) {
    return values && values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}
function table(headers, rows) {
    if (rows.length === 0)
        return ["_No fields._"];
    return [
        `| ${headers.map(esc).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${row.map(esc).join(" | ")} |`)
    ];
}
function anchor(text) {
    return text
        .toLowerCase()
        .replace(/`/g, "")
        .replace(/[^a-z0-9\u4e00-\u9fa5 -]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}
function sortedMethods(methods) {
    return [...methods].sort((a, b) => a.methodId - b.methodId || a.name.localeCompare(b.name));
}
function sortedEvents(events) {
    return [...events].sort((a, b) => a.eventId - b.eventId || a.name.localeCompare(b.name));
}
function sortedErrors(errors) {
    return [...errors].sort((a, b) => a.code - b.code || a.name.localeCompare(b.name));
}
function sortedProfiles(profiles) {
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
}
function domainsFor(items) {
    return [...new Set(items.map((item) => item.domain))].sort();
}
function methodsInDomain(model, domain) {
    return sortedMethods(model.methods).filter((method) => method.domain === domain);
}
function eventsInDomain(model, domain) {
    return sortedEvents(model.events).filter((event) => event.domain === domain);
}
function typeMap(model) {
    return new Map(model.types.map((type) => [type.name, type]));
}
function renderFieldConstraint(field) {
    const constraints = [
        field.min === undefined ? undefined : `min=${field.min}`,
        field.max === undefined ? undefined : `max=${field.max}`,
        field.maxLength === undefined ? undefined : `maxLength=${field.maxLength}`,
        field.derivedFrom === undefined ? undefined : `derivedFrom=${field.derivedFrom}`,
        field.deprecated ? "deprecated" : undefined
    ].filter(Boolean);
    return constraints.length > 0 ? constraints.join(", ") : "None";
}
function renderFields(type) {
    if (!type || type.fields.length === 0)
        return ["No fields."];
    return table(["Name", "Type", "Required", "Field ID", "Constraints", "Description"], type.fields.map((field) => [
        field.name,
        field.type,
        field.required ? "Yes" : "No",
        hex(field.fieldId, 2),
        renderFieldConstraint(field),
        optional(field.description)
    ]));
}
function renderInlineType(title, typeName, types) {
    const type = types.get(typeName);
    return [
        `**${title}:**`,
        "",
        `Type: \`${typeName}\``,
        "",
        ...renderFields(type)
    ];
}
function renderMethod(method, types) {
    return [
        `#### ${method.name}`,
        "",
        method.description ?? "No description provided.",
        "",
        ...table(["Property", "Value"], [
            ["Method ID", hex(method.methodId)],
            ["Domain", method.domain],
            ["Bit Offset", String(method.bitOffset)],
            ["Since", method.since],
            ["Status", method.status],
            ["Encodings", list(method.encodings)],
            ["Capabilities", list(method.capabilities)],
            ["Possible Events", list(method.events)],
            ["Possible Errors", list(method.errors)]
        ]),
        "",
        ...renderInlineType("Request Fields", method.request.type, types),
        "",
        ...renderInlineType("Response Fields", method.response.type, types)
    ];
}
function renderEvent(event, types) {
    return [
        `#### ${event.name}`,
        "",
        event.description ?? "No description provided.",
        "",
        ...table(["Property", "Value"], [
            ["Event ID", hex(event.eventId)],
            ["Domain", event.domain],
            ["Bit Offset", String(event.bitOffset)],
            ["Since", event.since],
            ["Status", event.status],
            ["Severity", optional(event.severity)],
            ["Trigger", list(event.trigger)],
            ["Capabilities", list(event.capabilities)]
        ]),
        "",
        ...renderInlineType("Payload Fields", event.payload.type, types)
    ];
}
function renderAdditionalType(type) {
    return [
        `### ${type.name}`,
        "",
        type.description ?? `Kind: \`${type.kind}\``,
        "",
        ...renderFields(type)
    ];
}
function renderProfile(profile) {
    return [
        `### ${profile.name}`,
        "",
        ...table(["Property", "Value"], [
            ["Since", profile.since],
            ["Status", profile.status],
            ["Extends", optional(profile.extends)],
            ["Required Methods", list(profile.requiredMethods)],
            ["Required Events", list(profile.requiredEvents)],
            ["Required Errors", list(profile.requiredErrors)],
            ["Notes", optional(profile.notes)]
        ])
    ];
}
function referencedTypeNames(model) {
    return new Set([
        ...model.methods.flatMap((method) => [method.request.type, method.response.type]),
        ...model.events.map((event) => event.payload.type)
    ]);
}
function renderMainToc(model) {
    const methodDomains = domainsFor(model.methods);
    const eventDomains = domainsFor(model.events);
    const referencedTypes = referencedTypeNames(model);
    const hasAdditionalTypes = model.types.some((type) => !referencedTypes.has(type.name));
    return [
        "## Main Table of Contents",
        "",
        "- [Overview](#overview)",
        "- [Design Goals / Non-Goals](#design-goals--non-goals)",
        "- [Connection Lifecycle](#connection-lifecycle)",
        "- [Capability Discovery](#capability-discovery)",
        "- [Methods](#methods)",
        ...methodDomains.flatMap((domain) => [
            `  - [${domain} Methods](#${anchor(`${domain} Methods`)})`,
            ...methodsInDomain(model, domain).map((method) => `    - [${method.name}](#${anchor(method.name)})`)
        ]),
        "- [Events](#events)",
        ...eventDomains.flatMap((domain) => [
            `  - [${domain} Events](#${anchor(`${domain} Events`)})`,
            ...eventsInDomain(model, domain).map((event) => `    - [${event.name}](#${anchor(event.name)})`)
        ]),
        ...(hasAdditionalTypes ? ["- [Additional Types](#additional-types)"] : []),
        "- [Errors Reference](#errors-reference)",
        "- [Profiles Reference](#profiles-reference)"
    ];
}
export function renderProtocolMarkdown(model) {
    const types = typeMap(model);
    const referencedTypes = referencedTypeNames(model);
    const additionalTypes = model.types
        .filter((type) => !referencedTypes.has(type.name))
        .sort((a, b) => a.name.localeCompare(b.name));
    const lines = [
        "<!-- This file was automatically generated. Do not edit directly! -->",
        "",
        `# ${model.overview.title}`,
        "",
        ...renderMainToc(model),
        "",
        "## Overview",
        "",
        model.overview.summary,
        "",
        ...table(["Property", "Value"], [
            ["Protocol", model.protocol.name],
            ["Version", model.protocol.version],
            ["Spec Version", String(model.protocol.specVersion)],
            ["Registry Version", model.protocol.registryVersion],
            ["Status", optional(model.protocol.status)]
        ]),
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
        ...table(["Step", "From", "To", "Status", "Description"], model.architecture.lifecycle.map((step) => [
            step.step,
            optional(step.from),
            optional(step.to),
            optional(step.status),
            step.description
        ])),
        "",
        "### Optional Lifecycle Extensions",
        "",
        ...table(["Step", "From", "To", "Status", "Description"], model.architecture.optionalLifecycleExtensions.map((step) => [
            step.step,
            optional(step.from),
            optional(step.to),
            optional(step.status),
            step.description
        ])),
        "",
        "## Capability Discovery",
        "",
        "Capability discovery is exposed through `capability.supportedMethods`. The `CapabilitySupportedMethodsResponse.methodMasks` field is derived from `methods[].bitOffset` within each method domain.",
        "",
        ...table(["Domain", "Methods"], domainsFor(model.methods).map((domain) => [
            domain,
            list(methodsInDomain(model, domain).map((method) => `${method.bitOffset}: ${method.name}`))
        ])),
        "",
        "## Methods",
        "",
        ...domainsFor(model.methods).flatMap((domain) => [
            `### ${domain} Methods`,
            "",
            ...methodsInDomain(model, domain).flatMap((method) => [...renderMethod(method, types), "", "---", ""])
        ]),
        "## Events",
        "",
        ...domainsFor(model.events).flatMap((domain) => [
            `### ${domain} Events`,
            "",
            ...eventsInDomain(model, domain).flatMap((event) => [...renderEvent(event, types), "", "---", ""])
        ]),
        ...(additionalTypes.length > 0 ? [
            "## Additional Types",
            "",
            ...additionalTypes.flatMap((type) => [...renderAdditionalType(type), "", "---", ""])
        ] : []),
        "## Errors Reference",
        "",
        ...table(["Code", "Name", "Category", "Severity", "Retryable", "Status", "Message"], sortedErrors(model.errors).map((error) => [
            hex(error.code),
            error.name,
            error.category,
            error.severity,
            error.retryable ? "Yes" : "No",
            error.status,
            error.message
        ])),
        "",
        "## Profiles Reference",
        "",
        ...sortedProfiles(model.profiles).flatMap((profile) => [...renderProfile(profile), "", "---", ""])
    ];
    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
export async function emitProtocolMarkdown(model, outDir) {
    await writeTextFile(path.join(outDir, "protocol.md"), renderProtocolMarkdown(model));
}
//# sourceMappingURL=protocolMarkdown.js.map