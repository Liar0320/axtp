---
name: adopt-protocol-draft
description: Stage 30 adoption skill for reviewed AXTP docs/protocol domain-feature drafts. Use when an already-reviewed protocol draft should be approved, formalized, adopted, activated, landed, or converted into specs 08-13 alignment, spec 14 alignment when profiles/MVP change, and registry/domain YAML facts. Fixes the draft as the formal accepted proposal but does not manually edit generated artifacts.
---

# Adopt Protocol Draft

Stage 30. Convert a reviewed AXTP protocol draft into formal protocol facts after `draft-business-protocol`: align the accepted proposal with `docs/specs/08-13`, also `docs/specs/14` when profiles/MVP contracts change, freeze the draft as the formal proposal, and write the confirmed facts into YAML.

## Hard Boundaries

- Start from an existing `docs/protocol/<domain>/<domain.feature>.md` draft.
- Do not adopt drafts containing unresolved `[REVIEW-BLOCKER]`, `[REVIEW-FIX]`, or `[REVIEW-ASK]` facts unless the user provides exact confirmed facts and the adoption is scoped around them.
- Do not invent method/event/error/capability/profile semantics that are not present in the reviewed draft or specs.
- Do not edit `protocol/axtp.protocol.yaml`, `docs/generated/*`, `tooling/mcp/*`, `tooling/test-vectors/*`, `runtimes/*/generated/*`, or `runtimes/cpp/core/include/generated/*` by hand.
- Do not run full generated artifact emission as the main goal of this skill; use `generate-axtp-protocol` after adoption.
- New business features default to `registry/domains/<domain>/domain.yaml`.
- Use core `registry/` files only for Core/MVP adopted facts, shared schemas, core constants, profile governance, or accepted legacy mappings.
- Never duplicate the same method/event/error/schema/capability/profile in both core registry files and domain YAML.
- Preserve stable IDs, field IDs, `bitOffset`, and names.

## Required Evidence

Read enough local evidence to avoid guessing:

```text
docs/protocol/README.md
docs/protocol/<domain>/<domain.feature>.md
docs/specs/08-AXTP-Capability-Naming-and-Feature-Taxonomy.md
docs/specs/09-AXTP-Protocol-Definition-Mapping-Spec.md
docs/specs/10-AXTP-Methods-Registry-Spec.md
docs/specs/11-AXTP-Events-Registry-Spec.md
docs/specs/12-AXTP-Errors-Registry-Spec.md
docs/specs/13-AXTP-Types-and-Capability-Spec.md
docs/specs/14-AXTP-Profiles-Registry-Spec.md
docs/specs/17-AXTP-Schema-Field-Numbering.md
docs/specs/19-AXTP-Generator-v1实现规范.md
registry/**/*.yaml
registry/domains/**/*.yaml
docs/generated/protocol.md
protocol/axtp.protocol.yaml
```

For stream, OTA, transport-sensitive, or low-bandwidth features, also read specs 02-06 and 18. For legacy adoption, read cited legacy evidence under `docs/legacy-protocols/**`, `docs/migration/**`, or `registry/legacy/legacy_mapping.yaml` if it already exists.

## Workflow

### 1. Confirm Draft Eligibility

Classify the draft:

| State | Meaning | Action |
|---|---|---|
| Adopted | YAML/specs already fully cover it | Do not duplicate; report existing facts |
| Partially adopted | Some facts exist, draft adds reviewed gaps | Patch only missing confirmed facts |
| Ready for adoption | Draft has `[REVIEW-OK]` or equivalent confirmation and no unresolved blockers | Proceed |
| Not ready | Unresolved review markers, missing field shapes, unclear domain, or no review evidence | Stop and list blockers |

If a draft has mixed readiness, adopt only explicitly confirmed sections and leave unresolved sections in the report.

### 2. Extract Accepted Facts

Extract only confirmed facts:

- `domain.feature` and domain boundary
- capability names and capability type/schema
- methods, request schema, response schema, linked events, errors
- events and event schemas
- schemas, field names, field types, required/optional status, limits, descriptions
- domain-specific errors
- stream/profile additions
- concrete legacy mappings
- open questions that must remain out of specs/YAML

### 3. Align Specs 08-13/14

Reverse-confirm the accepted proposal into specs where needed:

| Spec | Confirm or update |
|---|---|
| 08 | domain.feature naming, method/event naming templates, feature taxonomy |
| 09 | domain placement, ID range, DomainId, bitOffset, mapping to Protocol Definition |
| 10 | method registry rules or accepted method table references if the local spec pattern requires it |
| 11 | event registry rules or accepted event table references if needed |
| 12 | error code rules and domain-specific error placement |
| 13 | schema/type/capability rules and capability placement |

Use spec 14 as well if the proposal changes profile membership, MVP requirements, or profile registry semantics.

Do not turn specs into the machine fact source. Specs are governance and normative explanation; YAML remains the machine input.

### 4. Freeze The Draft As Formal Proposal

Update the draft only enough to record adoption:

- Mark accepted sections as `[REVIEW-OK]` or add an adoption note/table.
- Preserve unresolved sections as open questions and keep them out of YAML.
- Record that future unadopted facts must update the `docs/protocol` proposal first, then re-run adoption; already-adopted semantic changes must use `amend-adopted-protocol`.
- Do not remove useful review history unless it is misleading.

### 5. Choose YAML Targets

Use these defaults:

| Fact | Default target |
|---|---|
| New business method/event/schema/error/capability/profile | `registry/domains/<domain>/domain.yaml` |
| Core/MVP stable method/event/capability | `registry/method`, `registry/event`, or `registry/capability` only after governance confirmation; do not keep empty placeholder files |
| Shared schema used by multiple domains | `registry/schema/*.yaml` only if truly shared |
| Legacy mapping | `registry/legacy/legacy_mapping.yaml` only with concrete evidence; create the file only when at least one mapping is adopted |
| Core constants | `registry/core/*.yaml` only after spec change confirmation |

If no valid target exists, stop and report the required governance change.

### 6. Assign IDs And bitOffset values

Compute from specs and existing YAML:

- Method IDs must be globally unique and in the correct domain range.
- Event IDs must be globally unique and in the correct domain range.
- Capability IDs and DomainId/Domain-Scoped Mask rules must follow specs 09 and 13.
- `bitOffset` must be unique within the domain and should remain contiguous unless existing YAML intentionally reserves gaps.
- New schema field IDs start from `0x01` in accepted field order unless explicitly specified.
- Existing schema field IDs must be preserved; append with the next safe ID.
- Prefer existing common errors before adding domain-specific errors.

Never reuse deprecated or stable values for different semantics.

### 7. Edit YAML Sources

Use `apply_patch`. Keep edits scoped to specs 08-13, spec 14 when applicable, the adopted draft, and chosen YAML sources.

Rules:

- Use source field names already used by the repo, such as `id`, `bitOffset`, `request_schema`, `response_schema`, and `event_schema`.
- Keep status as `draft` unless the draft and governance explicitly say MVP/stable.
- Preserve existing ordering patterns.
- Do not copy review prose, `[REVIEW-*]`, open questions, or `TBD` values into YAML.
- Do not create legacy mappings without concrete old values.

### 8. Validate Adoption Sources

Run source-level checks after specs/YAML edits:

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
git diff --check
```

If pnpm dependency approval blocks scripts, use and report:

```bash
pnpm --dir generators --config.verify-deps-before-run=false build
pnpm --dir generators --config.verify-deps-before-run=false test
pnpm --dir generators --config.verify-deps-before-run=false validate:sources
git diff --check
```

Do not manually edit generated outputs in this skill. The next step is `generate-axtp-protocol`.

## Final Report

Report:

- Draft adopted and eligibility decision.
- Specs 08-13/14 files changed, if any.
- Draft file changes and adoption marker.
- YAML source files changed.
- Assigned IDs, `bitOffset`, and schema field IDs.
- Open questions or skipped draft sections.
- Validation commands and results.
- Next step: run `docs/dev/skills/50-generate-axtp-protocol/SKILL.md`.
- Future post-adoption semantic changes must use `docs/dev/skills/40-amend-adopted-protocol/SKILL.md`.

If adoption is blocked, do not edit YAML. Report the exact blocker and the minimum draft/spec update needed.
