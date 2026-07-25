#!/usr/bin/env bash
# 归档前或门禁：校验单个 change；默认 JSON + 非交互。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
name="${1:-}"
require_argument "change-name" "$name"
shift
validate_change_name "$name"
prepare_openspec_repo
# openspec 1.x：按 change 名校验需明确 --type change，否则报 Unknown item
run_json_command \
  "openspec-validate-change-failed" \
  "fix-change-artifacts" \
  openspec validate "$name" --type change --json --no-interactive "$@"
