# AXTP Runtime Update Flow

AXTP Spec releases are the source of truth for runtime, SDK, tooling, and mock
server updates. Runtime repositories must implement a released Spec tag or an
explicit commit; they must not track the AXTP `main` branch as a reproducible
build dependency.

## Release Contract

- AXTP Spec tags use `spec/vMAJOR.MINOR.PATCH`, for example `spec/v0.3.0`.
- The main AXTP repository publishes release artifacts with specs, registry
  facts, migration material, a changelog, and a manifest.
- Runtime repositories record their binding in `AXTP_SPEC.lock.yaml`.
- Runtime repositories expose `scripts/upgrade-axtp-spec.sh spec/vX.Y.Z` and
  `scripts/check-axtp-spec-lock.sh`.
- Runtime upgrades create pull requests for human review; they are not merged
  automatically.

## Mode A: Manual Dispatch

Early releases use a safe manual workflow:

1. AXTP maintainers publish `spec/vX.Y.Z`.
2. Runtime maintainers open each runtime repository.
3. They run the `upgrade-axtp-spec` workflow with `spec_tag=spec/vX.Y.Z`.
4. The workflow updates the lock file, regenerates runtime artifacts, runs
   available build/test/conformance checks, and opens a PR.
5. Maintainers review and merge the PR.
6. Runtime package releases happen independently after review.

## Mode B: Repository Dispatch

Later automation can use repository dispatch:

1. AXTP maintainers publish `spec/vX.Y.Z`.
2. The main repo `notify-runtimes` workflow sends `repository_dispatch` events
   to runtime repositories.
3. Runtime repositories run the same upgrade workflow automatically.
4. The workflow opens PRs.
5. Maintainers still review and merge PRs manually.

The initial main-repo notification workflow is intentionally dry-run only. It
prints the repositories and payload it would notify, but does not call the
GitHub API.

## Runtime Repositories

The real runtime and mock repositories are:

- `axtp-c-runtime`
- `axtp-cpp-runtime`
- `axtp-flutter-runtime`
- `axtp-ts-runtime`
- `axtp-python-runtime`
- `axtp-mock-server`

## Non-Goals

- Do not automatically merge runtime upgrade PRs.
- Do not publish npm, pub, or runtime GitHub releases from an AXTP Spec release.
- Do not make runtime repositories depend on AXTP `main`.
- Do not redefine specs, registry facts, schemas, or conformance material in
  runtime repositories.
