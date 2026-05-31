#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

phase6_context() {
  case "$1" in
    diverged-rebase) echo '{"gitState":"diverged","decision":"rebase","routing":"continue"}' ;;
    diverged-ignore) echo '{"gitState":"diverged","decision":"ignore","routing":"continue"}' ;;
    diverged-term) echo '{"gitState":"diverged","decision":"terminate","routing":"exit"}' ;;
    sensitive-exclude) echo '{"sensitive":"detected","decision":"exclude","routing":"continue"}' ;;
    sensitive-include) echo '{"sensitive":"detected","decision":"include","routing":"continue"}' ;;
    sensitive-term) echo '{"sensitive":"detected","decision":"terminate","routing":"exit"}' ;;
    commit-confirm) echo '{"commitDecision":"confirm","routing":"commit"}' ;;
    commit-edit) echo '{"commitDecision":"edit","routing":"commit"}' ;;
    commit-cancel) echo '{"commitDecision":"cancel","routing":"exit-with-resume"}' ;;
    no-diff) echo '{"diff":"empty","routing":"finish-phase-6"}' ;;
    push-ok) echo '{"push":"ok","routing":"continue"}' ;;
    push-retry) echo '{"push":"fail","decision":"retry-after-rebase","routing":"retry-push"}' ;;
    push-term) echo '{"push":"fail","decision":"terminate","routing":"exit"}' ;;
    merge-target) echo '{"merge":"target-select","choices":["main","qa","stg","develop","other"]}' ;;
    merge-strategy) echo '{"merge":"strategy-select","choices":["standard","squash","no-ff"]}' ;;
    merge-abort) echo '{"merge":"conflict","decision":"abort","routing":"exit"}' ;;
    merge-theirs) echo '{"merge":"conflict","decision":"theirs","routing":"continue"}' ;;
    merge-ours) echo '{"merge":"conflict","decision":"ours","routing":"continue"}' ;;
    merge-manual) echo '{"merge":"conflict","decision":"manual","routing":"pause"}' ;;
    branch-keep) echo '{"branchCleanup":"keep","routing":"finish"}' ;;
    branch-delete) echo '{"branchCleanup":"delete","routing":"finish"}' ;;
    *) return 1 ;;
  esac
}

scenario_P6_DIVERGED_REBASE() { assert_contains "P6-DIVERGED-REBASE" "$(phase6_context diverged-rebase)" '"decision":"rebase"'; }
scenario_P6_DIVERGED_IGNORE() { assert_contains "P6-DIVERGED-IGNORE" "$(phase6_context diverged-ignore)" '"decision":"ignore"'; }
scenario_P6_DIVERGED_TERM() { assert_contains "P6-DIVERGED-TERM" "$(phase6_context diverged-term)" '"routing":"exit"'; }
scenario_P6_SENSITIVE_EXCLUDE() { assert_contains "P6-SENSITIVE-EXCLUDE" "$(phase6_context sensitive-exclude)" '"decision":"exclude"'; }
scenario_P6_SENSITIVE_INCLUDE() { assert_contains "P6-SENSITIVE-INCLUDE" "$(phase6_context sensitive-include)" '"decision":"include"'; }
scenario_P6_SENSITIVE_TERM() { assert_contains "P6-SENSITIVE-TERM" "$(phase6_context sensitive-term)" '"routing":"exit"'; }
scenario_P6_COMMIT_CONFIRM() { assert_contains "P6-COMMIT-CONFIRM" "$(phase6_context commit-confirm)" '"routing":"commit"'; }
scenario_P6_COMMIT_EDIT() { assert_contains "P6-COMMIT-EDIT" "$(phase6_context commit-edit)" '"routing":"commit"'; }
scenario_P6_COMMIT_CANCEL() { assert_contains "P6-COMMIT-CANCEL" "$(phase6_context commit-cancel)" '"routing":"exit-with-resume"'; }
scenario_P6_NO_DIFF() { assert_contains "P6-NO-DIFF" "$(phase6_context no-diff)" '"routing":"finish-phase-6"'; }
scenario_P6_PUSH_OK() { assert_contains "P6-PUSH-OK" "$(phase6_context push-ok)" '"push":"ok"'; }
scenario_P6_PUSH_RETRY() { assert_contains "P6-PUSH-RETRY" "$(phase6_context push-retry)" '"routing":"retry-push"'; }
scenario_P6_PUSH_TERM() { assert_contains "P6-PUSH-TERM" "$(phase6_context push-term)" '"routing":"exit"'; }
scenario_P6_MERGE_TARGET() { assert_contains "P6-MERGE-TARGET" "$(phase6_context merge-target)" '"target-select"'; }
scenario_P6_MERGE_STRATEGY() { assert_contains "P6-MERGE-STRATEGY" "$(phase6_context merge-strategy)" '"strategy-select"'; }
scenario_P6_MERGE_ABORT() { assert_contains "P6-MERGE-ABORT" "$(phase6_context merge-abort)" '"decision":"abort"'; }
scenario_P6_MERGE_THEIRS() { assert_contains "P6-MERGE-THEIRS" "$(phase6_context merge-theirs)" '"decision":"theirs"'; }
scenario_P6_MERGE_OURS() { assert_contains "P6-MERGE-OURS" "$(phase6_context merge-ours)" '"decision":"ours"'; }
scenario_P6_MERGE_MANUAL() { assert_contains "P6-MERGE-MANUAL" "$(phase6_context merge-manual)" '"routing":"pause"'; }
scenario_P6_BRANCH_KEEP() { assert_contains "P6-BRANCH-KEEP" "$(phase6_context branch-keep)" '"branchCleanup":"keep"'; }
scenario_P6_BRANCH_DELETE() { assert_contains "P6-BRANCH-DELETE" "$(phase6_context branch-delete)" '"branchCleanup":"delete"'; }

main() {
  scenario_P6_DIVERGED_REBASE
  scenario_P6_DIVERGED_IGNORE
  scenario_P6_DIVERGED_TERM
  scenario_P6_SENSITIVE_EXCLUDE
  scenario_P6_SENSITIVE_INCLUDE
  scenario_P6_SENSITIVE_TERM
  scenario_P6_COMMIT_CONFIRM
  scenario_P6_COMMIT_EDIT
  scenario_P6_COMMIT_CANCEL
  scenario_P6_NO_DIFF
  scenario_P6_PUSH_OK
  scenario_P6_PUSH_RETRY
  scenario_P6_PUSH_TERM
  scenario_P6_MERGE_TARGET
  scenario_P6_MERGE_STRATEGY
  scenario_P6_MERGE_ABORT
  scenario_P6_MERGE_THEIRS
  scenario_P6_MERGE_OURS
  scenario_P6_MERGE_MANUAL
  scenario_P6_BRANCH_KEEP
  scenario_P6_BRANCH_DELETE
  print_summary_and_exit
}

main "$@"
