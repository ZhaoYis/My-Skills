#!/usr/bin/env bash
# Phase 1: create a new change directory (openspec CLI).
set -euo pipefail
name="${1:?usage: $0 <change-name>}"
shift
exec openspec new change "$name" "$@"
