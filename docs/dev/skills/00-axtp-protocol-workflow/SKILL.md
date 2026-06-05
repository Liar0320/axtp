---
name: axtp-protocol-workflow
description: Stage 00 router for AXTP protocol lifecycle work. Use when the user asks to add, change, amend, migrate, adopt, generate, or implement an AXTP business method, event, schema/type, error, capability, profile, stream/firmware.update flow, scenario interaction flow, UI-prototype-driven protocol plan, or legacy mapping but has not specified the exact stage. Routes business scenarios to plan-protocol-flow, rough requirements to draft-business-protocol, reviewed drafts to adopt-protocol-draft, already-adopted semantic changes to amend-adopted-protocol, and YAML-to-artifact refresh to generate-axtp-protocol.
---

# AXTP Protocol Workflow

Stage 00. Use this skill as the top-level router for AXTP protocol lifecycle work. It decides whether the task belongs in flow planning, drafting, adoption, post-adoption amendment, generation, direct maintenance, or runtime implementation.

## Workflow Decision

Classify the request before editing anything:

| User state | Correct workflow | Allowed edits |
|---|---|---|
| Business scenario, user story, UI prototype, or end-to-end interaction needs protocol mapping | Use `docs/dev/skills/10-plan-protocol-flow/SKILL.md` | `docs/flows/**` only |
| Rough product/architecture/business requirement | Use `docs/dev/skills/20-draft-business-protocol/SKILL.md` | `docs/protocol/**` only |
| Existing `docs/protocol/<domain>/<domain.feature>.md` draft needs review or refinement | Use `draft-business-protocol` | `docs/protocol/**` only |
| Reviewed draft should become formal protocol | Use `docs/dev/skills/30-adopt-protocol-draft/SKILL.md` | `docs/protocol/**`, `docs/specs/08-14` as needed, `registry/**`, `registry/domains/**` |
| Already-adopted/generated protocol needs semantic correction, field removal, deprecation, rename, or extension | Use `docs/dev/skills/40-amend-adopted-protocol/SKILL.md` | `docs/protocol/**`, `docs/specs/08-14` as needed, `registry/**`, `registry/domains/**`, generated artifacts via Generator |
| YAML facts are ready and artifacts need refresh | Use `docs/dev/skills/50-generate-axtp-protocol/SKILL.md` | generated artifacts only, unless validation exposes a source bug |
| Governance-confirmed registry maintenance without a draft | Use this skill directly only for narrow, non-design maintenance | Scoped YAML and then `generate-axtp-protocol` |
| Runtime/SDK/tool implementation after protocol adoption | Use generated docs/headers and normal code-edit workflow | runtime/SDK/tool code only |

Default to draft, adoption, or amendment. Direct registry edits are exceptional.

## Lifecycle

```text
Stage 10 plan-protocol-flow
  scenario / UI prototype / user story -> docs/flows/<scenario>.md
                                      -> gap list for draft/amend workflows

draft-business-protocol
  rough requirement -> docs/protocol/<domain>/<domain.feature>.md

adopt-protocol-draft
  reviewed draft -> specs 08-13 alignment, plus 14 when profiles/MVP change
                 -> formalized docs/protocol proposal
                 -> registry/**/*.yaml + registry/domains/**/*.yaml

amend-adopted-protocol
  adopted/generated protocol change
                 -> amendment note in docs/protocol proposal
                 -> specs 08-13/14 alignment if needed
                 -> patched registry/**/*.yaml + registry/domains/**/*.yaml
                 -> generated artifacts refreshed by Generator

generate-axtp-protocol
  registry YAML -> protocol/axtp.protocol.yaml
                -> docs/generated/*
                -> tooling/*
                -> runtime generated headers
                -> validation report
```

## Non-Negotiables

- Do not convert rough requirements or scenario flow plans directly into YAML.
- Do not put scenario-only UI behavior into protocol drafts; keep it in `docs/flows/**`.
- Do not adopt unresolved `[REVIEW-ASK]`, `[REVIEW-FIX]`, or `[REVIEW-BLOCKER]` facts.
- Do not edit `protocol/axtp.protocol.yaml`, `docs/generated/*`, `tooling/mcp/*`, `tooling/test-vectors/*`, or runtime generated files by hand.
- New business features default to `docs/protocol/**` first, then `registry/domains/<domain>/domain.yaml` after adoption.
- Already-adopted semantic changes must update the proposal and YAML facts first, then regenerate; do not patch generated files directly.
- Use core `registry/` files only for core constants, shared schemas, MVP/Core adopted entries, profile governance, and accepted legacy mappings.
- Preserve stable wire values. Never reuse deprecated or stable IDs, field IDs, or `bitOffset` values for different semantics.

## Direct Maintenance Guardrail

Before direct registry maintenance, report:

```text
Reason direct maintenance is safe:
Evidence read:
YAML targets:
IDs/fieldIds/bitOffset preservation plan:
Generated outputs expected:
Open questions:
```

If the user is still describing an end-to-end story or UI interaction, route to `plan-protocol-flow`. If protocol semantics are already being designed, stop and route to `draft-business-protocol`.

## Final Report

Report:

- Which lifecycle stage was used.
- Which skill handled the work.
- Evidence read.
- Files changed.
- Generated files changed by Generator, if any.
- Validation commands and results.
- Unresolved questions or skipped sections.
