#!/usr/bin/env bash
# 统一测试入口：一次运行完成全部回归套件
#
# 用法:
#   bash tests/run-all.sh              # 运行全部套件（默认）
#   bash tests/run-all.sh --list       # 列出可用套件
#   bash tests/run-all.sh --only NAME  # 仅运行指定套件（可重复）
#   bash tests/run-all.sh --skip NAME  # 跳过指定套件（可重复）
#
# 套件说明:
#   integrity    - 仓库结构、文档、脚本权限、硬编码残留
#   coverage     - 分支矩阵与覆盖台账一致性
#   regression   - 脚本契约自检 + 场景分支断言（原 comprehensive 核心）
#   validation   - schema 迁移与文档一致性终检
#   smoke        - 轻量冒烟（可选，与 integrity 部分重叠）
#   integration  - OpenSpec 临时目录集成测试（可选，需 openspec CLI）

set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/log-time.sh
source "$TEST_DIR/lib/log-time.sh"
REPO_ROOT="$(cd "$TEST_DIR/.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts"
LOGS_DIR="$TEST_DIR/logs"
SUMMARY_FILE="$LOGS_DIR/run-all-summary.log"

mkdir -p "$LOGS_DIR"

TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0
declare -a FAILED_SUITE_NAMES=()
declare -a SELECTED_SUITES=()
declare -a SKIPPED_NAMES=()

usage() {
  cat <<'EOF'
opsx-dev-pipeline 统一测试入口

用法:
  bash tests/run-all.sh [选项]

选项:
  --list              列出所有套件及说明
  --only NAME         仅运行指定套件（可多次指定）
  --skip NAME         跳过指定套件（可多次指定）
  -h, --help          显示帮助

可用套件:
  integrity     仓库结构、文档、脚本权限
  coverage      分支矩阵与 branch-coverage-map.json 一致性
  regression    opsx-selftest + pipeline-test 场景分支断言
  validation    schema 迁移与 SKILL/Phase 文档终检
  smoke         轻量冒烟（脚本存在 + preflight/list 可调用）
  integration   OpenSpec 临时目录集成测试（较慢，需 openspec）

默认运行: integrity → coverage → regression → validation
EOF
}

list_suites() {
  usage
}

should_run_suite() {
  local name="$1"
  local skip

  if [[ ${#SKIPPED_NAMES[@]} -gt 0 ]]; then
    for skip in "${SKIPPED_NAMES[@]}"; do
      if [[ "$skip" == "$name" ]]; then
        return 1
      fi
    done
  fi

  if [[ ${#SELECTED_SUITES[@]} -eq 0 ]]; then
    case "$name" in
      smoke|integration) return 1 ;;
      *) return 0 ;;
    esac
  fi

  if [[ ${#SELECTED_SUITES[@]} -gt 0 ]]; then
    local selected
    for selected in "${SELECTED_SUITES[@]}"; do
      if [[ "$selected" == "$name" ]]; then
        return 0
      fi
    done
  fi
  return 1
}

run_suite() {
  local name="$1"
  local desc="$2"
  shift 2

  if ! should_run_suite "$name"; then
    ((SKIPPED_SUITES+=1))
    echo "[SKIP] $name — $desc"
    return 0
  fi

  ((TOTAL_SUITES+=1))
  echo ""
  echo "========================================"
  echo "[$name] $desc"
  echo "========================================"

  {
    echo ""
    echo "[$name] $desc"
    echo "开始: $(log_timestamp)"
  } >> "$SUMMARY_FILE"

  if "$@"; then
    ((PASSED_SUITES+=1))
    echo "[PASS] $name"
    echo "结果: PASS" >> "$SUMMARY_FILE"
    return 0
  fi

  ((FAILED_SUITES+=1))
  FAILED_SUITE_NAMES+=("$name")
  echo "[FAIL] $name"
  echo "结果: FAIL" >> "$SUMMARY_FILE"
  return 1
}

suite_integrity() {
  bash "$TEST_DIR/integrity-check.sh"
}

suite_coverage() {
  bash "$TEST_DIR/branch-coverage-test.sh"
}

suite_regression() {
  local failed=0

  local scripts=(
    opsx-preflight.sh opsx-detect-schema.sh opsx-new-change.sh
    opsx-list-changes.sh opsx-change-status.sh opsx-instructions.sh
    opsx-instructions-apply.sh opsx-change-context.sh opsx-resolve-verify.sh
    opsx-validate-change.sh opsx-validate-all.sh opsx-archive.sh
    opsx-ensure-change-meta.sh opsx-selftest.sh
  )
  local script missing=()
  for script in "${scripts[@]}"; do
    if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
      missing+=("$script")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "缺少脚本: ${missing[*]}" >&2
    ((failed+=1))
  else
    echo "SCRIPTS-EXIST: PASS"
  fi

  if bash "$SCRIPT_DIR/opsx-selftest.sh"; then
    echo "SELFTEST: PASS"
  else
    echo "SELFTEST: FAIL" >&2
    ((failed+=1))
  fi

  local scenario
  for scenario in \
    "$TEST_DIR/pipeline-test/phase0-scenarios.sh" \
    "$TEST_DIR/pipeline-test/core-scenarios.sh" \
    "$TEST_DIR/pipeline-test/phase3-scenarios.sh" \
    "$TEST_DIR/pipeline-test/phase5-scenarios.sh" \
    "$TEST_DIR/pipeline-test/phase6-scenarios.sh" \
    "$TEST_DIR/pipeline-test/recovery-scenarios.sh"; do
    if bash "$scenario"; then
      echo "$(basename "$scenario"): PASS"
    else
      echo "$(basename "$scenario"): FAIL" >&2
      ((failed+=1))
    fi
  done

  [[ $failed -eq 0 ]]
}

suite_validation() {
  bash "$TEST_DIR/final-validation.sh"
}

suite_smoke() {
  bash "$TEST_DIR/simplified-pipeline-test.sh"
}

suite_integration() {
  bash "$TEST_DIR/advanced-pipeline-test.sh"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      --list)
        list_suites
        exit 0
        ;;
      --only)
        [[ $# -ge 2 ]] || { echo "缺少 --only 参数" >&2; exit 2; }
        SELECTED_SUITES+=("$2")
        shift 2
        ;;
      --skip)
        [[ $# -ge 2 ]] || { echo "缺少 --skip 参数" >&2; exit 2; }
        SKIPPED_NAMES+=("$2")
        shift 2
        ;;
      *)
        echo "未知参数: $1" >&2
        usage >&2
        exit 2
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  > "$SUMMARY_FILE"
  echo "统一测试入口 $(log_timestamp)" >> "$SUMMARY_FILE"

  echo "opsx-dev-pipeline 统一测试"
  echo "日志: $SUMMARY_FILE"

  local exit_code=0

  run_suite integrity "仓库结构与文档完整性" suite_integrity || exit_code=1
  run_suite coverage "分支矩阵覆盖校验" suite_coverage || exit_code=1
  run_suite regression "契约自检与场景分支回归" suite_regression || exit_code=1
  run_suite validation "schema 迁移与文档终检" suite_validation || exit_code=1
  run_suite smoke "轻量冒烟测试" suite_smoke || exit_code=1
  run_suite integration "OpenSpec 集成测试" suite_integration || exit_code=1

  echo "" >> "$SUMMARY_FILE"
  echo "========================================" >> "$SUMMARY_FILE"
  echo "套件总数: $TOTAL_SUITES" >> "$SUMMARY_FILE"
  echo "通过: $PASSED_SUITES" >> "$SUMMARY_FILE"
  echo "失败: $FAILED_SUITES" >> "$SUMMARY_FILE"
  echo "跳过: $SKIPPED_SUITES" >> "$SUMMARY_FILE"
  echo "完成: $(log_timestamp)" >> "$SUMMARY_FILE"

  echo ""
  echo "========================================"
  echo "测试总结"
  echo "  运行: $TOTAL_SUITES  通过: $PASSED_SUITES  失败: $FAILED_SUITES  跳过: $SKIPPED_SUITES"
  echo "  汇总日志: $SUMMARY_FILE"
  echo "  各套件详情: $LOGS_DIR/"

  if [[ $FAILED_SUITES -gt 0 ]]; then
    echo "  失败套件: ${FAILED_SUITE_NAMES[*]}"
    echo ""
    echo "❌ 有 $FAILED_SUITES 个套件失败"
    exit 1
  fi

  if [[ $TOTAL_SUITES -eq 0 ]]; then
    echo ""
    echo "⚠️  没有套件被执行，请检查 --only / --skip 参数"
    exit 2
  fi

  echo ""
  echo "✅ 全部套件通过"
  exit 0
}

main "$@"
