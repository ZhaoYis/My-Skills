#!/usr/bin/env bash
# Phase 1: 获取某制品模板 instructions；artifact 省略时用 status 中第一件 ready 制品（openspec CLI 常要求显式 artifact）。
# Phase 2: 对 apply 使用 opsx-instructions-apply.sh 更便捷。
set -euo pipefail
change="${1:?用法: $0 <change-name> [artifact-id]}"
artifact="${2:-}"
if [[ -z "$artifact" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "省略 artifact 时需要 python3 解析 openspec status；请安装 python3 或显式传入 artifact-id" >&2
    exit 1
  fi
  artifact="$(openspec status --change "$change" --json | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(2)
for a in d.get("artifacts") or []:
    if a.get("status") == "ready" and a.get("id"):
        print(a["id"], end="")
        sys.exit(0)
print("opsx-instructions: 没有 status 为 ready 的制品，请显式传入 artifact-id", file=sys.stderr)
sys.exit(1)
')"
fi
exec openspec instructions "$artifact" --change "$change" --json
