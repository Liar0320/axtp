---
name: draft-business-protocol
description: Stage 20 drafting skill for AXTP business protocol proposals. Use when rough product, architecture, legacy, or flow-gap requirements need a docs/protocol domain-feature draft, including method/event/schema/error/capability/profile candidates, JSON examples, stream or firmware.update flows, or protocol classification. Writes docs/protocol drafts only by default and must not write registry YAML or generated artifacts.
---

# Draft Business Protocol

Stage 20. Create or update an AXTP business protocol draft in `docs/protocol/<domain>/<domain.feature>.md`. This stage produces a reviewable protocol proposal for product, architecture, R&D, and test review.

## Boundaries

- Edit only `docs/protocol/**` unless the user explicitly asks for documentation around the draft.
- Do not edit `registry/**`, `registry/domains/**`, `protocol/axtp.protocol.yaml`, `docs/generated/**`, `tooling/mcp/**`, `tooling/test-vectors/**`, or runtime generated files.
- Do not assign final numeric IDs unless they already exist in YAML/specs; use `TBD after adoption` for new methodId/eventId/errorCode/fieldId values.
- Do not introduce new PayloadType, Frame Header business fields, WebSocket STREAM support, or runtime Header Profile negotiation.
- JSON examples must be embedded in the `docs/protocol/**` Markdown draft by default; do not create generated JSON artifacts unless the user explicitly asks.
- JSON examples in protocol drafts must show only the RPC `d` data block, not the outer `sid` / `op` / `d` wire envelope, unless the user explicitly asks to document wire format. Request examples use `id`, `method`, and optional `params`; response examples use `id`, `status`, and optional `result`; event examples use `event`, numeric `intent`, and optional `data`.
- Always leave `[REVIEW-*]` markers for human review. Unconfirmed facts must be `[REVIEW-ASK]`, `[REVIEW-DRAFT]`, `[REVIEW-FIX]`, or `[REVIEW-BLOCKER]`.

## Required Workflow

### 1. Locate AXTP Context

Work from the repository root containing `docs/specs`, `docs/protocol`, and `registry`. Read only the relevant parts of:

```text
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

For stream, firmware.update, transport-sensitive, HID media, or low-bandwidth work, also read:

```text
docs/specs/02-AXTP-Frame-and-Payload-Spec.md
docs/specs/03-AXTP-Transport-Profiles.md
docs/specs/04-AXTP-Control-Session-Spec.md
docs/specs/05-AXTP-RPC-Session-Spec.md
docs/specs/06-AXTP-Stream-Spec.md
docs/specs/18-AXTP-Low-Bandwidth-Degradation.md
```

Search `docs/protocol/**`, `registry/**`, and `registry/domains/**` for the requirement keywords and likely English equivalents.

### 2. Decide Reuse, Modify, Or Create

Make one decision and explain it in the draft and final response:

| Decision | Use when | Action |
|---|---|---|
| Reuse existing draft | Existing `docs/protocol/<domain>/<domain.feature>.md` already covers the requirement | Add a short review note or leave unchanged if complete |
| Modify existing draft | Existing domain.feature is right but lacks scenario, method, event, schema, error, or boundary details | Patch that draft; preserve existing review markers and user edits |
| Create new draft | No existing feature has the right boundary | Create `docs/protocol/<domain>/<domain.feature>.md` from `references/protocol-draft-template.md` |

Choose `domain.feature` by 08 rules: feature is a capability block, not a field name. Keep `stream` for common data plane only; business streams are owned by the business domain and bind to STREAM through RPC-created `streamId`.

### 3. Inspect Implementation Degree

Check whether matching facts already exist:

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
| Partially adopted | Some facts exist in YAML, but draft has gaps |
| Adopted | YAML/generated already cover the feature |

If adopted, do not create a duplicate draft. If the user asks for a semantic change, field removal, deprecation, rename, narrowing, or extension to adopted facts, route to `amend-adopted-protocol`; otherwise add a review note explaining the existing path and any remaining gap.

### 4. Write The Draft

Use `apply_patch` for manual edits. A draft must include:

- title `# AXTP <domain.feature> 协议草案`
- protocol review markers table
- document positioning: draft input, not final fact source
- domain boundary and non-goals
- target user/product scenario in plain language
- candidate capability
- candidate methods with request/response schema names
- candidate events
- candidate schemas and important fields
- JSON examples for key method requests/responses/events
- candidate errors
- stream/profile notes if relevant
- legacy mapping candidates or `[REVIEW-ASK]`
- registry draft input summary
- adoption checklist for `adopt-protocol-draft`
- open review questions

Prefer concise tables. Use `TBD after adoption` for numeric IDs.

When creating a new draft or materially updating an existing draft, include or refresh a `JSON 示例` section:

- Cover the main happy-path request/response pairs for the feature.
- Include representative event payload examples when events are proposed.
- Include at least one important edge or failure example when the scenario depends on error handling.
- Keep examples consistent with candidate schema names and fields, but do not imply final methodId/eventId/fieldId values.
- Use RPC `d` data-block examples only; do not wrap examples in the outer `sid` / `op` / `d` envelope.
- Request examples must include `id`, `method`, and optional `params`.
- Response examples must echo `id`, include `status.ok`, and use numeric `status.code`; use `0` for success.
- Event examples must include `event`, numeric `intent`, and optional `data`; do not include request `id` in events.
- Do not use string error names in `status.code`. Use adopted numeric ErrorCode values from specs/YAML/generated. If a draft-only candidate error lacks a numeric code, either use the nearest adopted common numeric code in the JSON example and put the candidate name in `status.details.candidateError`, or state that the final code is `TBD after adoption` in prose outside JSON.
- Use placeholders for secrets, credentials, tokens, keys, personal data, serial numbers, MAC addresses, and IP addresses when exact values are not confirmed.
- Mark unconfirmed example fields or behavior in nearby prose with `[REVIEW-ASK]`.
- For existing drafts, refresh examples for methods/events that were added or changed; if the draft has no examples yet, add examples for the feature's primary workflow.

### 5. Final Response

Return:

- decision: reuse, modify, or create
- draft file path
- what was added or changed
- JSON examples added or refreshed
- key review questions / `[REVIEW-*]` blockers
- confirmation that no registry/generated/protocol files were modified
- next step: after human review, use `docs/dev/skills/30-adopt-protocol-draft/SKILL.md`

## Review Marker Semantics

| Marker | Meaning |
|---|---|
| `[REVIEW-DRAFT]` | Reasonable draft candidate, not yet accepted |
| `[REVIEW-OK]` | Naming/boundary/interface direction looks acceptable |
| `[REVIEW-FIX]` | Must revise before adoption |
| `[REVIEW-ASK]` | Needs product, architecture, device, or legacy confirmation |
| `[REVIEW-BLOCKER]` | Would mislead adoption or generation if formalized as-is |

Never move `[REVIEW-ASK]`, `[REVIEW-FIX]`, or `[REVIEW-BLOCKER]` facts into YAML in this skill.

## Useful Commands

```bash
rg --files docs/protocol registry registry/domains docs/specs
rg -n "keyword1|keyword2|关键词" docs/protocol registry registry/domains docs/specs
git diff --check -- docs/protocol
git status --short docs/protocol docs/specs docs/generated registry protocol
```
