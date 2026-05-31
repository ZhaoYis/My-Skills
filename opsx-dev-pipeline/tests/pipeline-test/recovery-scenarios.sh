#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

recovery_context() {
  case "$1" in
    ask-fallback) echo '{"askQuestion":"unavailable","routing":"numbered-options"}' ;;
    forced-exit) echo '{"exit":"forced","guardrail":"require-user-consent"}' ;;
    *) return 1 ;;
  esac
}

scenario_R_ASK_FALLBACK() {
  assert_contains "R-ASK-FALLBACK" "$(recovery_context ask-fallback)" '"routing":"numbered-options"'
}

scenario_R_FORCED_EXIT() {
  assert_contains "R-FORCED-EXIT" "$(recovery_context forced-exit)" '"guardrail":"require-user-consent"'
}

main() {
  scenario_R_ASK_FALLBACK
  scenario_R_FORCED_EXIT
  print_summary_and_exit
}

main "$@"
