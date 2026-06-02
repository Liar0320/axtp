# AXTP Protocol Plan

> Status: Protocol Content Source
> Scope: AXTP v1 content migration plan and protocol definition workflow

## 1. Purpose

This file records the migration plan from hand-written registry documents to a Protocol Definition driven workflow.

AXTP v1 now separates the documentation system into three layers:

1. Stable normative specs under `docs/specs/`.
2. Machine-readable protocol facts under `registry/**/*.yaml` and `registry/domains/**/*.yaml`.
3. Generated Protocol IR under `protocol/axtp.protocol.yaml`.
4. Generated outputs under `docs/generated/` and runtime/tooling generated directories.
5. Source planning, future and legacy material under `docs/source/`.

## 2. Source Of Truth

`registry/**/*.yaml` and `registry/domains/**/*.yaml` are the machine-readable source of truth for v1 method, event, error, schema and profile facts. `protocol/axtp.protocol.yaml` is generated Protocol IR and must not be edited by hand.

The previous 08-13 hand-written registry documents have been moved to:

```text
docs/source/
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
| `12-AXTP-Types-and-Capability-Spec.md` | `types:` model, fieldId rules and v1 `capability.supportedMethods` scope. |
| `13-AXTP-Profiles-Registry-Spec.md` | `profiles:` model and implementation profile rules. |
| `21-AXTP-Capability-Naming-and-Feature-Taxonomy.md` | `domain.feature` capability naming and feature taxonomy governance. |

These files must not contain full business request/event/error tables.

## 4. Protocol Definition Layer

Generated `protocol/axtp.protocol.yaml` contains:

- protocol metadata
- overview and architecture text used to generate `protocol.md`
- frame profiles and transport profile bindings
- payload type facts
- CONTROL and STREAM decisions
- types, methods, events, errors and profiles

New protocol content must be added to `registry/**/*.yaml` or `registry/domains/<domain>/domain.yaml` first. Generated documentation, schemas, SDK enums, bitmaps and conformance tests must be derived from the generated Protocol IR.

Business capability names must first normalize to the `domain.feature` taxonomy before adding methods, events or capability facts.

## 5. Generation Targets

The target generated tree is:

```text
docs/generated/
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
- Compact/HID-64/BLE/UART are low-bandwidth degradation paths outside AXTP v1 Core.
- CONTROL payload uses one 5-byte fixed header.
- Binary RPC payload uses one 11-byte fixed header.
- STREAM payload uses one 16-byte fixed header.
- The historical 8-byte STREAM header is not part of v1 Core.
- CONTROL OPEN and ACCEPT are required before RPC/STREAM payloads.
- READY is optional/reserved and not required by v1 Core.
- v1 capability discovery is limited to `capability.supportedMethods`.
- Full dynamic capability modeling is reserved for v2/P1.
- WebSocket Unframed JSON is a formal RPC-only path and must not carry production STREAM.
- Domain-scoped method/event masks are wire-relevant and must be specified in v1 Core docs, not only in legacy registry tables.

## 7. Migration Steps

1. Keep existing stable specs in `docs/specs/`.
2. Replace old 08-13 registry tables with Protocol Definition meta specs.
3. Keep old 08-13 source/planning documents under `docs/source/` as review material.
4. Consolidate current registry/schema facts into `registry/**/*.yaml` and `registry/domains/**/*.yaml`.
5. Generate `protocol/axtp.protocol.yaml` and `docs/generated/protocol.md` from Source YAML.
6. Extend the generator so schema, SDK enum, bitmap and conformance outputs are derived from the same file.
7. Keep complete Capability Model material in `docs/source/AXTP-Capability-Model-v2.md`.
8. Keep legacy compatibility tables in `docs/source/AXTP-Legacy-Compatibility-Reference.md`.

## 8. Change Workflow

For a new method/event/type/error/profile:

1. Update `registry/**/*.yaml` or `registry/domains/<domain>/domain.yaml`.
2. Run protocol validation.
3. Regenerate `protocol/axtp.protocol.yaml`, `docs/generated/protocol.md` and code artifacts.
4. Review generated diffs.
5. Do not manually edit generated files.
