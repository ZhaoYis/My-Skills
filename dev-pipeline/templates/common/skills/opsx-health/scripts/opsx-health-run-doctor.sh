#!/usr/bin/env bash
# Run opsx-dev-pipeline doctor --json with CLI resolution fallbacks (global / node_modules / npx).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
resolve_cli="$script_dir/../../opsx-dev-pipeline/scripts/dev-pipeline-resolve-cli.sh"

if [ ! -f "$resolve_cli" ]; then
  echo "opsx-dev-pipeline CLI resolver not found at $resolve_cli" >&2
  echo "Install globally: npm install -g opsx-dev-pipeline" >&2
  echo "Or run without install: npx opsx-dev-pipeline doctor --json" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$resolve_cli"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  repo_root="$(git rev-parse --show-toplevel)"
else
  repo_root="$(pwd)"
fi

# Optional repo override: opsx-health-run-doctor.sh [/path/to/repo] [--history] [--stale-days N]
if [ -n "${1:-}" ] && [ "${1:0:1}" != "-" ] && [ -d "$1" ]; then
  repo_root="$1"
  shift
fi

if ! opsx_run_doctor_json "$repo_root" "$@"; then
  echo "Unable to resolve opsx-dev-pipeline CLI (tried: global PATH, node_modules/.bin, npx)." >&2
  echo "Requires Node.js with npx, or: npm install -g opsx-dev-pipeline" >&2
  exit 1
fi
