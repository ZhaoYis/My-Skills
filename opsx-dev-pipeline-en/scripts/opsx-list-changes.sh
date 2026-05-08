#!/usr/bin/env bash
# List changes as JSON by default. Pass extra flags for openspec list (e.g. --specs).
set -euo pipefail
exec openspec list --json "$@"
