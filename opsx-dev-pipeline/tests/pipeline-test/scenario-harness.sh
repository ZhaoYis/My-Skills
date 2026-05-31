#!/usr/bin/env bash

set -euo pipefail

TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TEST_ROOT/../.." && pwd)"

pass_count=0
fail_count=0

log_pass() {
  local name="$1"
  printf '[PASS] %s\n' "$name"
  ((pass_count+=1))
}

log_fail() {
  local name="$1"
  local detail="$2"
  printf '[FAIL] %s: %s\n' "$name" "$detail" >&2
  ((fail_count+=1))
}

assert_contains() {
  local name="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    log_pass "$name"
  else
    log_fail "$name" "missing '$needle'"
  fi
}

assert_equals() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    log_pass "$name"
  else
    log_fail "$name" "expected '$expected' got '$actual'"
  fi
}

repo_context() {
  local mode="$1"
  case "$mode" in
    no-git) echo '{"repo":"missing","routing":"exit-phase-0","hint":"initialize-git"}' ;;
    input-req) echo '{"input":"requirement","routing":"phase-1-new-change"}' ;;
    input-change) echo '{"input":"existing-change","routing":"phase-resume-detect"}' ;;
    input-empty) echo '{"input":"empty","routing":"ask-for-input"}' ;;
    schema-unknown) echo '{"schema":"unknown","routing":"warn-and-continue"}' ;;
    resume-p1) echo '{"resume":"phase-1-step-3","routing":"phase-1"}' ;;
    resume-p2) echo '{"resume":"phase-2","routing":"phase-2"}' ;;
    resume-p3) echo '{"resume":"phase-3","routing":"phase-3"}' ;;
    resume-p5) echo '{"resume":"phase-5","routing":"phase-5-then-phase-4"}' ;;
    resume-p6-dirty) echo '{"resume":"phase-6","gitState":"dirty"}' ;;
    resume-p6-push) echo '{"resume":"phase-6-step-19","gitState":"ahead"}' ;;
    confirm-continue) echo '{"decision":"continue","routing":"resume-target"}' ;;
    confirm-restart) echo '{"decision":"restart","routing":"phase-1"}' ;;
    confirm-terminate) echo '{"decision":"terminate","routing":"exit"}' ;;
    *) return 1 ;;
  esac
}

core_context() {
  local mode="$1"
  case "$mode" in
    p1-conflict-reuse) echo '{"decision":"reuse","routing":"phase-1-3a"}' ;;
    p1-conflict-rename) echo '{"decision":"rename","routing":"phase-1-recreate"}' ;;
    p1-artifacts-custom) echo '{"artifacts":["proposal","adr","specs","design","tasks"],"schema":"custom"}' ;;
    p1-gate-confirm) echo '{"decision":"confirm","routing":"phase-2"}' ;;
    p1-gate-revise) echo '{"decision":"revise","routing":"phase-1-loop"}' ;;
    p1-gate-terminate) echo '{"decision":"terminate","routing":"exit"}' ;;
    p2-blocked-term) echo '{"state":"blocked","decision":"terminate","routing":"exit"}' ;;
    p2-task-clarify) echo '{"taskDecision":"clarify","routing":"continue-current-task"}' ;;
    p2-task-skip) echo '{"taskDecision":"skip","taskMark":"[~]"}' ;;
    p2-task-term) echo '{"taskDecision":"terminate","routing":"exit"}' ;;
    p2-done-review) echo '{"doneDecision":"review","routing":"phase-3"}' ;;
    p2-done-pause) echo '{"doneDecision":"pause","routing":"exit-with-resume"}' ;;
    p2-done-skip-review) echo '{"doneDecision":"skip-review","routing":"phase-5"}' ;;
    p2-done-term) echo '{"doneDecision":"terminate","routing":"exit"}' ;;
    p31-confirm) echo '{"decision":"confirm","routing":"apply-fix-cr"}' ;;
    p31-revise) echo '{"decision":"revise","routing":"proposal-gate"}' ;;
    p31-abandon) echo '{"decision":"abandon","routing":"phase-5-original-change"}' ;;
    p31-archive-merge-specs) echo '{"archive":"merge-specs","routing":"archive-with-spec-sync"}' ;;
    p4-unfinished-continue) echo '{"unfinished":"continue","routing":"phase-4"}' ;;
    p4-unfinished-back) echo '{"unfinished":"back-to-apply","routing":"phase-2"}' ;;
    p4-unfinished-term) echo '{"unfinished":"terminate","routing":"exit"}' ;;
    p4-verify-unresolved) echo '{"verify":"unresolved","routing":"ask-human-confirmation"}' ;;
    p4-verify-fail-retry) echo '{"verify":"fail","decision":"retry","routing":"step-13"}' ;;
    p4-verify-fail-pause) echo '{"verify":"fail","decision":"pause","routing":"exit"}' ;;
    p4-verify-fail-term) echo '{"verify":"fail","decision":"terminate","routing":"exit"}' ;;
    p4-delta-sync) echo '{"delta":"sync","archiveFlag":"merge-specs"}' ;;
    p4-delta-skip) echo '{"delta":"skip","archiveFlag":"--skip-specs"}' ;;
    p4-archive-fallback) echo '{"archive":"fallback","routing":"mkdir-mv"}' ;;
    p4-post-merge) echo '{"postArchive":"merge","routing":"phase-6-merge"}' ;;
    p4-post-push) echo '{"postArchive":"push","routing":"phase-6-push"}' ;;
    p4-post-term) echo '{"postArchive":"terminate","routing":"exit"}' ;;
    *) return 1 ;;
  esac
}

print_summary_and_exit() {
  printf '\nScenario summary: pass=%s fail=%s\n' "$pass_count" "$fail_count"
  if [[ "$fail_count" -gt 0 ]]; then
    exit 1
  fi
}
