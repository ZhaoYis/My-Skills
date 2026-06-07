#!/usr/bin/env bash
set -euo pipefail

change="${1:-}"

python3 - "$change" <<'PY'
import json
import sys
from pathlib import Path

change = sys.argv[1]
root = Path.cwd()
config_path = root / "openspec" / "config.yaml"
schema = None
supports_stacks = False
change_has_openspec_yaml = False
stacks = []

if config_path.exists():
    text = config_path.read_text(encoding="utf-8")
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("schema:"):
            schema = stripped.split(":", 1)[1].strip()
            break
    # 保留对 stacks 支持的检测，但不针对特定 schema
    if schema and schema != "spec-driven":
        supports_stacks = True

if change:
    meta = root / "openspec" / "changes" / change / ".openspec.yaml"
    if not meta.exists():
        archive_root = root / "openspec" / "changes" / "archive"
        if archive_root.exists():
            matches = sorted(archive_root.glob(f"*-{change}/.openspec.yaml"))
            if matches:
                meta = matches[-1]
    if meta.exists():
        change_has_openspec_yaml = True
        text = meta.read_text(encoding="utf-8")
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("stacks:"):
                value = stripped.split(":", 1)[1].strip()
                if value.startswith("[") and value.endswith("]"):
                    inner = value[1:-1].strip()
                    if inner:
                        stacks = [item.strip() for item in inner.split(",") if item.strip()]
                elif value:
                    stacks = [value]
                break

print(json.dumps({
    "status": "ok",
    "reason": "schema-detected",
    "nextAction": "continue-with-detected-schema",
    "schema": schema or "spec-driven",
    "hasConfigYaml": config_path.exists(),
    "supportsStacks": supports_stacks,
    "changeHasOpenSpecYaml": change_has_openspec_yaml,
    "stacks": stacks,
}, ensure_ascii=False))
PY
