#!/usr/bin/env bash
# Phase2: 获取 apply 上下文（等价 openspec instructions apply --change --json）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
change="${1:-}"
require_argument "change-name" "$change"
validate_change_name "$change"
prepare_openspec_repo
run_json_command \
  "openspec-apply-instructions-failed" \
  "check-change-artifacts" \
  openspec instructions apply --change "$change" --json
