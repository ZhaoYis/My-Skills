#!/usr/bin/env bash
# 列出 changes（默认 JSON）。可追加 openspec list 的其它参数，如 --specs。
set -euo pipefail
exec openspec list --json "$@"
