#!/usr/bin/env bash
# Phase 0 / 1 / 4: artifact status JSON (openspec status --change --json).
set -euo pipefail
name="${1:?usage: $0 <change-name>}"
exec openspec status --change "$name" --json
