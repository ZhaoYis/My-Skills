#!/usr/bin/env bash
# Phase 1: enriched instructions; omit artifact to use first ready artifact from openspec status (CLI often requires an explicit artifact id).
# Phase 2: use opsx-instructions-apply.sh for apply context.
set -euo pipefail
change="${1:?usage: $0 <change-name> [artifact-id]}"
artifact="${2:-}"
if [[ -z "$artifact" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to resolve the next ready artifact; install python3 or pass artifact-id" >&2
    exit 1
  fi
  artifact="$(openspec status --change "$change" --json | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(2)
for a in d.get("artifacts") or []:
    if a.get("status") == "ready" and a.get("id"):
        print(a["id"], end="")
        sys.exit(0)
print("opsx-instructions: no ready artifact; pass artifact-id explicitly", file=sys.stderr)
sys.exit(1)
')"
fi
exec openspec instructions "$artifact" --change "$change" --json
