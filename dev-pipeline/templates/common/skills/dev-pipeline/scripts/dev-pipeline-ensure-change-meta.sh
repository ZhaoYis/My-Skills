#!/usr/bin/env bash
set -euo pipefail

change="${1:?用法: $0 <change-name> [backend|frontend|backend,frontend] }"
stacks="${2:-}"
meta_dir="openspec/changes/${change}"
meta_path="${meta_dir}/.openspec.yaml"

mkdir -p "$meta_dir"

if [[ -f "$meta_path" ]]; then
  if [[ -z "$stacks" ]]; then
    cat "$meta_path"
    exit 0
  fi
else
  : > "$meta_path"
fi

if [[ -z "$stacks" ]]; then
  cat "$meta_path"
  exit 0
fi

python3 - "$meta_path" "$stacks" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
raw = sys.argv[2]
items = [part.strip() for part in raw.split(",") if part.strip()]
content = path.read_text(encoding="utf-8") if path.exists() else ""
lines = content.splitlines()
new_line = f"stacks: [{', '.join(items)}]"
replaced = False
out = []
for line in lines:
    if line.strip().startswith("stacks:"):
        out.append(new_line)
        replaced = True
    else:
        out.append(line)
if not replaced:
    if out and out[-1] != "":
        out.append("")
    out.append(new_line)
path.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
print(path.read_text(encoding="utf-8"), end="")
PY
