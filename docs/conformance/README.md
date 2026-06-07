# AXTP Conformance

AXTP conformance cases are maintained under `docs/conformance/` as part of the
protocol source of truth. Runtime and tool repositories must not redefine these
cases; they should load this directory and execute the cases that match their
declared runtime profile.

## Layout

- `manifest.yaml` declares conformance levels and the cases required by each
  level.
- `schemas/` contains the case and result JSON schemas.
- `profiles/` describes profile-level expectations.
- `fixtures/` contains device profiles used by protocol behavior cases.
- `cases/` contains YAML case descriptions.

## Validate

```bash
pnpm --dir generators install --frozen-lockfile
pnpm --dir generators build
scripts/validate-conformance.sh
```

Runtime repositories should point `AXTP_SPEC_PATH` at this repository or at a
released AXTP spec artifact. Source checkouts use `docs/conformance/`; release
artifacts may expose the same content as a top-level `conformance/` directory
for compatibility.

Runtime teams implementing Phase 1 should start from
`docs/guides/runtime-mvp-conformance.md` before declaring supported conformance
levels.

QA and conformance owners should start from
`docs/guides/testing-conformance-quickstart.md` to decide which levels to run
and how to classify failures.
