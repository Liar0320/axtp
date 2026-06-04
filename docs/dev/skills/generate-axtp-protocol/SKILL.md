---
name: generate-axtp-protocol
description: Generate AXTP protocol artifacts from accepted registry YAML facts. Use when the user asks to generate, regenerate, build, emit, refresh, validate, or publish AXTP protocol artifacts after specs and registry/domain YAML are already updated. This skill runs the Generator pipeline from YAML to Protocol IR, generated docs, tooling JSON, test vectors, and runtime generated headers.
---

# Generate AXTP Protocol

Run the deterministic AXTP generation stage after `adopt-protocol-draft` or `amend-adopted-protocol` has updated YAML facts.

## Boundaries

- Input is `registry/**/*.yaml` and `registry/domains/**/*.yaml`.
- Specs 08-14 are governance context, not the machine input for generation.
- Do not infer new protocol facts from `docs/protocol/**` or `docs/specs/**` during generation.
- Do not hand-edit generated outputs.
- If validation fails because source YAML or Generator logic is wrong, stop and report the source issue unless the user asked you to fix it.

## Required Context

Read only what is needed:

```text
docs/specs/19-AXTP-Generator-v1实现规范.md
registry/**/*.yaml
registry/domains/**/*.yaml
generators/package.json
```

If validation errors mention wire facts, also read the relevant specs:

```text
docs/specs/02-AXTP-Frame-and-Payload-Spec.md
docs/specs/04-AXTP-Control-Session-Spec.md
docs/specs/05-AXTP-RPC-Session-Spec.md
docs/specs/06-AXTP-Stream-Spec.md
docs/specs/08-AXTP-Capability-Naming-and-Feature-Taxonomy.md
docs/specs/09-AXTP-Protocol-Definition-Mapping-Spec.md
docs/specs/13-AXTP-Types-and-Capability-Spec.md
```

## Workflow

### 1. Confirm Inputs

Check the working tree and identify source changes:

```bash
git status --short
git diff --name-only -- registry registry/domains docs/specs docs/protocol generators
```

If only rough drafts changed and no YAML was adopted, do not generate. Route back to `adopt-protocol-draft`.

If only an adopted proposal or specs changed but the corresponding YAML facts were not amended, do not generate. Route to `amend-adopted-protocol` unless the change is documentation-only and intentionally does not affect generated output.

### 2. Run Generator Pipeline

Run:

```bash
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators generate
pnpm --dir generators validate:protocol
git diff --check
```

If pnpm blocks script execution because dependency build approval is pending, use and report:

```bash
pnpm --dir generators --config.verify-deps-before-run=false build
pnpm --dir generators --config.verify-deps-before-run=false test
pnpm --dir generators --config.verify-deps-before-run=false validate:sources
pnpm --dir generators --config.verify-deps-before-run=false generate
pnpm --dir generators --config.verify-deps-before-run=false validate:protocol
git diff --check
```

### 3. Verify Outputs

Expected generated outputs include:

```text
protocol/axtp.protocol.yaml
docs/generated/protocol.md
docs/generated/protocol.json
docs/generated/*_registry.generated.md
tooling/mcp/*.generated.json
tooling/test-vectors/*
runtimes/cpp-core/include/axtp/generated/*
generators/src/__snapshots__/*
```

Use `git diff --name-only` and targeted `rg`/JSON checks to confirm adopted method/event/capability/schema names appear in Protocol IR and generated docs.

### 4. Handle Failures

- If `validate:sources` fails, the source YAML or specs alignment is wrong. Report the exact source facts to fix; do not patch generated files.
- If `generate` changes unexpected files, report them and inspect Generator configuration before proceeding.
- If `validate:protocol` fails, compare Protocol IR, generated docs, and relevant specs; fix source facts or Generator logic only if requested.
- If tests fail due to snapshots, inspect whether generated output changed intentionally before updating snapshots with the repo's Vitest snapshot workflow.

## Final Report

Report:

- Source YAML/spec inputs detected.
- Commands run and results.
- Generated files changed.
- Any validation failures or skipped checks.
- Confirmation that generated files were produced by Generator and not manually edited.
