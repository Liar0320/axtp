# AXTP Spec Release Checklist

Use this checklist before creating an AXTP Spec tag and GitHub Release.

## Pre-Release Checks

1. Confirm `docs/specs/` protocol documents are updated.
2. Confirm `registry/` method, event, capability, error, profile, and shared registry files are updated.
3. Confirm schema source files and domain YAML schema definitions are updated.
4. Confirm generated protocol references, tooling JSON, test vectors, and runtime generated headers are refreshed when source facts changed.
5. Confirm conformance or test-vector material is updated for new or changed protocol behavior.
6. Confirm `docs/migration/` legacy mapping and migration notes are updated when legacy behavior changes.
7. Confirm `CHANGELOG.md` records the release under `spec/vX.Y.Z`.
8. Confirm `README.md` identifies AXTP Spec versioning and runtime dependency rules.
9. Confirm compatibility notes clearly state runtime impact.
10. Confirm `git diff --check` passes.

## Tag And Release

Create an annotated tag:

```bash
git tag -a spec/vX.Y.Z -m "AXTP Spec vX.Y.Z"
git push origin spec/vX.Y.Z
```

Create a GitHub Release named:

```text
AXTP Spec vX.Y.Z
```

The GitHub Release body should include:

- Protocol changes
- Registry changes
- Schema changes
- Conformance changes
- Migration changes
- Compatibility notes
- Runtime impact
- Links to `CHANGELOG.md` and relevant generated protocol docs

## Runtime Notification

After the release:

1. Notify `axtp-c-runtime` maintainers to update `AXTP_SPEC.lock.yaml`.
2. Notify `axtp-cpp-runtime` maintainers to update `AXTP_SPEC.lock.yaml`.
3. Notify `axtp-flutter-runtime` maintainers to update `AXTP_SPEC.lock.yaml`.
4. Notify `axtp-ts-runtime` maintainers to update `AXTP_SPEC.lock.yaml` and package metadata.
5. Notify `axtp-python-runtime` maintainers to update `AXTP_SPEC.lock.yaml`.
6. Notify `axtp-mock-server` maintainers to update `AXTP_SPEC.lock.yaml`.
6. Ask runtime and mock maintainers to record the tag, version, commit hash, compatibility range, and update date.
7. Do not ask runtimes to depend on `main`; every runtime dependency must point to a tag or commit.

## Non-Goals

- Do not create a runtime package release automatically from an AXTP Spec release.
- Do not force every runtime repository to use the same dependency mechanism.
- Do not publish an AXTP Spec tag until source facts and generated outputs are aligned.
