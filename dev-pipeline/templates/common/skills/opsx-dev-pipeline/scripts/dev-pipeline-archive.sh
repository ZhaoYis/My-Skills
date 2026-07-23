#!/usr/bin/env bash
# Phase4: 官方归档（校验、合并 delta 到主 specs、移动到 archive）。传递 openspec archive 的额外参数，如 -y、--skip-specs。
set -euo pipefail
name="${1:?用法: $0 <change-name> [openspec archive 选项，如 -y --skip-specs]}"
shift
exec openspec archive "$name" "$@"
