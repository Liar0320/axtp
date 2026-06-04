# AXTP Protocol Interaction Flows

`docs/flows/` stores scenario-level protocol interaction plans.

These documents bridge product stories, UI prototypes, legacy evidence, and AXTP protocol work. They answer:

- what the user is trying to do
- which actors participate
- which protocol methods/events/capabilities are needed
- which facts are already adopted/generated
- which gaps should become new or amended `docs/protocol/**` drafts

They are not final protocol facts. Stable implementation contracts still come from:

```text
registry/**/*.yaml + registry/domains/**/*.yaml
  -> protocol/axtp.protocol.yaml
  -> docs/generated/**
```

## Workflow

```text
business scenario / UI prototype / user story
  -> plan-protocol-flow
  -> docs/flows/<scenario>.md
  -> draft-business-protocol or amend-adopted-protocol for protocol gaps
  -> adopt-protocol-draft
  -> generate-axtp-protocol
```

Use `docs/dev/skills/plan-protocol-flow/SKILL.md` when a requirement describes an end-to-end interaction rather than a single protocol method.

## Active Flow Plans

- [Audio Algorithm Level Control](audio-algorithm-level-control.md): App UI sliders for audio algorithm strength levels and restore-default behavior using `audio.algorithm`.
