#!/usr/bin/env bash
# Phase1: 创建新 change 目录（openspec CLI 标准子命令）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
name="${1:-}"
require_argument "change-name" "$name"
shift
validate_change_name "$name"
prepare_openspec_repo
run_json_command \
  "openspec-new-change-failed" \
  "choose-another-change-name" \
  openspec new change "$name" --json "$@"
