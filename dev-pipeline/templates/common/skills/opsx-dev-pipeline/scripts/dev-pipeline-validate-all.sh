#!/usr/bin/env bash
# CI / 批量：校验所有 changes 与 specs。可追加 --strict 等。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
prepare_openspec_repo
run_json_command \
  "openspec-validate-all-failed" \
  "fix-validation-errors" \
  openspec validate --all --json --no-interactive "$@"
