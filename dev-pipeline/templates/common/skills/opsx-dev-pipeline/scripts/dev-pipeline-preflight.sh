#!/usr/bin/env bash
# Phase0: OpenSpec + Git 仓库预检，成功和失败均在 stdout 输出单个 JSON。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev-pipeline-lib.sh
source "$SCRIPT_DIR/dev-pipeline-lib.sh"

require_command openspec "openspec-cli-not-found" "install-openspec"
require_command node "node-cli-not-found" "install-node"
cd_repo_root

set +e
openspec_version="$(openspec --version 2>&1)"
version_exit=$?
set -e
if [[ $version_exit -ne 0 ]]; then
  emit_error \
    "openspec-version-failed" \
    "openspec --version 执行失败（exit $version_exit）：$openspec_version" \
    "check-openspec-install" \
    "$EXIT_DEPENDENCY_MISSING"
fi

if [[ ! -f "openspec/config.yaml" ]]; then
  emit_error \
    "openspec-not-initialized" \
    "仓库根目录缺少 openspec/config.yaml" \
    "run-openspec-init" \
    "$EXIT_OPENSPEC_NOT_INITIALIZED"
fi

# --- git 用户配置（提交时需要）---
warnings=()
if ! git config user.name >/dev/null 2>&1; then
  warnings+=("git-config-user-name-missing")
fi
if ! git config user.email >/dev/null 2>&1; then
  warnings+=("git-config-user-email-missing")
fi

set +e
list_json="$(openspec list --json 2>&1)"
list_exit=$?
set -e
if [[ $list_exit -ne 0 ]]; then
  emit_error \
    "openspec-list-failed" \
    "openspec list --json 执行失败（exit $list_exit）：$list_json" \
    "check-openspec-config" \
    "$EXIT_COMMAND_FAILED"
fi

set +e
root_source="$(printf '%s' "$list_json" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input);
    if (!payload.root || typeof payload.root.source !== "string") process.exit(2);
    process.stdout.write(payload.root.source);
  } catch {
    process.exit(2);
  }
});
')"
parse_exit=$?
set -e
if [[ $parse_exit -ne 0 ]]; then
  emit_error \
    "openspec-list-json-invalid" \
    "无法解析 openspec list --json 的 root.source" \
    "check-openspec-output" \
    "$EXIT_INVALID_OUTPUT"
fi
if [[ "$root_source" == "implicit" ]]; then
  emit_error \
    "openspec-not-initialized" \
    "OpenSpec 返回 implicit 根，请先在仓库中执行 openspec init" \
    "run-openspec-init" \
    "$EXIT_OPENSPEC_NOT_INITIALIZED"
fi

if [[ ${#warnings[@]} -gt 0 ]]; then
  warning_json=""
  for warning in "${warnings[@]}"; do
    [[ -n "$warning_json" ]] && warning_json+=","
    warning_json+="\"$(json_escape "$warning")\""
  done
  printf '{"status":"ok","reason":"preflight-passed-with-warnings","nextAction":"continue-phase-0","warnings":[%s],"openspecVersion":"%s","rootSource":"%s"}\n' \
    "$warning_json" "$(json_escape "$openspec_version")" "$(json_escape "$root_source")"
else
  printf '{"status":"ok","reason":"preflight-passed","nextAction":"continue-phase-0","warnings":[],"openspecVersion":"%s","rootSource":"%s"}\n' \
    "$(json_escape "$openspec_version")" "$(json_escape "$root_source")"
fi
