# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

**AXTP (Auditoryworks Transport Protocol)** — a draft-reviewed, registry-driven protocol platform.

The authoritative flow is:

```text
docs/protocol/<domain>/<domain.feature>.md     # draft and review input
        ↓ adoption / amendment
registry/**/*.yaml + registry/domains/**/*.yaml # hand-maintained machine facts
        ↓ Generator
protocol/axtp.protocol.yaml                     # generated Protocol IR
        ↓ Generator
docs/generated/** + tooling/** + runtime generated headers
```

Do not hand-edit generated files. Do not convert rough requirements directly into YAML; new business semantics normally start in `docs/protocol/**` and are adopted only after review.

## Generator Commands

All commands run from `generators/`:

```bash
pnpm install          # first-time setup
pnpm build            # compile TypeScript → dist/
pnpm test             # run vitest tests
pnpm lint             # tsc --noEmit type check

# Run a single test file
pnpm vitest run src/validator.test.ts

# Validation
pnpm validate:sources  # validate registry/ + domains/ + Protocol IR consistency (run this before committing)
pnpm validate:protocol # validate protocol/axtp.protocol.yaml against spec docs

# Generation
pnpm generate          # full pipeline: build Protocol IR + all artifacts
pnpm build:protocol    # only write protocol/axtp.protocol.yaml
pnpm emit:protocol     # only write docs/generated/protocol.md + protocol.json (requires IR to exist)
pnpm generate:registry # only write registry docs, C++ headers, tooling JSON, test vectors
```

Shorthand from repo root (no `cd` needed):

```bash
pnpm --dir generators generate
pnpm --dir generators validate:sources
```

## Compilation Pipeline

```text
registry/**/*.yaml + registry/domains/**/*.yaml
        ↓  loadProtocolSources + validateSpec
Source Model
        ↓  buildProtocolDefinitionRaw
protocol/axtp.protocol.yaml          ← Protocol IR (generated, do not edit)
        ↓  emitRepositoryArtifacts
docs/generated/          tooling/mcp/          runtimes/*/generated/
```

This pipeline starts after YAML facts have already been adopted. `docs/protocol/**` and `docs/specs/**` are not Generator inputs for new facts.

Key generator source files in `generators/src/`:

| File | Role |
| --- | --- |
| `cli.ts` | Command entry point |
| `loader.ts` | Loads core registry YAML (payload types, control opcodes, etc.) |
| `sourceLoader.ts` | Merges `registry/domains/**/*.yaml` into the Source Model |
| `validator.ts` | Validates Source Model (ID uniqueness, schema refs, MVP constraints) |
| `protocolBuilder.ts` | Aggregates Source Model → Protocol IR |
| `protocolValidator.ts` | Validates Protocol IR structure and wire facts |
| `protocolDocsValidator.ts` | Cross-checks IR against spec docs |
| `emitters/` | One file per output target (protocolMarkdown, protocolJson, markdown, json, cpp, testVectors) |

## Protocol Architecture

Five-layer stack:

```text
Business Layer   → device / display / firmware / media domains
Registry Layer   → Method / Event / Error / Capability IDs
Payload Layer    → CONTROL (0x01) / RPC (0x02) / STREAM (0x03)
Frame Layer      → Header / Length / MessageId / Fragment / CRC
Transport Layer  → USB HID / TCP / WebSocket JSON / future low-bandwidth profiles
```

**Critical constraint**: `PayloadType` selects a parser only — it never encodes business semantics like VIDEO, OTA, FILE. Those belong in the Registry layer.

AXTP v1 has two active wire paths:

- **Standard Framed**: `AXTP-USB-HID` and `AXTP-TCP` use `Standard Frame Header(12B) + Payload(N) + CRC16(2B)` and support CONTROL / RPC / STREAM.
- **WebSocket Unframed JSON**: `AXTP-WS-JSON` and `AXTP-WS-CLOUD-REVERSE` use WebSocket JSON messages and support RPC JSON only.

Compact / HID-64 / BLE / UART behavior is low-bandwidth degradation or future profile work; do not present it as the AXTP v1 core wire path unless YAML/generated facts and specs explicitly adopt it.

Three ID namespaces that must not be confused: `MessageId` (Frame) ≠ `requestId` (RPC) ≠ `streamId` (Stream).

Byte order: Little-Endian for all multi-byte integers.

## Registry Structure

```text
registry/
├── core/          # protocol_meta, payload_type, control_opcode, rpc_encoding, stream_profile
├── method/        # adopted method entries
├── event/         # adopted event entries
├── error/         # error codes
├── capability/    # capability registry + MVP profile
├── schema/        # shared TLV type definitions
├── legacy/        # old-protocol → AXTP method mappings
└── domains/       # per-domain YAML (network/, stream/, …)
    └── <domain>/domain.yaml
```

## Protocol Lifecycle

Classify protocol work before editing:

| Request state | Correct path | Allowed edits |
|---|---|---|
| Business scenario, user story, UI prototype, or interaction flow needs protocol mapping | `docs/dev/skills/plan-protocol-flow/SKILL.md` | `docs/flows/**` |
| Rough product/business requirement | `docs/dev/skills/draft-business-protocol/SKILL.md` | `docs/protocol/**` |
| Reviewed draft should become formal protocol | `docs/dev/skills/adopt-protocol-draft/SKILL.md` | adopted draft, specs 08-14 as needed, registry YAML |
| Already-adopted/generated fact needs semantic change | `docs/dev/skills/amend-adopted-protocol/SKILL.md` | adopted proposal, specs/YAML, generated only via Generator |
| YAML facts are ready and outputs need refresh | `docs/dev/skills/generate-axtp-protocol/SKILL.md` | generated outputs via Generator |
| Runtime/SDK/tool implementation | normal code workflow | non-generated runtime/SDK/tool code |

Direct registry edits are exceptional. Use core `registry/` files only for core constants, shared schemas, MVP/Core adopted entries, profile governance, and accepted legacy mappings. New ordinary business facts default to `registry/domains/<domain>/domain.yaml` after adoption.

## YAML Fact Shape

When adoption or amendment legitimately patches a domain YAML file, preserve existing local shape and ordering. Minimal example:

```yaml
domain: sensor

methods:
  - id: 0x1201          # unique hex ID
    name: sensor.getValue
    domain: sensor
    status: draft
    bit_offset: 0
    rpc_op: request_response
    request_schema: SensorGetValueRequest
    response_schema: SensorGetValueResponse
    recommended_encoding: [json, binary_tlv]
    capabilities: [sensor.basic]
    events: [sensor.valueChanged]
    errors: [SUCCESS, RPC_METHOD_NOT_FOUND]

types:
  SensorGetValueRequest:
    kind: object
    fields:
      - id: 0x01
        name: sensorId
        type: uint16
        required: true
```

See `registry/domains/network/domain.yaml` and `registry/domains/stream/domain.yaml` for real examples.

**New public schema** → `registry/schema/*.yaml`  
**New error code** → `registry/error/error_code.yaml` or domain YAML  
**New capability** → `registry/capability/capability_registry.yaml` or domain YAML  
**New spec doc** → `docs/specs/NN-AXTP-<Title>.md` (follow existing numbering)  
**Core constants** (transport, payload type, control opcode) → `registry/core/*.yaml`

## Pre-Commit Workflow

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators generate
pnpm --dir generators validate:sources
```

Commit source YAML and generated artifacts together so they stay in sync.

## Key Spec Documents

| Doc | Content |
|---|---|
| `docs/specs/02-AXTP-Frame-and-Payload-Spec.md` | Wire format rules |
| `docs/specs/05-AXTP-RPC-Session-Spec.md` | RPC session lifecycle |
| `docs/specs/06-AXTP-Stream-Spec.md` | STREAM data plane and 16B stream header |
| `docs/specs/08-AXTP-Capability-Naming-and-Feature-Taxonomy.md` | Domain-feature and method/event naming governance |
| `docs/specs/09-AXTP-Protocol-Definition-Mapping-Spec.md` | Source YAML → IR → artifact mapping rules |
| `docs/specs/19-AXTP-Generator-v1实现规范.md` | Generator implementation spec and governance |
| `docs/generated/protocol.md` | Human-readable full protocol reference (generated) |
