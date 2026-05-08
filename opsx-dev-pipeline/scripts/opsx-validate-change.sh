#!/usr/bin/env bash
# 归档前或门禁：校验单个 change；默认 JSON + 非交互。
set -euo pipefail
name="${1:?用法: $0 <change-name> [额外 openspec validate 参数...]}"
shift
# openspec 1.x：按 change 名校验需明确 --type change，否则报 Unknown item
exec openspec validate "$name" --type change --json --no-interactive "$@"
