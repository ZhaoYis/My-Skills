#!/usr/bin/env bash
# Phase 0: openspec + git repo preflight. Prints "ok" on success; errors to stderr.
set -euo pipefail

if ! command -v openspec >/dev/null 2>&1; then
  echo "openspec CLI not found (install @fission-ai/openspec and ensure it is on PATH)" >&2
  exit 1
fi
if ! openspec --version >/dev/null 2>&1; then
  echo "openspec --version failed" >&2
  exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not inside a git repository (cd to repo root or run git init)" >&2
  exit 2
fi

echo "ok"
exit 0
