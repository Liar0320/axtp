# AXTP Spec Generator

This generator is owned by the AXTP spec repository.

It generates spec repository artifacts only:

- `protocol/axtp.protocol.yaml`
- `docs/generated/*`
- `tooling/mcp/*.generated.json`
- `tooling/test-vectors/*`

Runtime repositories maintain their own generators for runtime-specific outputs.

```bash
pnpm --dir generators install
pnpm --dir generators build
pnpm --dir generators test
pnpm --dir generators validate:sources
pnpm --dir generators generate
pnpm --dir generators validate:protocol
```
