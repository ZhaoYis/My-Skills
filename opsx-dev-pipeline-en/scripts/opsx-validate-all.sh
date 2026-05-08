#!/usr/bin/env bash
# CI / bulk: validate all changes and specs. May pass e.g. --strict.
set -euo pipefail
exec openspec validate --all --json --no-interactive "$@"
