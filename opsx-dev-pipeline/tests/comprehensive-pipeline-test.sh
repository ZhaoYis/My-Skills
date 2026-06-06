#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TEST_DIR/.." && pwd)"
LOGS_DIR="$TEST_DIR/logs"
LOG_FILE="$LOGS_DIR/comprehensive-test-results.log"

mkdir -p "$LOGS_DIR"
> "$LOG_FILE"

echo "开始全面管道测试 $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

run_test() {
  local test_name="$1"
  local test_desc="$2"
  shift 2

  echo "" >> "$LOG_FILE"
  echo "[$test_name] $test_desc" >> "$LOG_FILE"
  echo "----------------------------------------" >> "$LOG_FILE"

  if "$@" >> "$LOG_FILE" 2>&1; then
    echo "[PASS] $test_name" >> "$LOG_FILE"
    return 0
  else
    echo "[FAIL] $test_name" >> "$LOG_FILE"
    return 1
  fi
}

test_scripts_exist() {
  local missing_scripts=()
  for script in opsx-preflight.sh opsx-detect-schema.sh opsx-new-change.sh \
    opsx-list-changes.sh opsx-change-status.sh opsx-instructions.sh \
    opsx-instructions-apply.sh opsx-change-context.sh opsx-resolve-verify.sh \
    opsx-validate-change.sh opsx-validate-all.sh opsx-archive.sh opsx-ensure-change-meta.sh opsx-selftest.sh; do
    if [[ ! -f "${SCRIPT_DIR}/${script}" ]]; then
      missing_scripts+=("$script")
    fi
  done
  [[ ${#missing_scripts[@]} -eq 0 ]]
}

test_selftest() {
  bash "$SCRIPT_DIR/opsx-selftest.sh"
}

test_branch_coverage() {
  bash "$REPO_ROOT/tests/branch-coverage-test.sh"
}

test_phase0_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/phase0-scenarios.sh"
}

test_core_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/core-scenarios.sh"
}

test_phase3_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/phase3-scenarios.sh"
}

test_phase5_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/phase5-scenarios.sh"
}

test_phase6_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/phase6-scenarios.sh"
}

test_recovery_scenarios() {
  bash "$REPO_ROOT/tests/pipeline-test/recovery-scenarios.sh"
}

main() {
  local failed_tests=0
  local passed_tests=0

  echo "执行全面管道测试..."

  run_test "SCRIPTS-EXIST" "验证所有必需脚本是否存在" test_scripts_exist && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "SELFTEST" "验证 helper/CLI 契约测试" test_selftest && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "BRANCH-COVERAGE" "验证矩阵与覆盖台账一致性" test_branch_coverage && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "PHASE0-SCENARIOS" "验证 Phase 0 场景分支" test_phase0_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "CORE-SCENARIOS" "验证 P1/P2/P31/P4 场景分支" test_core_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "PHASE3-SCENARIOS" "验证 Phase 3 场景分支" test_phase3_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "PHASE5-SCENARIOS" "验证 Phase 5 场景分支" test_phase5_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "PHASE6-SCENARIOS" "验证 Phase 6 场景分支" test_phase6_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))
  run_test "RECOVERY-SCENARIOS" "验证 Recovery 场景分支" test_recovery_scenarios && ((passed_tests+=1)) || ((failed_tests+=1))

  echo "" >> "$LOG_FILE"
  echo "========================================" >> "$LOG_FILE"
  echo "测试总结：" >> "$LOG_FILE"
  echo "通过: $passed_tests" >> "$LOG_FILE"
  echo "失败: $failed_tests" >> "$LOG_FILE"
  echo "总测试数: $((passed_tests + failed_tests))" >> "$LOG_FILE"
  echo "完成时间: $(date)" >> "$LOG_FILE"

  if [[ $failed_tests -eq 0 ]]; then
    echo ""
    echo "✅ 所有测试通过！"
    echo "查看详细结果: $LOG_FILE"
    return 0
  fi

  echo ""
  echo "❌ 有 $failed_tests 个测试失败"
  echo "查看详细结果: $LOG_FILE"
  return 1
}

main "$@"
