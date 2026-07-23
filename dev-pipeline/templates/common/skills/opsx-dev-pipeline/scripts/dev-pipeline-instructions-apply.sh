#!/usr/bin/env bash
# Phase2: 获取 apply 上下文（等价 openspec instructions apply --change --json）。
set -euo pipefail
change="${1:?用法: $0 <change-name>}"
exec openspec instructions apply --change "$change" --json
