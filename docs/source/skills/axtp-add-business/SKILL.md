---
name: axtp-add-business
description: Interactively guide AXTP business protocol additions. Use when a user wants to add, change, activate, or migrate an AXTP business method, event, type/schema, error, capability, profile, stream/OTA flow, or legacy mapping using the current registry/domains source model and three-stage generator.
---

# AXTP Add Business

Use this skill to add one AXTP business capability through an interactive, form-driven flow. The goal is to help the user fill the protocol facts step by step, then update YAML sources and run the three-stage generator.

## Non-Negotiables

- Ask interactively. Do not dump the full form at once. Ask the next 1-3 missing questions, wait for the user, then continue.
- Do not edit `protocol/axtp.protocol.yaml` by hand.
- Do not edit `docs/generated/*`, `runtimes/*/generated/*`, `tooling/mcp/*`, or `tooling/test-vectors/*` by hand.
- New business features default to `registry/domains/<domain>/domain.yaml`.
- Use core `registry/` files only for core constants, shared schemas, MVP/Core adopted entries, and accepted legacy mappings.
- Never duplicate the same method/event/type/error/capability/profile in both core registry files and domain YAML.
- Promotion from domain to Core/MVP is a governance step: preserve IDs/fieldIds/bit_offset and remove the old domain entry.
- Preserve stable wire values. Never reuse deprecated or stable IDs for different semantics.

## Required Evidence

Before proposing YAML, read enough local evidence to avoid guessing:

- `docs/specs/08-13` for registry/type/profile meta rules.
- `docs/source/09-13` for planning tables, candidate IDs, MVP notes, and legacy hints.
- Existing YAML under `registry/`, especially `registry/domains/`.
- For stream, OTA, low-bandwidth, or transport-sensitive features, also check `docs/specs/02`, `04`, `05`, `06`, `07`, and `17`.

Summarize the evidence chain before editing.

## Interactive Flow

At each step, ask only what is still unknown. If the repo already answers something, state the inferred value and ask for confirmation only when it materially affects the protocol.

### Step 1 - Business Intent

Confirm:

- Actor: who calls it, usually Client/Host/Cloud.
- Device behavior: what the device must do.
- Interaction model: `request_response`, `event_only`, or `stream_control`.

Example question:

> 这个业务的核心动作是什么？例如“Host 请求设备打开 HID 音视频 STREAM，设备返回 streamId 和协商参数”。

### Step 2 - Domain Placement

Choose the domain from existing registry/source evidence, or propose a new domain only if none fits.

Common domains:

| Domain | Use |
|---|---|
| `device` | device identity and lifecycle |
| `capability` | capability discovery |
| `system` | reboot, time, reset, power |
| `firmware` | firmware update control plane |
| `stream` | stream/session control plane |
| `display` | brightness, resolution, layout, input |
| `video` | video source/codec/output control |
| `audio` | audio control |
| `input` | input source, KVM, HID |
| `network` | network configuration |
| `storage` / `file` | storage and file transfer |
| `log` / `diagnostic` | logging, diagnostics, production test |
| `sensor` | sensor data/control |
| `auth` | authentication and access control |
| `vendor` | private extension |

Default target for new business:

```text
registry/domains/<domain>/domain.yaml
```

### Step 3 - Method Shape

For each method, confirm:

- Name: `domain.verbObject`, camelCase.
- RPC op: usually `request_response`.
- Status: usually `draft` for new business.
- Since: usually current protocol version.
- Description.

Recommended verbs: `get`, `set`, `list`, `open`, `close`, `start`, `stop`, `begin`, `end`, `verify`, `apply`, `abort`, `resume`.

### Step 4 - Request Fields

Collect one field at a time or in a short table:

- `name`
- `type`: `uint8`, `uint16`, `uint32`, `uint64`, `int*`, `bool`, `enum`, `bitmap`, `string`, `bytes`, `object`, `array`
- `required`
- limits: `min`, `max`, `max_length`
- description

Use `verifyType` + `verifyValue` for generic object verification unless a spec explicitly requires algorithm-specific fields.

### Step 5 - Response Fields

Collect response fields the same way. If there are no business fields, use an empty response schema and let Protocol IR map it to `Empty`.

### Step 6 - Events

Ask whether async notification is needed. If yes:

- Name events as `domain.objectChanged`, `domain.actionCompleted`, or `domain.error`.
- Define payload fields.
- Link `trigger` to the method.
- Link required capability.

### Step 7 - Errors

Prefer existing errors first. Common choices:

| Error | Use |
|---|---|
| `SUCCESS` | success |
| `RPC_PARAM_INVALID` | invalid parameter |
| `OUT_OF_RANGE` | value outside valid range |
| `BUSY` | device busy |
| `NOT_SUPPORTED` | unsupported feature |
| `INVALID_STATE` | current state disallows operation |
| `PERMISSION_DENIED` | access denied |

Add a domain-specific error only when existing errors are not precise enough.

### Step 8 - Capability And Profile

Confirm:

- Capability name: usually `domain.featureName`.
- Capability type/schema.
- Whether this is optional, draft, or part of an implementation profile.
- Whether it should remain domain-level or be promoted to Core/MVP.

New business capabilities normally stay in `registry/domains/<domain>/domain.yaml`.

### Step 9 - Legacy Mapping

Ask only if there is an existing old command:

- `legacy_protocol`
- `legacy_cmd_value`
- `legacy_name`
- target method
- direction
- status/error mapping

Write legacy mappings to `registry/legacy/legacy_mapping.yaml` only after the AXTP target method is clear.

### Step 10 - Review Before Editing

Before editing YAML, present:

```text
Business intent:
Evidence chain:
Chosen YAML target:
Method/event/type/error/capability/profile summary:
ID and bit_offset rationale:
Legacy impact:
Generated outputs expected:
Open questions:
```

Proceed with edits only when the form is complete enough to avoid inventing wire facts.

## YAML Source Rules

- Source YAML uses `id` and `bit_offset`; generated Protocol IR uses `methodId`/`eventId` and `bitOffset`.
- `bit_offset` must be unique and contiguous from 0 within the same domain.
- Method/event names and IDs must be globally unique.
- Field IDs are one byte (`0x01`-`0xFF`) within a schema and must remain stable.
- Empty requests/responses may use an empty source schema; Protocol IR must map empty schemas to `Empty`.
- `capability.supportedMethods` bitmaps derive from `methods[].bitOffset`.
- Do not add legacy Protocol Definition fields such as `bitmapId`, `requests`, or `requiredRequests`.

## Generator Workflow

After source edits:

```bash
cd generators
npm run build
npm test
node dist/cli.js validate-sources --spec ..
node dist/cli.js generate --spec ..
node dist/cli.js validate-protocol --spec ..
git diff --check
```

`generate --spec ..` performs the three-stage flow:

```text
validate sources -> build protocol/axtp.protocol.yaml -> validate Protocol IR -> emit generated artifacts
```

Expected generated outputs include:

- `protocol/axtp.protocol.yaml`
- `docs/generated/protocol.md`
- `docs/generated/protocol.json`
- `docs/generated/*_registry.generated.md`
- `tooling/mcp/*.generated.json`
- `runtimes/cpp-core/include/axtp/generated/*`
- `tooling/test-vectors/*`

## Report Back

Final response should include:

- Evidence read.
- Source YAML files changed.
- Generated files changed.
- Validation commands and results.
- Any unresolved protocol choices.
