#!/usr/bin/env bash
# Phase1: 获取某制品模板 instructions；artifact 省略时用 status 中第一件 ready 制品（openspec CLI 常要求显式 artifact）。
# Phase2: 对 apply 使用 dev-pipeline-instructions-apply.sh 更便捷。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev-pipeline-lib.sh
source "$SCRIPT_DIR/dev-pipeline-lib.sh"

change="${1:-}"
artifact="${2:-}"
require_argument "change-name" "$change"
validate_change_name "$change"
prepare_openspec_repo

if [[ -z "$artifact" ]]; then
  require_command node "node-cli-not-found" "install-node-or-pass-artifact"
  set +e
  status_json="$(openspec status --change "$change" --json 2>&1)"
  openspec_exit=$?
  set -e
  if [[ $openspec_exit -ne 0 ]]; then
    emit_error \
      "openspec-status-failed" \
      "openspec status 执行失败（exit $openspec_exit）：$status_json" \
      "check-change-name" \
      "$EXIT_COMMAND_FAILED"
  fi
  if [[ -z "$status_json" ]]; then
    emit_error \
      "openspec-status-empty" \
      "openspec status 返回空输出" \
      "check-change-exists" \
      "$EXIT_INVALID_OUTPUT"
  fi

  set +e
  artifact="$(printf '%s' "$status_json" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input);
    const ready = (payload.artifacts || []).find(item => item.status === "ready" && item.id);
    if (!ready) process.exit(3);
    process.stdout.write(ready.id);
  } catch {
    process.exit(2);
  }
});
')"
  parse_exit=$?
  set -e
  if [[ $parse_exit -eq 2 ]]; then
    emit_error \
      "openspec-status-json-parse-failed" \
      "无法解析 openspec status 输出的 JSON" \
      "check-openspec-output" \
      "$EXIT_INVALID_OUTPUT"
  elif [[ $parse_exit -eq 3 ]]; then
    emit_error \
      "no-ready-artifact" \
      "没有 status 为 ready 的制品" \
      "pass-artifact-id" \
      "$EXIT_INVALID_INPUT"
  fi
fi
validate_identifier "artifact-id" "$artifact"
run_json_command \
  "openspec-instructions-failed" \
  "check-artifact-id" \
  openspec instructions "$artifact" --change "$change" --json
