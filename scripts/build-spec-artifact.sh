#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 MAJOR.MINOR.PATCH" >&2
  exit 2
fi

version="$1"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Expected version format MAJOR.MINOR.PATCH, for example 0.3.0" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template="$root/release/manifest.template.yaml"
artifact_name="axtp-spec-v$version"
dist_dir="$root/dist"
artifact_dir="$dist_dir/$artifact_name"
zip_path="$dist_dir/$artifact_name.zip"
commit="$(git -C "$root" rev-parse HEAD)"
released_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ! -f "$template" ]]; then
  echo "Missing manifest template: $template" >&2
  exit 1
fi

rm -rf "$artifact_dir" "$zip_path"
mkdir -p "$artifact_dir"

copy_dir() {
  local src="$1"
  local dest="$2"
  local label="$3"
  if [[ -d "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp -R "$src" "$dest"
    echo "[OK] copied $label"
  else
    echo "[SKIP] missing $label: $src"
  fi
}

copy_file() {
  local src="$1"
  local dest="$2"
  local label="$3"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "[OK] copied $label"
  else
    echo "[SKIP] missing $label: $src"
  fi
}

copy_dir "$root/docs/specs" "$artifact_dir/specs" "specs"
copy_dir "$root/registry" "$artifact_dir/registry" "registry"
copy_dir "$root/schemas" "$artifact_dir/schemas" "schemas"
copy_dir "$root/conformance" "$artifact_dir/conformance" "conformance"
copy_dir "$root/docs/migration" "$artifact_dir/migration" "migration"
copy_file "$root/CHANGELOG.md" "$artifact_dir/CHANGELOG.md" "CHANGELOG.md"

sed \
  -e "s|{{VERSION}}|$version|g" \
  -e "s|{{COMMIT}}|$commit|g" \
  -e "s|{{DATE}}|$released_at|g" \
  -e "s|{{WIRE_COMPATIBILITY}}|review|g" \
  -e "s|{{REGISTRY_COMPATIBILITY}}|review|g" \
  -e "s|{{SCHEMA_COMPATIBILITY}}|review|g" \
  -e "s|{{RUNTIME_ACTION}}|open runtime upgrade PRs|g" \
  "$template" > "$artifact_dir/manifest.yaml"
echo "[OK] wrote manifest.yaml"

mkdir -p "$dist_dir"
if command -v zip >/dev/null 2>&1; then
  (cd "$dist_dir" && zip -qr "$artifact_name.zip" "$artifact_name")
elif command -v python3 >/dev/null 2>&1; then
  (cd "$dist_dir" && python3 -m zipfile -c "$artifact_name.zip" "$artifact_name")
else
  echo "Need zip or python3 to create $zip_path" >&2
  exit 1
fi

echo "[OK] built artifact: $artifact_dir"
echo "[OK] built archive: $zip_path"
