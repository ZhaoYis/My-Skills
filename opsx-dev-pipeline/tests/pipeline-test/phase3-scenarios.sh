#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

review_context() {
  case "$1" in
    no-diff) echo '{"routing":"phase-5","reason":"no-diff"}' ;;
    no-remote) echo '{"routing":"phase-5","reason":"no-remote"}' ;;
    severe-fix-cr) echo '{"severity":"severe","routing":"phase-3.1"}' ;;
    severe-direct-fix) echo '{"severity":"severe","routing":"phase-3-loop"}' ;;
    severe-pause) echo '{"severity":"severe","routing":"exit"}' ;;
    severe-ignore) echo '{"severity":"severe","routing":"phase-5"}' ;;
    severe-term) echo '{"severity":"severe","decision":"terminate"}' ;;
    minor-continue) echo '{"severity":"minor","routing":"phase-5"}' ;;
    minor-fix-cr) echo '{"severity":"minor","routing":"phase-3.1"}' ;;
    minor-pause) echo '{"severity":"minor","routing":"exit"}' ;;
    minor-term) echo '{"severity":"minor","decision":"terminate"}' ;;
    zero) echo '{"severity":"zero","routing":"phase-5"}' ;;
    direct-fix-limit) echo '{"loopCount":4,"routing":"forced-pause"}' ;;
    *) return 1 ;;
  esac
}

scenario_P3_NO_DIFF() { assert_contains "P3-NO-DIFF" "$(review_context no-diff)" '"reason":"no-diff"'; }
scenario_P3_NO_REMOTE() { assert_contains "P3-NO-REMOTE" "$(review_context no-remote)" '"reason":"no-remote"'; }
scenario_P3_SEVERE_FIX_CR() { assert_contains "P3-SEVERE-FIX-CR" "$(review_context severe-fix-cr)" '"routing":"phase-3.1"'; }
scenario_P3_SEVERE_DIRECT_FIX() { assert_contains "P3-SEVERE-DIRECT-FIX" "$(review_context severe-direct-fix)" '"routing":"phase-3-loop"'; }
scenario_P3_SEVERE_PAUSE() { assert_contains "P3-SEVERE-PAUSE" "$(review_context severe-pause)" '"routing":"exit"'; }
scenario_P3_SEVERE_IGNORE() { assert_contains "P3-SEVERE-IGNORE" "$(review_context severe-ignore)" '"routing":"phase-5"'; }
scenario_P3_SEVERE_TERM() { assert_contains "P3-SEVERE-TERM" "$(review_context severe-term)" '"decision":"terminate"'; }
scenario_P3_MINOR_CONTINUE() { assert_contains "P3-MINOR-CONTINUE" "$(review_context minor-continue)" '"routing":"phase-5"'; }
scenario_P3_MINOR_FIX_CR() { assert_contains "P3-MINOR-FIX-CR" "$(review_context minor-fix-cr)" '"routing":"phase-3.1"'; }
scenario_P3_MINOR_PAUSE() { assert_contains "P3-MINOR-PAUSE" "$(review_context minor-pause)" '"routing":"exit"'; }
scenario_P3_MINOR_TERM() { assert_contains "P3-MINOR-TERM" "$(review_context minor-term)" '"decision":"terminate"'; }
scenario_P3_ZERO() { assert_contains "P3-ZERO" "$(review_context zero)" '"severity":"zero"'; }
scenario_P3_DIRECT_FIX_LIMIT() { assert_contains "P3-DIRECT-FIX-LIMIT" "$(review_context direct-fix-limit)" '"routing":"forced-pause"'; }

main() {
  scenario_P3_NO_DIFF
  scenario_P3_NO_REMOTE
  scenario_P3_SEVERE_FIX_CR
  scenario_P3_SEVERE_DIRECT_FIX
  scenario_P3_SEVERE_PAUSE
  scenario_P3_SEVERE_IGNORE
  scenario_P3_SEVERE_TERM
  scenario_P3_MINOR_CONTINUE
  scenario_P3_MINOR_FIX_CR
  scenario_P3_MINOR_PAUSE
  scenario_P3_MINOR_TERM
  scenario_P3_ZERO
  scenario_P3_DIRECT_FIX_LIMIT
  print_summary_and_exit
}

main "$@"
