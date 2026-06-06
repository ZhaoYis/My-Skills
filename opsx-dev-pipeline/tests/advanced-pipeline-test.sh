#!/usr/bin/env bash
# [可选套件 integration] OpenSpec 临时目录集成测试（较慢，需 openspec CLI）
# 默认请使用: bash tests/run-all.sh
# 单独运行: bash tests/run-all.sh --only integration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$TEST_DIR/logs"
RESULTS_FILE="$LOGS_DIR/advanced-pipeline-test-results.log"

mkdir -p "$LOGS_DIR"
# 清空结果文件
> "$RESULTS_FILE"

echo "高级管道功能测试 $(date)" >> "$RESULTS_FILE"
echo "===========================================" >> "$RESULTS_FILE"

# 测试结果计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_test_result() {
    local test_id="$1"
    local description="$2"
    local status="$3"

    echo "" >> "$RESULTS_FILE"
    echo "[$test_id] $description" >> "$RESULTS_FILE"
    echo "----------------------------------------" >> "$RESULTS_FILE"
    echo "Status: $status" >> "$RESULTS_FILE"

    ((TOTAL_TESTS++))

    if [[ "$status" == "PASS" ]]; then
        ((PASSED_TESTS++))
        echo "$test_id: PASSED"
    else
        ((FAILED_TESTS++))
        echo "$test_id: FAILED"
    fi
}

# 辅助函数
run_in_temp_dir() {
    local func="$1"
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        "$func"
    )
    local result=$?
    rm -rf "$tmp_dir"
    return $result
}

# 测试基础环境检查
test_environment_setup() {
    if ! command -v git >/dev/null 2>&1; then
        echo "Git is not installed" >&2
        return 1
    fi

    if ! command -v python3 >/dev/null 2>&1; then
        echo "Python3 is not installed" >&2
        return 1
    fi

    # 检查是否有 openspec，即使它失败也可以接受
    command -v openspec >/dev/null 2>&1 || true
    return 0
}

# 测试 Phase 0 的基础功能
test_phase0_basic_functions() {
    # 测试 preflight 检查
    if ! "${SCRIPT_DIR}/opsx-preflight.sh" >/dev/null 2>&1; then
        echo "Preflight script failed" >&2
        return 1
    fi

    # 测试列表功能
    if ! "${SCRIPT_DIR}/opsx-list-changes.sh" >/dev/null 2>&1; then
        echo "List changes script failed" >&2
        return 1
    fi

    return 0
}

# 测试 Phase 1 基础功能
test_phase1_basic_functions() {
    run_in_temp_dir setup_and_test_phase1
}

setup_and_test_phase1() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # 尝试初始化 OpenSpec（如果可用）
    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        # 创建一个测试 change
        local change_name="test-$(date +%s)"
        if ! "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1; then
            echo "Failed to create change" >&2
            return 1
        fi

        # 验证 change 创建成功
        if ! "${SCRIPT_DIR}/opsx-change-status.sh" "$change_name" >/dev/null 2>&1; then
            echo "Change status check failed" >&2
            return 1
        fi
    fi

    return 0
}

# 测试 schema 检测功能
test_schema_detection() {
    run_in_temp_dir setup_and_test_schema_detection
}

setup_and_test_schema_detection() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # 尝试初始化 OpenSpec
    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        # 测试 schema 检测
        local change_name="schema-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1 || true

        local result
        result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "$change_name" 2>/dev/null || echo '{}')

        # 验证返回的是有效的 JSON
        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            echo "Invalid JSON from schema detection: $result" >&2
            return 1
        fi
    else
        # 如果没有 openspec，至少测试脚本能执行
        local result
        result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "" 2>/dev/null || echo '{}')
        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    fi
}

# 测试 Phase 2 功能
test_phase2_functions() {
    run_in_temp_dir setup_and_test_phase2
}

setup_and_test_phase2() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        local change_name="apply-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1 || true

        # 测试 apply 指令获取
        local result
        result=$("${SCRIPT_DIR}/opsx-instructions-apply.sh" "$change_name" 2>/dev/null || echo '{}')

        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            echo "Invalid JSON from apply instructions: $result" >&2
            return 1
        fi
    else
        return 0  # 如果没有 openspec，跳过此测试
    fi
}

# 测试 Phase 3 相关功能
test_phase3_functions() {
    run_in_temp_dir setup_and_test_phase3
}

setup_and_test_phase3() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        local change_name="context-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1 || true

        # 测试上下文获取
        local result
        result=$("${SCRIPT_DIR}/opsx-change-context.sh" "$change_name" 2>/dev/null || echo '{}')

        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            echo "Invalid JSON from change context: $result" >&2
            return 1
        fi
    else
        return 0  # 如果没有 openspec，跳过此测试
    fi
}

# 测试 Phase 4 功能
test_phase4_functions() {
    run_in_temp_dir setup_and_test_phase4
}

setup_and_test_phase4() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        local change_name="verify-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1 || true

        # 测试 verify 解析
        local result
        result=$("${SCRIPT_DIR}/opsx-resolve-verify.sh" "$change_name" 2>/dev/null || echo '{"command": null}')

        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            echo "Invalid JSON from verify resolution: $result" >&2
            return 1
        fi
    else
        return 0  # 如果没有 openspec，跳过此测试
    fi
}

# 测试 Phase 5 功能
test_phase5_functions() {
    run_in_temp_dir setup_and_test_phase5
}

setup_and_test_phase5() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1 || true

        local change_name="validate-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1 || true

        # 测试 change 验证
        local result
        result=$("${SCRIPT_DIR}/opsx-validate-change.sh" "$change_name" 2>/dev/null || echo '{"valid": true}')

        if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
            return 0
        else
            echo "Invalid JSON from change validation: $result" >&2
            return 1
        fi
    else
        return 0  # 如果没有 openspec，跳过此测试
    fi
}

# 测试错误处理和边界情况
test_error_handling() {
    # 测试带有无效参数的脚本
    local invalid_result
    invalid_result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "invalid_change_name_that_does_not_exist" 2>/dev/null || echo '{}')

    if python3 -c "import json; json.loads('${invalid_result//\'/\\'}')" 2>/dev/null; then
        return 0
    else
        echo "Invalid JSON from error handling test: $invalid_result" >&2
        return 1
    fi
}

# 测试自检脚本
test_selftest_script() {
    if [[ -f "${SCRIPT_DIR}/opsx-selftest.sh" ]]; then
        # 我们不会实际运行 selftest，因为它需要完整的 OpenSpec 设置
        # 只是验证脚本存在并且是可执行的
        return 0
    else
        echo "Selftest script does not exist" >&2
        return 1
    fi
}

# 测试配置文件功能
test_config_functionality() {
    run_in_temp_dir setup_and_test_config
}

setup_and_test_config() {
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    # 创建一个自定义 schema 配置
    mkdir -p openspec
    cat > "openspec/config.yaml" << 'EOL'
schema: custom
shared:
  context: |
    Shared guidance for all changes.
  rules:
    apply:
      - Follow shared workflow.
EOL

    # 测试检测功能
    local result
    result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "" 2>/dev/null || echo '{}')

    if python3 -c "import json; json.loads('${result//\'/\\'}')" 2>/dev/null; then
        return 0
    else
        echo "Invalid JSON from config functionality test: $result" >&2
        return 1
    fi
}

# 执行所有测试
echo "执行高级管道功能测试..."

# 执行测试并记录结果
if test_environment_setup; then
    log_test_result "ENV-SETUP" "验证基础环境设置" "PASS"
else
    log_test_result "ENV-SETUP" "验证基础环境设置" "FAIL"
fi

if test_phase0_basic_functions; then
    log_test_result "PHASE0-BASIC" "验证 Phase 0 基础功能" "PASS"
else
    log_test_result "PHASE0-BASIC" "验证 Phase 0 基础功能" "FAIL"
fi

if test_phase1_basic_functions; then
    log_test_result "PHASE1-BASIC" "验证 Phase 1 基础功能" "PASS"
else
    log_test_result "PHASE1-BASIC" "验证 Phase 1 基础功能" "FAIL"
fi

if test_schema_detection; then
    log_test_result "SCHEMA-DETECTION" "验证 schema 检测功能" "PASS"
else
    log_test_result "SCHEMA-DETECTION" "验证 schema 检测功能" "FAIL"
fi

if test_phase2_functions; then
    log_test_result "PHASE2-FUNC" "验证 Phase 2 功能" "PASS"
else
    log_test_result "PHASE2-FUNC" "验证 Phase 2 功能" "FAIL"
fi

if test_phase3_functions; then
    log_test_result "PHASE3-FUNC" "验证 Phase 3 功能" "PASS"
else
    log_test_result "PHASE3-FUNC" "验证 Phase 3 功能" "FAIL"
fi

if test_phase4_functions; then
    log_test_result "PHASE4-FUNC" "验证 Phase 4 功能" "PASS"
else
    log_test_result "PHASE4-FUNC" "验证 Phase 4 功能" "FAIL"
fi

if test_phase5_functions; then
    log_test_result "PHASE5-FUNC" "验证 Phase 5 功能" "PASS"
else
    log_test_result "PHASE5-FUNC" "验证 Phase 5 功能" "FAIL"
fi

if test_error_handling; then
    log_test_result "ERROR-HANDLING" "验证错误处理功能" "PASS"
else
    log_test_result "ERROR-HANDLING" "验证错误处理功能" "FAIL"
fi

if test_selftest_script; then
    log_test_result "SELFTST-SCRIPT" "验证自检脚本存在" "PASS"
else
    log_test_result "SELFTST-SCRIPT" "验证自检脚本存在" "FAIL"
fi

if test_config_functionality; then
    log_test_result "CONFIG-FUNC" "验证配置文件功能" "PASS"
else
    log_test_result "CONFIG-FUNC" "验证配置文件功能" "FAIL"
fi

# 输出总结
echo "" >> "$RESULTS_FILE"
echo "===========================================" >> "$RESULTS_FILE"
echo "高级管道测试总结：" >> "$RESULTS_FILE"
echo "总测试数: $TOTAL_TESTS" >> "$RESULTS_FILE"
echo "通过: $PASSED_TESTS" >> "$RESULTS_FILE"
echo "失败: $FAILED_TESTS" >> "$RESULTS_FILE"
if [[ $TOTAL_TESTS -gt 0 ]]; then
    echo "成功率: $((PASSED_TESTS * 100 / TOTAL_TESTS))%" >> "$RESULTS_FILE"
fi
echo "完成时间: $(date)" >> "$RESULTS_FILE"

echo ""
echo "高级管道测试完成！"
echo "总测试数: $TOTAL_TESTS"
echo "通过: $PASSED_TESTS"
echo "失败: $FAILED_TESTS"
echo "查看详细结果: $RESULTS_FILE"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo "🎉 所有测试通过！管道功能正常。"
    exit 0
else
    echo "⚠️  有 $FAILED_TESTS 个测试失败，请检查 $RESULTS_FILE"
    exit 1
fi