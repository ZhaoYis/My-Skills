#!/usr/bin/env bash
# Phase5: 官方归档（校验、合并 delta 到主 specs、移动到 archive）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
name="${1:-}"
require_argument "change-name" "$name"
shift
validate_change_name "$name"
prepare_openspec_repo
run_json_command \
  "openspec-archive-failed" \
  "fix-validation-or-pending-tasks" \
  openspec archive "$name" --json "$@"
