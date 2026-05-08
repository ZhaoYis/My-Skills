#!/usr/bin/env bash
# Phase 0: openspec + git 仓库预检。成功 stdout 打印 ok；失败 stderr 说明原因。
set -euo pipefail

if ! command -v openspec >/dev/null 2>&1; then
  echo "openspec CLI 未找到（请安装 @fission-ai/openspec 并确保 PATH 可用）" >&2
  exit 1
fi
if ! openspec --version >/dev/null 2>&1; then
  echo "openspec --version 执行失败" >&2
  exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不在 git 仓库内（请先 cd 到项目根或执行 git init）" >&2
  exit 2
fi

echo "ok"
exit 0
