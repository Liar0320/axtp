---
name: plan-protocol-flow
description: Generate AXTP protocol interaction flow plans from business scenarios, user stories, UI prototypes, product workflows, or end-to-end feature requirements. Use when the user wants to map a scenario such as "device adjusts algorithm parameters" into actors, screens, protocol calls/events/capabilities, existing protocol coverage, gaps, and follow-up draft-business-protocol work. This stage writes docs/flows Markdown only by default and must not write registry YAML or generated artifacts.
---

# Plan Protocol Flow

Turn a business scenario, user story, UI prototype, or end-to-end workflow into a reviewable AXTP protocol interaction plan under `docs/flows/**`.

This skill sits before `draft-business-protocol`: it discovers which existing protocols are needed across the whole story, records what is already adopted or drafted, and identifies gaps that should be handed to `draft-business-protocol`, `amend-adopted-protocol`, or runtime implementation.

## Boundaries

- Edit `docs/flows/**` by default.
- Do not edit `registry/**`, `registry/domains/**`, `protocol/axtp.protocol.yaml`, `docs/generated/**`, `tooling/mcp/**`, `tooling/test-vectors/**`, or runtime generated files.
- Do not change `docs/protocol/**` unless the user explicitly asks to continue into the draft/update stage.
- Do not invent adopted method names. Use generated/YAML facts when adopted, and mark unadopted candidates as gaps.
- If an adopted protocol needs a semantic change, route to `amend-adopted-protocol`, not `draft-business-protocol`.
- If a missing or draft-only method/schema is needed, record the gap and route to `draft-business-protocol`.

## Required Workflow

### 1. Collect Scenario Inputs

Extract:

- product or device family
- user goal and success criteria
- actors: user, App, cloud/server, device, firmware services, SDK/tooling
- UI screens, controls, fields, default values, save/apply/reset behavior, and validation messages
- story steps and alternate/error paths
- expected device behavior, events, latency, persistence, and restart requirements
- known legacy commands, existing docs, images, PDFs, or prototype files

If a UI image is attached, inspect it and list visible controls and fields in the flow doc. If the image is missing or inaccessible, leave `[REVIEW-ASK]` questions instead of guessing.

### 2. Locate AXTP Evidence

Read enough context to avoid guessing:

```text
docs/README.md
docs/protocol/README.md
docs/generated/protocol.md
protocol/axtp.protocol.yaml
registry/**/*.yaml
registry/domains/**/*.yaml
docs/protocol/**
docs/legacy-classification/** when legacy evidence is relevant
docs/migration/** when migration strategy is relevant
```

Search with requirement keywords and likely English equivalents. For "算法参数调整", search at least:

```bash
rg -n "algorithm|算法|audio\\.algorithm|getAlgorithm|setAlgorithm|resetAlgorithm|capabilit" docs/protocol registry registry/domains docs/generated protocol
```

### 3. Build The Story Map

Split the scenario into steps:

| Step type | Examples |
|---|---|
| discovery | connect, identify, supported methods, capability query |
| read state | open page, load current config, load limits/defaults |
| user edit | toggle, slider, select, text input, reset |
| validation | local range check, device-side validation, permission check |
| apply | set config, start action, create stream, commit |
| observe | event, polling, progress, state changed |
| rollback | reset, cancel, restore defaults |
| error | unsupported method, invalid argument, busy, permission denied |

For each step, decide whether it is:

- local UI behavior with no protocol call
- existing adopted/generated protocol
- draft-only protocol
- missing protocol gap
- runtime/SDK implementation detail

### 4. Classify Protocol Coverage

Use these states:

| State | Meaning | Next action |
|---|---|---|
| Adopted/generated | YAML/generated already define the method/event/schema | Reference `docs/generated/protocol.md` and use exact names |
| Partially adopted | Some facts exist, but the scenario needs a semantic extension or missing field | Route to `amend-adopted-protocol` |
| Drafted only | `docs/protocol/**` has a candidate but YAML/generated do not | Route to `draft-business-protocol` after review |
| Missing | No suitable draft or adopted fact exists | Propose candidate `domain.feature` and route to `draft-business-protocol` |
| Non-protocol | UI-only, local validation, business policy, or implementation detail | Keep out of protocol work |

For the algorithm parameter example, prefer the adopted `audio.algorithm` path when it covers the UI:

- `audio.getAlgorithmCapabilities`
- `audio.getAlgorithmConfig`
- `audio.setAlgorithmConfig`
- `audio.resetAlgorithmConfig`
- `audio.algorithmConfigChanged`

If the UI needs fields or algorithms not present in generated/YAML, classify that as `Partially adopted` and route to `amend-adopted-protocol`.

### 5. Write The Flow Plan

Create or update:

```text
docs/flows/<scenario-slug>.md
```

Use `references/flow-plan-template.md` as the structure. A flow plan must include:

- title and status
- source inputs and UI/prototype observations
- actors and system boundaries
- business story summary
- assumptions and non-goals
- protocol coverage summary
- end-to-end sequence diagram
- step-by-step interaction table
- protocol call/event details
- gaps and routed follow-up skill
- test fixtures and acceptance criteria
- review questions

Keep flow docs scenario-oriented. Do not duplicate full protocol schemas; link to `docs/generated/protocol.md` for adopted facts and `docs/protocol/**` for drafts.

### 6. Route Follow-Up Work

After writing the flow plan:

| Finding | Route |
|---|---|
| All required facts are adopted/generated | Runtime/App/server implementation can proceed from generated protocol |
| Missing new business capability or method | Use `docs/dev/skills/draft-business-protocol/SKILL.md` |
| Draft exists but lacks scenario fields | Use `draft-business-protocol` to modify that draft |
| Adopted fact needs semantic correction, field addition/removal, rename, or deprecation | Use `docs/dev/skills/amend-adopted-protocol/SKILL.md` |
| YAML facts are updated and outputs need refresh | Use `docs/dev/skills/generate-axtp-protocol/SKILL.md` |

Do not automatically jump into the next skill unless the user asked to implement the follow-up in the same turn or the workflow instruction explicitly requires it.

## Final Report

Report:

- flow plan file path
- scenario coverage decision
- adopted/generated protocols used
- draft-only or missing protocol gaps
- next skill for each gap
- files changed
- validation commands and results
- confirmation that no registry/generated/protocol IR files were modified

## Useful Commands

```bash
rg --files docs/flows docs/protocol registry registry/domains docs/generated
rg -n "keyword1|keyword2|关键词" docs/protocol registry registry/domains docs/generated protocol
git diff --check -- docs/flows docs/dev/skills
git status --short docs/flows docs/dev/skills docs/protocol registry protocol docs/generated
```
