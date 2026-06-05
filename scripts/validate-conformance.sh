#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$root/generators/node_modules" ]]; then
  echo "Missing generators/node_modules. Run: pnpm --dir generators install --frozen-lockfile" >&2
  exit 1
fi

node "$root/scripts/validate-conformance.mjs" "$root"
