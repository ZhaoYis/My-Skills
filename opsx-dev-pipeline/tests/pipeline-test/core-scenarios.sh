#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

scenario_P1_NAME_CONFLICT_REUSE() { assert_contains "P1-NAME-CONFLICT-REUSE" "$(core_context p1-conflict-reuse)" '"routing":"phase-1-3a"'; }
scenario_P1_NAME_CONFLICT_RENAME() { assert_contains "P1-NAME-CONFLICT-RENAME" "$(core_context p1-conflict-rename)" '"routing":"phase-1-recreate"'; }
scenario_P1_ARTIFACTS_CUSTOM() { assert_contains "P1-ARTIFACTS-CUSTOM" "$(core_context p1-artifacts-custom)" '"schema":"custom"'; }
scenario_P1_GATE_CONFIRM() { assert_contains "P1-GATE-CONFIRM" "$(core_context p1-gate-confirm)" '"routing":"phase-2"'; }
scenario_P1_GATE_REVISE() { assert_contains "P1-GATE-REVISE" "$(core_context p1-gate-revise)" '"routing":"phase-1-loop"'; }
scenario_P1_GATE_TERMINATE() { assert_contains "P1-GATE-TERMINATE" "$(core_context p1-gate-terminate)" '"routing":"exit"'; }
scenario_P2_BLOCKED_TERM() { assert_contains "P2-BLOCKED-TERM" "$(core_context p2-blocked-term)" '"decision":"terminate"'; }
scenario_P2_TASK_CLARIFY() { assert_contains "P2-TASK-CLARIFY" "$(core_context p2-task-clarify)" '"routing":"continue-current-task"'; }
scenario_P2_TASK_SKIP() { assert_contains "P2-TASK-SKIP" "$(core_context p2-task-skip)" '"taskMark":"[~]"'; }
scenario_P2_TASK_TERM() { assert_contains "P2-TASK-TERM" "$(core_context p2-task-term)" '"routing":"exit"'; }
scenario_P2_DONE_REVIEW() { assert_contains "P2-DONE-REVIEW" "$(core_context p2-done-review)" '"routing":"phase-3"'; }
scenario_P2_DONE_PAUSE() { assert_contains "P2-DONE-PAUSE" "$(core_context p2-done-pause)" '"routing":"exit-with-resume"'; }
scenario_P2_DONE_SKIP_REVIEW() { assert_contains "P2-DONE-SKIP-REVIEW" "$(core_context p2-done-skip-review)" '"routing":"phase-5"'; }
scenario_P2_DONE_TERM() { assert_contains "P2-DONE-TERM" "$(core_context p2-done-term)" '"routing":"exit"'; }
scenario_P31_CONFIRM() { assert_contains "P31-CONFIRM" "$(core_context p31-confirm)" '"routing":"apply-fix-cr"'; }
scenario_P31_REVISE() { assert_contains "P31-REVISE" "$(core_context p31-revise)" '"routing":"proposal-gate"'; }
scenario_P31_ABANDON() { assert_contains "P31-ABANDON" "$(core_context p31-abandon)" '"routing":"phase-5-original-change"'; }
scenario_P31_ARCHIVE_MERGE_SPECS() { assert_contains "P31-ARCHIVE-MERGE-SPECS" "$(core_context p31-archive-merge-specs)" '"routing":"archive-with-spec-sync"'; }
scenario_P4_UNFINISHED_CONTINUE() { assert_contains "P4-UNFINISHED-CONTINUE" "$(core_context p4-unfinished-continue)" '"routing":"phase-4"'; }
scenario_P4_UNFINISHED_BACK() { assert_contains "P4-UNFINISHED-BACK" "$(core_context p4-unfinished-back)" '"routing":"phase-2"'; }
scenario_P4_UNFINISHED_TERM() { assert_contains "P4-UNFINISHED-TERM" "$(core_context p4-unfinished-term)" '"routing":"exit"'; }
scenario_P4_VERIFY_UNRESOLVED() { assert_contains "P4-VERIFY-UNRESOLVED" "$(core_context p4-verify-unresolved)" '"routing":"ask-human-confirmation"'; }
scenario_P4_VERIFY_FAIL_RETRY() { assert_contains "P4-VERIFY-FAIL-RETRY" "$(core_context p4-verify-fail-retry)" '"routing":"step-13"'; }
scenario_P4_VERIFY_FAIL_PAUSE() { assert_contains "P4-VERIFY-FAIL-PAUSE" "$(core_context p4-verify-fail-pause)" '"decision":"pause"'; }
scenario_P4_VERIFY_FAIL_TERM() { assert_contains "P4-VERIFY-FAIL-TERM" "$(core_context p4-verify-fail-term)" '"decision":"terminate"'; }
scenario_P4_DELTA_SYNC() { assert_contains "P4-DELTA-SYNC" "$(core_context p4-delta-sync)" '"archiveFlag":"merge-specs"'; }
scenario_P4_DELTA_SKIP() { assert_contains "P4-DELTA-SKIP" "$(core_context p4-delta-skip)" '"archiveFlag":"--skip-specs"'; }
scenario_P4_ARCHIVE_FALLBACK() { assert_contains "P4-ARCHIVE-FALLBACK" "$(core_context p4-archive-fallback)" '"routing":"mkdir-mv"'; }
scenario_P4_POST_MERGE() { assert_contains "P4-POST-MERGE" "$(core_context p4-post-merge)" '"routing":"phase-6-merge"'; }
scenario_P4_POST_PUSH() { assert_contains "P4-POST-PUSH" "$(core_context p4-post-push)" '"routing":"phase-6-push"'; }
scenario_P4_POST_TERM() { assert_contains "P4-POST-TERM" "$(core_context p4-post-term)" '"routing":"exit"'; }

main() {
  scenario_P1_NAME_CONFLICT_REUSE
  scenario_P1_NAME_CONFLICT_RENAME
  scenario_P1_ARTIFACTS_CUSTOM
  scenario_P1_GATE_CONFIRM
  scenario_P1_GATE_REVISE
  scenario_P1_GATE_TERMINATE
  scenario_P2_BLOCKED_TERM
  scenario_P2_TASK_CLARIFY
  scenario_P2_TASK_SKIP
  scenario_P2_TASK_TERM
  scenario_P2_DONE_REVIEW
  scenario_P2_DONE_PAUSE
  scenario_P2_DONE_SKIP_REVIEW
  scenario_P2_DONE_TERM
  scenario_P31_CONFIRM
  scenario_P31_REVISE
  scenario_P31_ABANDON
  scenario_P31_ARCHIVE_MERGE_SPECS
  scenario_P4_UNFINISHED_CONTINUE
  scenario_P4_UNFINISHED_BACK
  scenario_P4_UNFINISHED_TERM
  scenario_P4_VERIFY_UNRESOLVED
  scenario_P4_VERIFY_FAIL_RETRY
  scenario_P4_VERIFY_FAIL_PAUSE
  scenario_P4_VERIFY_FAIL_TERM
  scenario_P4_DELTA_SYNC
  scenario_P4_DELTA_SKIP
  scenario_P4_ARCHIVE_FALLBACK
  scenario_P4_POST_MERGE
  scenario_P4_POST_PUSH
  scenario_P4_POST_TERM
  print_summary_and_exit
}

main "$@"
