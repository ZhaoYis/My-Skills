#!/usr/bin/env bash
# Phase1: 获取某制品模板 instructions；artifact 省略时用 status 中第一件 ready 制品（openspec CLI 常要求显式 artifact）。
# Phase2: 对 apply 使用 dev-pipeline-instructions-apply.sh 更便捷。
set -euo pipefail
change="${1:?用法: $0 <change-name> [artifact-id]}"
artifact="${2:-}"
if [[ -z "$artifact" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo '{"status":"error","reason":"python3-missing","detail":"省略 artifact 时需要 python3 解析 openspec status；请安装 python3 或显式传入 artifact-id","nextAction":"install-python3-or-pass-artifact"}' >&2
    exit 1
  fi
  # 带超时获取 status，python3 解析第一件 ready 制品
  # 区分 3 种错误：openspec 命令失败、JSON 解析失败、无 ready 制品
  set +e
  status_json="$(openspec status --change "$change" --json 2>/dev/null)"
  openspec_exit=$?
  set -e
  if [[ $openspec_exit -ne 0 ]]; then
    echo '{"status":"error","reason":"openspec-status-failed","detail":"openspec status --change '"$change"' --json 执行失败（exit '"$openspec_exit"'）","nextAction":"check-openspec-install-or-change-name"}' >&2
    exit 2
  fi
  if [[ -z "$status_json" ]]; then
    echo '{"status":"error","reason":"openspec-status-empty","detail":"openspec status 返回空输出","nextAction":"check-change-exists"}' >&2
    exit 2
  fi
  artifact="$(echo "$status_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print("JSON_DECODE_ERROR", file=sys.stderr)
    sys.exit(2)
artifacts = d.get("artifacts") or []
for a in artifacts:
    if a.get("status") == "ready" and a.get("id"):
        print(a["id"], end="")
        sys.exit(0)
# No ready artifact — print structured error and exit 3
print("NO_READY_ARTIFACT", file=sys.stderr)
sys.exit(3)
' 2>&1)"
  py_exit=$?
  if [[ $py_exit -eq 2 ]]; then
    echo '{"status":"error","reason":"openspec-status-json-parse-failed","detail":"无法解析 openspec status 输出的 JSON","nextAction":"check-openspec-output"}' >&2
    exit 2
  elif [[ $py_exit -eq 3 ]]; then
    echo '{"status":"error","reason":"no-ready-artifact","detail":"没有 status 为 ready 的制品，请显式传入 artifact-id","nextAction":"pass-artifact-id"}' >&2
    exit 1
  fi
fi
exec openspec instructions "$artifact" --change "$change" --json
