#!/usr/bin/env bash
# Gate / pre-archive: validate one change; JSON + non-interactive by default.
set -euo pipefail
name="${1:?usage: $0 <change-name> [extra openspec validate args...]}"
shift
# openspec 1.x: item-name alone is ambiguous; require change type
exec openspec validate "$name" --type change --json --no-interactive "$@"
