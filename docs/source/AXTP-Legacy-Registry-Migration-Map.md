# AXTP Legacy Registry Migration Map

> Status: Migration Working Source
> Scope: Disposition map for legacy 08-13 registry documents

## 1. Rule Set

| Legacy content | Destination |
|---|---|
| Affects binary wire format | `docs/specs/02`, `04`, `05`, `06`, `07` |
| Affects transport/header/profile | `02` / `03` |
| Affects OPEN / ACCEPT / READY | `04` |
| Affects Hello / Identify / RPC | `05` |
| Affects STREAM header / resume | `06` |
| Concrete business method/event/type | `registry/**/*.yaml`, `registry/domains/**/*.yaml`, or `docs/source/AXTP-Protocol-Full-Reference.md` |
| Complete Capability Model | `docs/source/AXTP-Capability-Model-v2.md` |
| Registry entry meta model | `08-13` meta specs |
| Legacy compatibility reference | `docs/source/AXTP-Legacy-Compatibility-Reference.md` |

## 2. Legacy 08 Disposition

| Section | Disposition |
|---|---|
| Registry positioning, single source of truth | Keep as governance in `08`; source of truth is now `registry/**/*.yaml` and `registry/domains/**/*.yaml` |
| Header and business decoupling | Migrated to `02` |
| ID width and byte order | Migrated to `02` |
| PayloadType | Migrated to `02` |
| Control Opcode | Migrated to `04` |
| RPC Encoding / RPC Operation | Migrated to `05` |
| Stream Profile boundary | Migrated to `06` |
| Domain / method / event / error / type allocation rules | Kept in `09-13` meta specs |
| Legacy Mapping / Vendor Extension | Migrated to `07` and `docs/source/AXTP-Legacy-Compatibility-Reference.md` |
| Domain-Scoped Mask | Split into `05` eventMasks and `12` supportedMethods bitmap |

## 3. Legacy 09-11 Disposition

| Source | Disposition |
|---|---|
| MethodId online position and JSON/Binary mapping | `05` and `09` |
| Method entry fields and stability rules | `09` |
| Complete method planning tables | `docs/source/AXTP-Protocol-Full-Reference.md`; current MVP facts in Source YAML |
| EventId online position and eventMasks | `05` and `10` |
| Event entry fields and eventId ranges | `10` |
| Complete event planning tables | `docs/source/AXTP-Protocol-Full-Reference.md`; current MVP facts in Source YAML |
| ErrorCode response/control/stream mappings | `04`, `05`, `06`, `11` |
| Complete error planning tables | Current set in Source YAML; future set in protocol source |
| Legacy status mapping | `docs/source/AXTP-Legacy-Compatibility-Reference.md` |

## 4. Legacy 12-13 Disposition

| Source | Disposition |
|---|---|
| v1 `capability.supportedMethods` | `12` and Source YAML |
| Complete capability tree and query methods | `docs/source/AXTP-Capability-Model-v2.md` |
| Business capability registries | Protocol source only; not v1 Core |
| MVP payload/frame/control/RPC/stream decisions | Migrated to `02/03/04/05/06` |
| MVP method/event/error/profile facts | `registry/**/*.yaml` and `registry/domains/**/*.yaml` |
| MVP type/TLV subset | `12` and future type-system work |
| Legacy compatibility MVP | `07` and `docs/source/AXTP-Legacy-Compatibility-Reference.md` |

## 5. Execution Notes

The source files under `docs/source/` are retained as evidence, planning and migration reference. They are not normative unless their facts have been promoted into `registry/**/*.yaml` or `registry/domains/**/*.yaml`.
