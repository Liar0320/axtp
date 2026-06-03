---
name: add-business-protocol
description: Draft AXTP business protocol proposals from rough product or architecture requirements. Use when the user asks to add, design, create, or update an AXTP business protocol, protocol draft, domain.feature proposal, method/event/schema candidate, or docs/protocol document from natural language such as "添加一个控制设备输出画面布局的协议". This skill searches AXTP specs, existing docs/protocol drafts, registry/domain YAML, and decides whether to reuse, modify, or create a docs/protocol domain-feature draft; it must not formalize the protocol into registry YAML or generated artifacts.
---

# Add Business Protocol

Create or update an AXTP business protocol draft in `docs/protocol/<domain>/<domain.feature>.md` from a rough requirement. This is the first workflow stage only: produce a reviewable draft for product/architecture/R&D review, not a formal registry adoption.

## Boundaries

- Only edit `docs/protocol/**` for the draft unless the user explicitly asks otherwise.
- Do not edit `registry/**`, `registry/domains/**`, `protocol/axtp.protocol.yaml`, `docs/generated/**`, or runtime generated files.
- Do not assign final numeric IDs unless they already exist in YAML/specs; use "TBD after adoption" for new methodId/eventId/errorCode/fieldId values.
- Do not introduce new PayloadType, Frame Header business fields, WebSocket STREAM support, or runtime Header Profile negotiation.
- Always leave `[REVIEW-*]` markers for human review. Unconfirmed facts must be `[REVIEW-ASK]` or `[REVIEW-DRAFT]`.

## Required Workflow

### 1. Locate AXTP Context

Work from the repository root containing `docs/specs`, `docs/protocol`, and `registry`. If the current directory is unclear, find it with `rg --files`.

Read only the relevant parts of:

```text
docs/specs/README.md
docs/protocol/README.md
docs/specs/08-AXTP-Capability-Naming-and-Feature-Taxonomy.md
docs/specs/09-AXTP-Protocol-Definition-Mapping-Spec.md
docs/specs/10-AXTP-Methods-Registry-Spec.md
docs/specs/11-AXTP-Events-Registry-Spec.md
docs/specs/12-AXTP-Errors-Registry-Spec.md
docs/specs/13-AXTP-Types-and-Capability-Spec.md
docs/specs/14-AXTP-Profiles-Registry-Spec.md
docs/specs/19-AXTP-Generator-v1实现规范.md
```

Use `rg` to search `docs/protocol/**`, `registry/**`, and `registry/domains/**` for the requirement keywords and likely English equivalents. Example for "控制设备输出画面布局": search `output`, `display`, `layout`, `routing`, `screen`, `scene`, `画面`, `布局`, `输出`.

### 2. Decide Reuse, Modify, or Create

Make one decision and explain it in the draft and final response:

| Decision | Use when | Action |
|---|---|---|
| Reuse existing draft | Existing `docs/protocol/<domain>/<domain.feature>.md` already covers the requirement with clear candidate methods/schemas | Add a short review note or leave unchanged if it is already complete |
| Modify existing draft | Existing domain.feature is right but the draft lacks this scenario, method, event, schema, error, or boundary | Patch that draft; preserve existing review markers and user edits |
| Create new draft | No existing feature has the right domain boundary or the requirement is a new capability block | Create `docs/protocol/<domain>/<domain.feature>.md` from the template |

Choose `domain.feature` by 08 rules: feature is a capability block, not a field name. Keep `stream` for common data plane only; business streams are owned by the business domain and bind to STREAM through RPC-created `streamId`.

### 3. Inspect Implementation Degree

Before drafting, check whether matching facts already exist:

```text
registry/**/*.yaml
registry/domains/**/*.yaml
docs/generated/protocol.md
protocol/axtp.protocol.yaml
```

Use the result to label implementation degree:

| State | Meaning |
|---|---|
| Not drafted | No matching protocol draft found |
| Drafted only | Exists in `docs/protocol`, not in YAML |
| Partially adopted | Some methods/types/errors exist in YAML, but draft has gaps |
| Adopted | YAML/generated already cover the feature |

If adopted, do not create duplicate drafts. Instead add a review note explaining the existing path and any remaining gap.

### 4. Write the Draft

Use `apply_patch` for manual edits. If creating a new file, use the template in `references/protocol-draft-template.md`.

A draft must include:

- title `# AXTP <domain.feature> 协议草案`
- protocol review markers table
- document positioning: draft input, not final fact source
- domain boundary and non-goals
- target user/product scenario in plain language
- candidate capability
- candidate methods with request/response schema names
- candidate events
- candidate schemas and important fields
- candidate errors
- stream/profile notes if relevant
- legacy mapping candidates or `[REVIEW-ASK]`
- registry draft input summary
- adoption checklist for the next workflow skill
- open review questions

Prefer concise tables. Use `TBD after adoption` for numeric IDs. Preserve existing text when modifying.

### 5. Final Response

Return a short report:

- decision: reuse, modify, or create
- draft file path
- what was added or changed
- key review questions / `[REVIEW-*]` blockers
- confirmation that no registry/generated/protocol files were modified
- next step: run the protocol adoption workflow skill after human review

## Review Marker Semantics

Use these markers consistently:

| Marker | Meaning |
|---|---|
| `[REVIEW-DRAFT]` | Reasonable draft candidate, not yet accepted |
| `[REVIEW-OK]` | Naming/boundary/interface direction looks acceptable |
| `[REVIEW-FIX]` | Must revise before adoption |
| `[REVIEW-ASK]` | Needs product, architecture, device, or legacy confirmation |
| `[REVIEW-BLOCKER]` | Would mislead protocol generation if adopted as-is |

Never move `[REVIEW-ASK]` or `[REVIEW-BLOCKER]` facts into YAML in this skill.

## Useful Commands

```bash
rg --files docs/protocol registry registry/domains docs/specs
rg -n "keyword1|keyword2|关键词" docs/protocol registry registry/domains docs/specs
git diff --check -- docs/protocol
git status --short docs/protocol docs/specs docs/generated registry protocol
```
