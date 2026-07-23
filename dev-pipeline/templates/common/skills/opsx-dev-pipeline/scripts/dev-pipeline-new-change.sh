#!/usr/bin/env bash
# Phase1: 创建新 change 目录（openspec CLI 标准子命令）。
set -euo pipefail
name="${1:?用法: $0 <change-name>}"
shift
exec openspec new change "$name" "$@"
