#!/usr/bin/env bash
# CI / 批量：校验所有 changes 与 specs。可追加 --strict 等。
set -euo pipefail
exec openspec validate --all --json --no-interactive "$@"
