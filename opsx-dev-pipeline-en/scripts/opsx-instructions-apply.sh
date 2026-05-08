#!/usr/bin/env bash
# Phase 2: apply task instructions (openspec instructions apply --change --json).
set -euo pipefail
change="${1:?usage: $0 <change-name>}"
exec openspec instructions apply --change "$change" --json
