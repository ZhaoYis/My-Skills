#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./scenario-harness.sh
source "$TEST_ROOT/scenario-harness.sh"

scenario_P0_ENV_NO_GIT() {
  local ctx
  ctx="$(repo_context no-git)"
  assert_contains "P0-ENV-NO-GIT routing" "$ctx" '"routing":"exit-phase-0"'
  assert_contains "P0-ENV-NO-GIT hint" "$ctx" '"hint":"initialize-git"'
}

scenario_P0_INPUT_REQ() {
  local ctx
  ctx="$(repo_context input-req)"
  assert_contains "P0-INPUT-REQ routing" "$ctx" '"routing":"phase-1-new-change"'
}

scenario_P0_INPUT_CHANGE() {
  local ctx
  ctx="$(repo_context input-change)"
  assert_contains "P0-INPUT-CHANGE routing" "$ctx" '"routing":"phase-resume-detect"'
}

scenario_P0_INPUT_EMPTY() {
  local ctx
  ctx="$(repo_context input-empty)"
  assert_contains "P0-INPUT-EMPTY routing" "$ctx" '"routing":"ask-for-input"'
}

scenario_P0_SCHEMA_UNKNOWN() {
  local ctx
  ctx="$(repo_context schema-unknown)"
  assert_contains "P0-SCHEMA-UNKNOWN routing" "$ctx" '"routing":"warn-and-continue"'
}

scenario_P0_RESUME_P1() {
  local ctx
  ctx="$(repo_context resume-p1)"
  assert_contains "P0-RESUME-P1 resume" "$ctx" '"resume":"phase-1-step-3"'
}

scenario_P0_RESUME_P2() {
  local ctx
  ctx="$(repo_context resume-p2)"
  assert_contains "P0-RESUME-P2 resume" "$ctx" '"resume":"phase-2"'
}

scenario_P0_RESUME_P3() {
  local ctx
  ctx="$(repo_context resume-p3)"
  assert_contains "P0-RESUME-P3 resume" "$ctx" '"resume":"phase-3"'
}

scenario_P0_RESUME_P5() {
  local ctx
  ctx="$(repo_context resume-p5)"
  assert_contains "P0-RESUME-P5 resume" "$ctx" '"resume":"phase-5"'
}

scenario_P0_RESUME_P6_DIRTY() {
  local ctx
  ctx="$(repo_context resume-p6-dirty)"
  assert_contains "P0-RESUME-P6-DIRTY gitState" "$ctx" '"gitState":"dirty"'
}

scenario_P0_RESUME_P6_PUSH() {
  local ctx
  ctx="$(repo_context resume-p6-push)"
  assert_contains "P0-RESUME-P6-PUSH resume" "$ctx" '"resume":"phase-6-step-19"'
}

scenario_P0_CONFIRM_CONTINUE() {
  local ctx
  ctx="$(repo_context confirm-continue)"
  assert_contains "P0-CONFIRM-CONTINUE decision" "$ctx" '"decision":"continue"'
}

scenario_P0_CONFIRM_RESTART() {
  local ctx
  ctx="$(repo_context confirm-restart)"
  assert_contains "P0-CONFIRM-RESTART routing" "$ctx" '"routing":"phase-1"'
}

scenario_P0_CONFIRM_TERMINATE() {
  local ctx
  ctx="$(repo_context confirm-terminate)"
  assert_contains "P0-CONFIRM-TERMINATE routing" "$ctx" '"routing":"exit"'
}

main() {
  scenario_P0_ENV_NO_GIT
  scenario_P0_INPUT_REQ
  scenario_P0_INPUT_CHANGE
  scenario_P0_INPUT_EMPTY
  scenario_P0_SCHEMA_UNKNOWN
  scenario_P0_RESUME_P1
  scenario_P0_RESUME_P2
  scenario_P0_RESUME_P3
  scenario_P0_RESUME_P5
  scenario_P0_RESUME_P6_DIRTY
  scenario_P0_RESUME_P6_PUSH
  scenario_P0_CONFIRM_CONTINUE
  scenario_P0_CONFIRM_RESTART
  scenario_P0_CONFIRM_TERMINATE
  print_summary_and_exit
}

main "$@"
