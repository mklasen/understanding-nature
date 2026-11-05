#!/usr/bin/env bash
# Re-sync site/orbits from the latest COMMIT of ~/projects/understanding-orbits
# (committed state only — never a half-edited working tree).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../understanding-orbits"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
git -C "$src" archive HEAD site | tar -x -C "$tmp"
keep=("$here/site/orbits/card.jpg" "$here/site/orbits/og.jpg")
for f in "${keep[@]}"; do [ -f "$f" ] && cp "$f" "$tmp/$(basename "$f").keep"; done
python3 "$here/tools/port-explainer.py" orbits "$tmp/site" space --css-marker "/* ---------- orbits additions ---------- */"
for f in "${keep[@]}"; do [ -f "$tmp/$(basename "$f").keep" ] && [ ! -f "$tmp/site/$(basename "$f")" ] && cp "$tmp/$(basename "$f").keep" "$f"; done
echo "orbits synced from $(git -C "$src" rev-parse --short HEAD)"
