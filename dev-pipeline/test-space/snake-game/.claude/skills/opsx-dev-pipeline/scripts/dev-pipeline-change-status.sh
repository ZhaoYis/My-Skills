#!/usr/bin/env bash
# Phase0 / 1 / 4: 输出指定 change 的制品进度 JSON（等价 openspec status --change --json）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
name="${1:-}"
require_argument "change-name" "$name"
validate_change_name "$name"
prepare_openspec_repo
run_json_command "openspec-status-failed" "check-change-name" openspec status --change "$name" --json
