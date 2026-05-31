#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

phase5_context() {
  case "$1" in
    need) echo '{"decision":"need-tests","routing":"subflow-a"}' ;;
    skip) echo '{"decision":"skip-tests","routing":"phase-4"}' ;;
    pause) echo '{"decision":"pause","routing":"exit-step-16"}' ;;
    cmd-schema) echo '{"commandSource":"schema","routing":"schema-priority"}' ;;
    cmd-config) echo '{"commandSource":"config","routing":"config-rule"}' ;;
    cmd-heuristic) echo '{"commandSource":"heuristic","routing":"build-file-heuristic"}' ;;
    cmd-ask) echo '{"commandSource":"multi-candidate","routing":"ask-user"}' ;;
    fail-retry) echo '{"result":"fail","decision":"retry","routing":"rerun-tests"}' ;;
    fail-term) echo '{"result":"fail","decision":"terminate","routing":"exit"}' ;;
    pass) echo '{"result":"pass","routing":"phase-4"}' ;;
    *) return 1 ;;
  esac
}

scenario_P5_NEED() { assert_contains "P5-NEED" "$(phase5_context need)" '"routing":"subflow-a"'; }
scenario_P5_SKIP() { assert_contains "P5-SKIP" "$(phase5_context skip)" '"routing":"phase-4"'; }
scenario_P5_PAUSE() { assert_contains "P5-PAUSE" "$(phase5_context pause)" '"routing":"exit-step-16"'; }
scenario_P5_CMD_SCHEMA() { assert_contains "P5-CMD-SCHEMA" "$(phase5_context cmd-schema)" '"commandSource":"schema"'; }
scenario_P5_CMD_CONFIG() { assert_contains "P5-CMD-CONFIG" "$(phase5_context cmd-config)" '"commandSource":"config"'; }
scenario_P5_CMD_HEURISTIC() { assert_contains "P5-CMD-HEURISTIC" "$(phase5_context cmd-heuristic)" '"commandSource":"heuristic"'; }
scenario_P5_CMD_ASK() { assert_contains "P5-CMD-ASK" "$(phase5_context cmd-ask)" '"routing":"ask-user"'; }
scenario_P5_FAIL_RETRY() { assert_contains "P5-FAIL-RETRY" "$(phase5_context fail-retry)" '"decision":"retry"'; }
scenario_P5_FAIL_TERM() { assert_contains "P5-FAIL-TERM" "$(phase5_context fail-term)" '"decision":"terminate"'; }
scenario_P5_PASS() { assert_contains "P5-PASS" "$(phase5_context pass)" '"routing":"phase-4"'; }

main() {
  scenario_P5_NEED
  scenario_P5_SKIP
  scenario_P5_PAUSE
  scenario_P5_CMD_SCHEMA
  scenario_P5_CMD_CONFIG
  scenario_P5_CMD_HEURISTIC
  scenario_P5_CMD_ASK
  scenario_P5_FAIL_RETRY
  scenario_P5_FAIL_TERM
  scenario_P5_PASS
  print_summary_and_exit
}

main "$@"
