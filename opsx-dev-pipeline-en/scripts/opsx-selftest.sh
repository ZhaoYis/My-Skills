#!/usr/bin/env bash
# Runs every opsx-*.sh in this directory (except this file) against a temp git + OpenSpec repo.
# Requires: git, openspec, python3 (same as opsx-instructions.sh when artifact is omitted).
# Optional: KEEP_TMP=1 prints temp dir path on success (does not delete it).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF_BASENAME="opsx-selftest.sh"
CHANGE_NAME="opsx-selftest-change"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "opsx-selftest: missing command: $1" >&2
    exit 99
  }
}

need_cmd git
need_cmd openspec
need_cmd python3

TMP="$(mktemp -d)"
cleanup() {
  if [[ -n "${KEEP_TMP:-}" ]]; then
    echo "opsx-selftest: keeping temp dir: $TMP" >&2
  else
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT

cd "$TMP"
git init -q
git config user.email "opsx-selftest@local"
git config user.name "opsx-selftest"
openspec init . --tools none --force >/dev/null

write_valid_delta() {
  mkdir -p "openspec/changes/${CHANGE_NAME}/specs/demo"
  cat > "openspec/changes/${CHANGE_NAME}/specs/demo/spec.md" << 'SPECEOF'
## ADDED Requirements

### Requirement: Selftest delta

The change SHALL satisfy automated opsx-selftest validation.

#### Scenario: Validation passes

- **WHEN** opsx-selftest runs validate
- **THEN** the change is reported valid
SPECEOF
}

expect_ok() {
  local desc="$1"
  shift
  echo "== $desc =="
  if "$@"; then
    echo "   [ok] $desc"
  else
    echo "   [FAIL] $desc (exit $?)" >&2
    exit 1
  fi
}

expect_stdout_contains() {
  local desc="$1"
  local needle="$2"
  shift 2
  local out
  out="$("$@" 2>&1)" || {
    echo "$out" >&2
    echo "   [FAIL] $desc (command failed)" >&2
    exit 1
  }
  if [[ "$out" != *"$needle"* ]]; then
    echo "$out" >&2
    echo "   [FAIL] $desc (output missing: $needle)" >&2
    exit 1
  fi
  echo "   [ok] $desc"
}

expect_ok "opsx-new-change.sh" "${SCRIPT_DIR}/opsx-new-change.sh" "$CHANGE_NAME"
write_valid_delta

expect_stdout_contains "opsx-preflight.sh prints ok" "ok" "${SCRIPT_DIR}/opsx-preflight.sh"

expect_stdout_contains "opsx-list-changes.sh lists change" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh"

expect_stdout_contains "opsx-list-changes.sh passthrough --sort name" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh" --sort name

expect_stdout_contains "opsx-change-status.sh JSON" "\"changeName\"" "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh no artifact (ready)" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh proposal" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME" proposal

expect_stdout_contains "opsx-instructions-apply.sh" "\"changeName\"" "${SCRIPT_DIR}/opsx-instructions-apply.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-validate-change.sh pass" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-validate-change.sh passthrough --strict" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME" --strict

expect_stdout_contains "opsx-validate-all.sh JSON summary" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh"

expect_stdout_contains "opsx-validate-all.sh passthrough --strict" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh" --strict

expect_stdout_contains "opsx-archive.sh -y" "archived" "${SCRIPT_DIR}/opsx-archive.sh" "$CHANGE_NAME" -y

echo ""
echo "opsx-selftest: all passed (every opsx-*.sh except $SELF_BASENAME was exercised)."
