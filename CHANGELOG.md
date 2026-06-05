# AXTP Spec Changelog

This changelog records AXTP Spec releases published with `spec/vMAJOR.MINOR.PATCH` tags.

## spec/v0.0.3

Conformance foundation release for AXTP Spec and runtime/tool repositories.

### Protocol

- No wire protocol fact changes from `spec/v0.0.2`.
- Keeps current `spec/v0.0.2` method and event names, including `audio.getAlgorithmConfig`, `audio.setAlgorithmConfig`, `audio.getAlgorithmCapabilities`, and `audio.algorithmConfigChanged`.
- Keeps capability discovery out of the wire-level conformance surface because current protocol docs reserve `capability.getAll` for v2/P1.

### Registry

- No registry ID or method/event fact changes from `spec/v0.0.2`.
- Treats capability conformance as generated registry and capability metadata validation against the existing registry facts.

### Schemas

- Adds conformance case and result JSON schemas under `conformance/schemas/`.
- Keeps existing protocol and business schema facts unchanged.

### Conformance

- Adds the first AXTP conformance manifest, profiles, fixtures, and YAML case suite.
- Adds 22 conformance cases covering core RPC/error behavior, session gating, framed binary handshakes, WebSocket JSON-RPC, events, streams, and capability metadata.
- Adds `scripts/validate-conformance.sh` and a `Validate conformance cases` CI workflow to validate case IDs, manifest references, profile coverage, schemas, and result shape.

### Migration

- No migration content changes from `spec/v0.0.2`.
- Existing legacy migration boundaries continue to apply.

### Runtime Impact

- Runtime/tool repositories should consume the shared `conformance/` directory from the locked AXTP Spec checkout instead of defining their own case sources.
- Native runtime conformance runners should emit `conformance-results/result.json` using the shared result schema and explicitly report unsupported or skipped cases.
- No npm, pub, PyPI, Docker, or runtime package registry publish is part of this Spec release.

## spec/v0.0.2

Automation validation release for the AXTP Spec to runtime/tool upgrade flow.

### Protocol

- No protocol fact changes from `spec/v0.0.1`.
- Uses the current generated AXTP protocol snapshot to validate release artifact packaging.

### Registry

- No registry fact changes from `spec/v0.0.1`.
- Reuses the current method, event, error, capability, profile, and domain registry facts.

### Schemas

- No schema source changes from `spec/v0.0.1`.
- Reuses the current generated schema descriptors and metadata.

### Conformance

- Validates that the release workflow can build the Spec artifact and dispatch runtime/tool upgrades.
- Validates that runtime/tool repositories can regenerate artifacts from the released Spec tag.

### Migration

- No migration content changes from `spec/v0.0.1`.
- Reuses the current legacy classification and migration planning material.

### Runtime Impact

- Exercises the automatic `spec/v0.0.2` to runtime/tool `v0.0.2` synchronization path.
- Expected runtime/tool behavior is automated upgrade PR creation, generated manifest refresh, auto-merge after checks, `v0.0.2` tag creation, and GitHub Release creation.
- No npm, pub, PyPI, Docker, or runtime package registry publish is part of this Spec release.

## spec/v0.0.1

Initial tagged AXTP Spec release from the current repository snapshot.

### Protocol

- Publishes the current AXTP protocol specs as the first immutable Spec tag.
- Establishes AXTP v1 core wire documentation, transport profiles, RPC/CONTROL/STREAM specs, and compatibility/versioning guidance as the baseline documentation set.

### Registry

- Publishes current registry facts for core protocol metadata, RPC operations and encodings, control opcodes, errors, schemas, capabilities, profiles, and adopted domain registry entries.
- Keeps generated protocol facts sourced from `registry/**/*.yaml` and `registry/domains/**/*.yaml`.

### Schemas

- Publishes current generated schema descriptors and schema metadata for adopted AXTP methods, events, capabilities, and shared types.
- Keeps generated protocol outputs as machine-consumable artifacts derived from the YAML source facts.

### Conformance

- Publishes current generator tests, generated snapshots, and tooling test vectors as the baseline conformance material.
- Includes current C++/TypeScript/Flutter runtime generated references present in the repository snapshot.

### Migration

- Publishes current legacy classification and migration planning material for AXDP HID, Rooms, VM33, signage, firmware, and other legacy protocol mapping work.
- Keeps legacy compatibility behavior outside AXTP Core by documenting adapter and migration boundaries.

### Runtime Impact

- Establishes `spec/v0.0.1` as the first fixed AXTP Spec dependency target for runtime repositories.
- Runtime packages should record this tag through `AXTP_SPEC.lock.yaml` or package metadata instead of depending on `main`.
- No runtime package release is created by this Spec release.
