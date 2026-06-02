# AXTP Legacy Migration Matrix

`AXTP_Legacy_Migration_Matrix.xlsx` is the working migration matrix for mapping legacy protocols to AXTP.

- Each legacy protocol source has its own worksheet so reviewers can trace every row back to the original document.
- The main mapping sheets are simplified review tables. Use `AXTP Domain / 域` and `Feature / 业务对象` together to filter similar legacy rows.
- `Capability / Domain.Feature` is the capability candidate ID and must equal `domain.feature`; Excel does not allocate numeric IDs.
- Use `93_Feature分类参考` as the shared catalog from `docs/specs/21-AXTP-Capability-Naming-and-Feature-Taxonomy.md`.
- After review, confirmed protocol facts should be added to `registry/**/*.yaml`; the Excel file is not the final protocol source of truth.
- Do not manually edit files under `docs/generated/`, `docs/migration/generated/`, or runtime generated headers.
- Legacy-only compatibility behavior must stay in the legacy adapter layer and must not pollute AXTP Core.
