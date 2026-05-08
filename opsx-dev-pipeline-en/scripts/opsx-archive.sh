#!/usr/bin/env bash
# Phase 4: official archive (validate, merge deltas into main specs, move to archive/).
# Pass through openspec archive flags, e.g. -y, --skip-specs.
set -euo pipefail
name="${1:?usage: $0 <change-name> [openspec archive options, e.g. -y --skip-specs]}"
shift
exec openspec archive "$name" "$@"
