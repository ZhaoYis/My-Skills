#!/usr/bin/env bash
# Phase 0 / 1 / 4: 输出指定 change 的制品进度 JSON（等价 openspec status --change --json）。
set -euo pipefail
name="${1:?用法: $0 <change-name>}"
exec openspec status --change "$name" --json
