#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <input.obj> <output.glb>"
  exit 1
fi

INPUT_OBJ="$1"
OUTPUT_GLB="$2"
TMP_GLTF="$(mktemp /tmp/threat-vector-obj2gltf-XXXXXX.gltf)"

if ! command -v obj2gltf >/dev/null 2>&1; then
  echo "Missing dependency: obj2gltf"
  echo "Install: npm i -g obj2gltf"
  exit 1
fi

obj2gltf -i "$INPUT_OBJ" -o "$TMP_GLTF"

if command -v gltf-transform >/dev/null 2>&1; then
  gltf-transform optimize "$TMP_GLTF" "$OUTPUT_GLB"
else
  echo "gltf-transform not found; writing unoptimized GLB."
  if ! command -v gltf-pipeline >/dev/null 2>&1; then
    echo "Missing optional dependency: gltf-pipeline"
    echo "Install either gltf-transform or gltf-pipeline."
    exit 1
  fi
  gltf-pipeline -i "$TMP_GLTF" -o "$OUTPUT_GLB" -b
fi

echo "Wrote $OUTPUT_GLB"

