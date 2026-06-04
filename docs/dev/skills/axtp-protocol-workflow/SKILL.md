---
name: axtp-protocol-workflow
description: Route AXTP protocol work to the correct lifecycle skill. Use when the user asks to add, change, amend, migrate, adopt, generate, or implement an AXTP business method, event, schema/type, error, capability, profile, stream/OTA flow, or legacy mapping but has not specified the exact stage. Routes rough requirements to draft-business-protocol, reviewed drafts to adopt-protocol-draft, already-adopted semantic changes to amend-adopted-protocol, and YAML-to-artifact generation to generate-axtp-protocol.
---

# AXTP Protocol Workflow

Use this skill as the top-level router for AXTP protocol lifecycle work. It decides whether the task belongs in drafting, adoption, post-adoption amendment, generation, direct maintenance, or runtime implementation.

## Workflow Decision

Classify the request before editing anything:

| User state | Correct workflow | Allowed edits |
|---|---|---|
| Rough product/architecture/business requirement | Use `docs/dev/skills/draft-business-protocol/SKILL.md` | `docs/protocol/**` only |
| Existing `docs/protocol/<domain>/<domain.feature>.md` draft needs review or refinement | Use `draft-business-protocol` | `docs/protocol/**` only |
| Reviewed draft should become formal protocol | Use `docs/dev/skills/adopt-protocol-draft/SKILL.md` | `docs/protocol/**`, `docs/specs/08-14` as needed, `registry/**`, `registry/domains/**` |
| Already-adopted/generated protocol needs semantic correction, field removal, deprecation, rename, or extension | Use `docs/dev/skills/amend-adopted-protocol/SKILL.md` | `docs/protocol/**`, `docs/specs/08-14` as needed, `registry/**`, `registry/domains/**`, generated artifacts via Generator |
| YAML facts are ready and artifacts need refresh | Use `docs/dev/skills/generate-axtp-protocol/SKILL.md` | generated artifacts only, unless validation exposes a source bug |
| Governance-confirmed registry maintenance without a draft | Use this skill directly only for narrow, non-design maintenance | Scoped YAML and then `generate-axtp-protocol` |
| Runtime/SDK/tool implementation after protocol adoption | Use generated docs/headers and normal code-edit workflow | runtime/SDK/tool code only |

Default to draft, adoption, or amendment. Direct registry edits are exceptional.

## Lifecycle

```text
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

- Do not convert rough requirements directly into YAML.
- Do not adopt unresolved `[REVIEW-ASK]`, `[REVIEW-FIX]`, or `[REVIEW-BLOCKER]` facts.
- Do not edit `protocol/axtp.protocol.yaml`, `docs/generated/*`, `tooling/mcp/*`, `tooling/test-vectors/*`, or runtime generated files by hand.
- New business features default to `docs/protocol/**` first, then `registry/domains/<domain>/domain.yaml` after adoption.
- Already-adopted semantic changes must update the proposal and YAML facts first, then regenerate; do not patch generated files directly.
- Use core `registry/` files only for core constants, shared schemas, MVP/Core adopted entries, profile governance, and accepted legacy mappings.
- Preserve stable wire values. Never reuse deprecated or stable IDs, field IDs, or `bit_offset` values for different semantics.

## Direct Maintenance Guardrail

Before direct registry maintenance, report:

```text
Reason direct maintenance is safe:
Evidence read:
YAML targets:
IDs/fieldIds/bit_offset preservation plan:
Generated outputs expected:
Open questions:
```

If protocol semantics are still being designed, stop and route to `draft-business-protocol`.

## Final Report

Report:

- Which lifecycle stage was used.
- Which skill handled the work.
- Evidence read.
- Files changed.
- Generated files changed by Generator, if any.
- Validation commands and results.
- Unresolved questions or skipped sections.
