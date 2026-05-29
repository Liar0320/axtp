# AXTP Protocol Plan

> Status: Protocol Content Source
> Scope: AXTP v1 content migration plan and protocol definition workflow

## 1. Purpose

This file records the migration plan from hand-written registry documents to a Protocol Definition driven workflow.

AXTP v1 now separates the documentation system into three layers:

1. Stable normative specs under `standard/docs/`.
2. Protocol content source under `protocol-source/`.
3. Machine-readable protocol facts under `protocol/axtp.protocol.yaml`, with generated outputs under `generated/`.

## 2. Source Of Truth

`protocol/axtp.protocol.yaml` is the only machine-readable protocol definition for v1 method, event, error, type and profile facts.

The previous 08-13 hand-written registry documents have been moved to:

```text
protocol-source/legacy-docs/registry-v2/
```

They are retained as migration reference material, not as current normative registry tables.

## 3. Stable Document Layer

The stable normative layer defines rules and constraints:

| File | Role |
|---|---|
| `08-AXTP-Protocol-Definition-Mapping-Spec.md` | Mapping between JSON-RPC, Binary-RPC and `protocol.yaml`. |
| `09-AXTP-Methods-Registry-Spec.md` | `methods:` entry model and validation rules. |
| `10-AXTP-Events-Registry-Spec.md` | `events:` entry model and validation rules. |
| `11-AXTP-Errors-Registry-Spec.md` | `errors:` entry model and error mapping rules. |
| `12-AXTP-Types-and-Capability-Spec.md` | `types:` model, fieldId rules and v1 capability scope. |
| `13-AXTP-Profiles-Registry-Spec.md` | `profiles:` model and implementation profile rules. |

These files must not contain full business request/event/error tables.

## 4. Protocol Definition Layer

`protocol/axtp.protocol.yaml` contains:

- protocol metadata
- overview and architecture text used to generate `protocol.md`
- frame profiles and transport profile bindings
- payload type facts
- CONTROL and STREAM decisions
- types, methods, events, errors and profiles

New protocol content must be added to `protocol/axtp.protocol.yaml` first. Generated documentation, schemas, SDK enums, bitmaps and conformance tests must be derived from it.

## 5. Generation Targets

The target generated tree is:

```text
generated/
  protocol.md
  schema/
  cpp/
  ts/
  bitmap/
  conformance/
```

`generated/protocol.md` is the human-facing release artifact. It must include both protocol overview material and generated reference tables.

## 6. AXTP v1 Decisions To Preserve

- Transport Profile determines Frame Profile.
- AXTP v1 does not negotiate Header/Profile combinations dynamically.
- `STANDARD_FRAME = STANDARD_L1 + STANDARD_L2`.
- `COMPACT_FRAME = COMPACT_L1 + COMPACT_L2`.
- Mixed Standard/Compact L1/L2 combinations are not supported in v1.
- CONTROL payload uses one 5-byte fixed header.
- Binary RPC payload uses one 11-byte fixed header.
- STREAM payload uses one 16-byte fixed header.
- The historical 8-byte STREAM header is not part of v1 Core.
- CONTROL OPEN and ACCEPT are required before RPC/STREAM payloads.
- READY is optional/reserved and not required by v1 Core.
- v1 capability discovery is limited to `capability.supportedMethods`.
- Full dynamic capability modeling is reserved for v2/P1.
- WebSocket Text and HTTP JSON are debug or legacy adapter paths and must not carry production STREAM.

## 7. Migration Steps

1. Keep existing stable specs in `standard/docs/01-core-protocol/`.
2. Replace old 08-13 registry tables with Protocol Definition meta specs.
3. Move old 08-13 registry documents into `protocol-source/legacy-docs/registry-v2/`.
4. Consolidate current registry/schema facts into `protocol/axtp.protocol.yaml`.
5. Generate `generated/protocol.md` from `protocol/axtp.protocol.yaml`.
6. Extend the generator so schema, SDK enum, bitmap and conformance outputs are derived from the same file.

## 8. Change Workflow

For a new method/event/type/error/profile:

1. Update `protocol/axtp.protocol.yaml`.
2. Run protocol validation.
3. Regenerate `generated/protocol.md` and code artifacts.
4. Review generated diffs.
5. Do not manually edit generated files.
