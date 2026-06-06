#!/bin/bash
# 管道完整性测试脚本
# 结构约束：默认从 tests/ 目录内或仓库根目录调用。
# 当前 repo 结构假设：
# - 根目录存在 SKILL.md
# - schema 适配摘要位于 assets/schema-adapter-summary.md
# - 测试矩阵位于 tests/pipeline-test/pipeline-branch-matrix.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"
REFERENCE_DIR="$(cd "$(dirname "$0")/../references" && pwd)"
ASSET_DIR="$(cd "$(dirname "$0")/../assets" && pwd)"
TEST_ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/log-time.sh
source "$TEST_ROOT/lib/log-time.sh"
LOGS_DIR="$TEST_ROOT/logs"
RESULTS_FILE="$LOGS_DIR/integrity-test-results.log"

mkdir -p "$LOGS_DIR"
# 清空结果文件
> "$RESULTS_FILE"

echo "管道完整性测试 $(log_timestamp)" > "$RESULTS_FILE"
echo "========================" >> "$RESULTS_FILE"

# 计数器
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

    ((total_tests++))
    if [[ "$status" == "PASS" ]]; then
        ((pass_count++))
        echo "$test_name: PASS"
    else
        ((fail_count++))
        echo "$test_name: FAIL"
    fi
}

echo "开始管道完整性测试..."

# 1. 验证所有脚本是否存在
echo "验证脚本存在性..."
all_scripts=(
    "opsx-preflight.sh"
    "opsx-detect-schema.sh"
    "opsx-new-change.sh"
    "opsx-list-changes.sh"
    "opsx-change-status.sh"
    "opsx-instructions.sh"
    "opsx-instructions-apply.sh"
    "opsx-change-context.sh"
    "opsx-resolve-verify.sh"
    "opsx-validate-change.sh"
    "opsx-validate-all.sh"
    "opsx-archive.sh"
    "opsx-ensure-change-meta.sh"
    "opsx-selftest.sh"
)

missing_scripts=()
for script in "${all_scripts[@]}"; do
    if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
        missing_scripts+=("$script")
    fi
done

if [[ ${#missing_scripts[@]} -eq 0 ]]; then
    log_result "SCRIPTS-EXIST" "PASS" "所有脚本都存在"
else
    log_result "SCRIPTS-EXIST" "FAIL" "缺少脚本: ${missing_scripts[*]}"
fi

# 2. 验证脚本权限
echo "验证脚本权限..."
executable_scripts=()
non_executable_scripts=()
for script in "${all_scripts[@]}"; do
    if [[ -f "$SCRIPT_DIR/$script" ]]; then
        if [[ -x "$SCRIPT_DIR/$script" ]]; then
            executable_scripts+=("$script")
        else
            non_executable_scripts+=("$script")
        fi
    fi
done

if [[ ${#non_executable_scripts[@]} -eq 0 ]]; then
    log_result "SCRIPTS-EXEC" "PASS" "所有脚本都有执行权限"
else
    log_result "SCRIPTS-EXEC" "FAIL" "以下脚本没有执行权限: ${non_executable_scripts[*]}"
fi

# 3. 验证关键 Phase 脚本是否存在
echo "验证关键 Phase 脚本..."
critical_scripts=(
    "opsx-preflight.sh"
    "opsx-detect-schema.sh"
    "opsx-new-change.sh"
    "opsx-change-status.sh"
    "opsx-instructions-apply.sh"
    "opsx-resolve-verify.sh"
    "opsx-archive.sh"
)

missing_critical=()
for script in "${critical_scripts[@]}"; do
    if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
        missing_critical+=("$script")
    fi
done

if [[ ${#missing_critical[@]} -eq 0 ]]; then
    log_result "CRITICAL-SCRIPTS" "PASS" "所有关键脚本都存在"
else
    log_result "CRITICAL-SCRIPTS" "FAIL" "缺少关键脚本: ${missing_critical[*]}"
fi

# 4. 验证 references 目录中的文档
echo "验证文档完整性..."
required_docs=(
    "phase-0-entrance.md"
    "phase-1-propose.md"
    "phase-2-apply.md"
    "phase-3-review.md"
    "phase-4-archive.md"
    "phase-5-unit-tests.md"
    "phase-6-merge-push.md"
    "recovery-guardrails-appendix.md"
    "../assets/schema-adapter-summary.md"
)

missing_docs=()
for doc in "${required_docs[@]}"; do
    if [[ "$doc" == ../assets/* ]]; then
        if [[ ! -f "$TEST_ROOT/$doc" ]]; then
            missing_docs+=("${doc#../}")
        fi
    elif [[ ! -f "$REFERENCE_DIR/$doc" ]]; then
        missing_docs+=("$doc")
    fi
done

if [[ ${#missing_docs[@]} -eq 0 ]]; then
    log_result "DOCS-EXIST" "PASS" "所有关键文档都存在"
else
    log_result "DOCS-EXIST" "FAIL" "缺少文档: ${missing_docs[*]}"
fi

# 5. 验证测试目录中的测试文档
if [[ -f "$TEST_ROOT/pipeline-test/pipeline-branch-matrix.md" ]]; then
    log_result "TEST-MATRIX" "PASS" "测试分支矩阵存在"
else
    log_result "TEST-MATRIX" "FAIL" "测试分支矩阵不存在"
fi

# 6. 验证 schema 检测脚本功能
if [[ -f "$SCRIPT_DIR/opsx-detect-schema.sh" ]]; then
    # 测试脚本是否能正确解析
    if bash -n "$SCRIPT_DIR/opsx-detect-schema.sh" 2>/dev/null; then
        log_result "SYNTAX-CHECK" "PASS" "schema 检测脚本语法正确"
    else
        log_result "SYNTAX-CHECK" "FAIL" "schema 检测脚本语法错误"
    fi
else
    log_result "SYNTAX-CHECK" "FAIL" "schema 检测脚本不存在"
fi

# 输出总结
echo "" >> "$RESULTS_FILE"
echo "========================" >> "$RESULTS_FILE"
echo "测试总结：" >> "$RESULTS_FILE"
echo "总测试数: $total_tests" >> "$RESULTS_FILE"
echo "通过: $pass_count" >> "$RESULTS_FILE"
echo "失败: $fail_count" >> "$RESULTS_FILE"
if [[ $total_tests -gt 0 ]]; then
    echo "成功率: $((pass_count * 100 / total_tests))%" >> "$RESULTS_FILE"
fi
echo "完成时间: $(log_timestamp)" >> "$RESULTS_FILE"

echo ""
echo "测试完成！"
echo "总测试数: $total_tests"
echo "通过: $pass_count"
echo "失败: $fail_count"

if [[ $fail_count -eq 0 ]]; then
    echo "🎉 所有完整性检查通过！"
    echo "查看详细结果: $RESULTS_FILE"
    exit 0
else
    echo "⚠️  有 $fail_count 个检查失败"
    echo "查看详细结果: $RESULTS_FILE"
    exit 1
fi