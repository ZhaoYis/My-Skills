#!/usr/bin/env bash
# Resolve opsx-dev-pipeline CLI with fallbacks when not globally installed.
# Resolution order: global PATH -> repo node_modules/.bin -> npx.
#
# Usage (source):
#   source dev-pipeline-resolve-cli.sh
#   opsx_resolve_cli "$repo_root" && "${OPSX_CLI[@]}" doctor --json --dir "$repo_root"
#
# Usage (doctor helper):
#   opsx_run_doctor_json "$repo_root" [--history] [--stale-days N]

opsx_resolve_cli() {
  local repo_root="${1:-$(pwd)}"
  OPSX_CLI=()
  OPSX_CLI_SOURCE=""

  if command -v opsx-dev-pipeline >/dev/null 2>&1; then
    OPSX_CLI=(opsx-dev-pipeline)
    OPSX_CLI_SOURCE="global"
    return 0
  fi

  local local_bin="$repo_root/node_modules/.bin/opsx-dev-pipeline"
  if [ -x "$local_bin" ]; then
    OPSX_CLI=("$local_bin")
    OPSX_CLI_SOURCE="node_modules"
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    if [ -n "${OPSX_DEV_PIPELINE_VERSION:-}" ]; then
      OPSX_CLI=(npx --yes -p "opsx-dev-pipeline@${OPSX_DEV_PIPELINE_VERSION}" opsx-dev-pipeline)
    else
      OPSX_CLI=(npx --yes opsx-dev-pipeline)
    fi
    OPSX_CLI_SOURCE="npx"
    return 0
  fi

  return 1
}

opsx_run_doctor_json() {
  local repo_root="$1"
  shift

  if ! opsx_resolve_cli "$repo_root"; then
    return 1
  fi

  "${OPSX_CLI[@]}" doctor --json --dir "$repo_root" "$@"
}
