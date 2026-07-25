#!/usr/bin/env bash
# 列出 changes（默认 JSON）。可追加 openspec list 的其它参数，如 --specs。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/dev-pipeline-lib.sh"
prepare_openspec_repo
run_json_command "openspec-list-failed" "check-openspec-config" openspec list --json "$@"
