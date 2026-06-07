#!/usr/bin/env bash
set -euo pipefail

change="${1:?用法: $0 <change-name>}"

python3 - "$change" <<'PY'
import json
import sys
from pathlib import Path

change = sys.argv[1]
root = Path.cwd()
config_path = root / "openspec" / "config.yaml"
meta_path = root / "openspec" / "changes" / change / ".openspec.yaml"

schema = "default"
if config_path.exists():
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("schema:"):
            schema = stripped.split(":", 1)[1].strip() or "default"
            break

stacks = []
if meta_path.exists():
    for line in meta_path.read_text(encoding="utf-8").splitlines():
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

command = None
if schema != "default" and schema != "spec-driven":
    # 处理自定义 schema 的验证命令
    # 读取 change 元数据以获取 stacks 或其他相关信息
    normalized = set(stacks)
    if normalized == {"backend"}:
        command = "./scripts/validate.sh backend"
    elif normalized == {"frontend"}:
        command = "./scripts/validate.sh frontend"
    elif normalized == {"backend", "frontend"}:
        if (root / "Makefile").exists():
            command = "make validate"
        else:
            command = "./scripts/validate.sh all"
    # 可根据需要添加更多自定义 schema 的处理逻辑

print(json.dumps({
    "status": "ok" if command else "warning",
    "reason": "verify-command-resolved" if command else "verify-command-missing",
    "nextAction": "run-verify-command" if command else "confirm-verify-command-manually",
    "schema": schema,
    "stacks": stacks,
    "command": command,
}, ensure_ascii=False))
PY
