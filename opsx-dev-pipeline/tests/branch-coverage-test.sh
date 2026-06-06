#!/usr/bin/env bash

set -euo pipefail

TEST_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/log-time.sh
source "$TEST_SCRIPT_DIR/lib/log-time.sh"
REPO_ROOT="$(cd "$TEST_SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$TEST_SCRIPT_DIR/logs"
MATRIX_FILE="$REPO_ROOT/tests/pipeline-test/pipeline-branch-matrix.md"
COVERAGE_MAP="$REPO_ROOT/tests/pipeline-test/branch-coverage-map.json"
RESULTS_FILE="$LOGS_DIR/branch-coverage-test-results.log"

mkdir -p "$LOGS_DIR"
> "$RESULTS_FILE"

echo "管道分支覆盖率测试 $(log_timestamp)" > "$RESULTS_FILE"
echo "========================" >> "$RESULTS_FILE"

total_tests=0
pass_count=0
fail_count=0

log_result() {
  local test_name="$1"
  local status="$2"
  local desc="$3"

  echo "" >> "$RESULTS_FILE"
  echo "[$test_name] $desc" >> "$RESULTS_FILE"
  echo "Status: $status" >> "$RESULTS_FILE"

  ((total_tests+=1))
  if [[ "$status" == "PASS" ]]; then
    ((pass_count+=1))
    echo "$test_name: PASS"
  else
    ((fail_count+=1))
    echo "$test_name: FAIL"
  fi
}

echo "开始矩阵覆盖校验..."

if [[ -f "$MATRIX_FILE" ]]; then
  log_result "MATRIX-FILE" "PASS" "分支矩阵存在"
else
  log_result "MATRIX-FILE" "FAIL" "分支矩阵不存在"
fi

if [[ -f "$COVERAGE_MAP" ]]; then
  log_result "COVERAGE-MAP" "PASS" "覆盖映射存在"
else
  log_result "COVERAGE-MAP" "FAIL" "覆盖映射不存在"
fi

if [[ -f "$MATRIX_FILE" && -f "$COVERAGE_MAP" ]]; then
  summary="$(python3 - "$MATRIX_FILE" "$COVERAGE_MAP" "$REPO_ROOT" <<'PY'
import json
import pathlib
import re
import sys

matrix_path = pathlib.Path(sys.argv[1])
coverage_path = pathlib.Path(sys.argv[2])
repo_root = pathlib.Path(sys.argv[3])
matrix_text = matrix_path.read_text(encoding='utf-8')
coverage = json.loads(coverage_path.read_text(encoding='utf-8'))
branch_ids = re.findall(r'\|\s*([A-Z0-9-]+)\s*\|', matrix_text)
branch_ids = [bid for bid in branch_ids if bid not in {'Branch ID', '---'}]
coverage_ids = [item['branchId'] for item in coverage]
missing = sorted(set(branch_ids) - set(coverage_ids))
extra = sorted(set(coverage_ids) - set(branch_ids))
duplicates = sorted({bid for bid in coverage_ids if coverage_ids.count(bid) > 1})
missing_artifacts = []
for item in coverage:
    artifact = item['testArtifact'].split('::', 1)[0]
    if not (repo_root / artifact).exists():
        missing_artifacts.append(f"{item['branchId']}:{artifact}")
phase_counts = {}
coverage_type_counts = {}
status_counts = {}
for item in coverage:
    phase_counts[item['phase']] = phase_counts.get(item['phase'], 0) + 1
    coverage_type_counts[item['coverageType']] = coverage_type_counts.get(item['coverageType'], 0) + 1
    status_counts[item['status']] = status_counts.get(item['status'], 0) + 1
print(json.dumps({
    'matrix_count': len(branch_ids),
    'coverage_count': len(coverage_ids),
    'missing': missing,
    'extra': extra,
    'duplicates': duplicates,
    'missing_artifacts': missing_artifacts,
    'phase_counts': phase_counts,
    'coverage_type_counts': coverage_type_counts,
    'status_counts': status_counts,
}, ensure_ascii=False))
PY
)"

  matrix_count="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["matrix_count"])' "$summary")"
  coverage_count="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["coverage_count"])' "$summary")"
  missing_count="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["missing"]))' "$summary")"
  extra_count="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["extra"]))' "$summary")"
  duplicate_count="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["duplicates"]))' "$summary")"
  missing_artifact_count="$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["missing_artifacts"]))' "$summary")"

  if [[ "$matrix_count" == "$coverage_count" ]]; then
    log_result "BRANCH-COUNT" "PASS" "矩阵分支数与覆盖映射一致 ($matrix_count)"
  else
    log_result "BRANCH-COUNT" "FAIL" "矩阵分支数 $matrix_count 与覆盖映射 $coverage_count 不一致"
  fi

  if [[ "$missing_count" == "0" ]]; then
    log_result "MISSING-BRANCHES" "PASS" "所有矩阵分支都已映射"
  else
    log_result "MISSING-BRANCHES" "FAIL" "存在 $missing_count 个未映射分支"
  fi

  if [[ "$extra_count" == "0" ]]; then
    log_result "EXTRA-BRANCHES" "PASS" "没有孤儿映射"
  else
    log_result "EXTRA-BRANCHES" "FAIL" "存在 $extra_count 个矩阵外映射"
  fi

  if [[ "$duplicate_count" == "0" ]]; then
    log_result "DUPLICATE-BRANCHES" "PASS" "没有重复 branchId"
  else
    log_result "DUPLICATE-BRANCHES" "FAIL" "存在 $duplicate_count 个重复 branchId"
  fi

  if [[ "$missing_artifact_count" == "0" ]]; then
    log_result "ARTIFACTS" "PASS" "所有测试工件都存在"
  else
    log_result "ARTIFACTS" "FAIL" "存在 $missing_artifact_count 个缺失测试工件"
  fi

  echo "" >> "$RESULTS_FILE"
  echo "按 Phase 汇总:" >> "$RESULTS_FILE"
  python3 -c 'import json,sys; data=json.loads(sys.argv[1])["phase_counts"]; [print(f"- {k}: {v}") for k,v in sorted(data.items())]' "$summary" >> "$RESULTS_FILE"
  echo "按 Coverage Type 汇总:" >> "$RESULTS_FILE"
  python3 -c 'import json,sys; data=json.loads(sys.argv[1])["coverage_type_counts"]; [print(f"- {k}: {v}") for k,v in sorted(data.items())]' "$summary" >> "$RESULTS_FILE"
  echo "按 Status 汇总:" >> "$RESULTS_FILE"
  python3 -c 'import json,sys; data=json.loads(sys.argv[1])["status_counts"]; [print(f"- {k}: {v}") for k,v in sorted(data.items())]' "$summary" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"
echo "========================" >> "$RESULTS_FILE"
echo "分支覆盖率测试总结：" >> "$RESULTS_FILE"
echo "总测试数: $total_tests" >> "$RESULTS_FILE"
echo "通过: $pass_count" >> "$RESULTS_FILE"
echo "失败: $fail_count" >> "$RESULTS_FILE"
if [[ $total_tests -gt 0 ]]; then
  echo "成功率: $((pass_count * 100 / total_tests))%" >> "$RESULTS_FILE"
fi
echo "完成时间: $(log_timestamp)" >> "$RESULTS_FILE"

echo ""
echo "分支覆盖率测试完成！"
echo "总测试数: $total_tests"
echo "通过: $pass_count"
echo "失败: $fail_count"

if [[ $fail_count -eq 0 ]]; then
  echo "✅ 矩阵覆盖校验通过。"
  echo "查看详细结果: $RESULTS_FILE"
  exit 0
else
  echo "❌ 有 $fail_count 个校验失败"
  echo "查看详细结果: $RESULTS_FILE"
  exit 1
fi
