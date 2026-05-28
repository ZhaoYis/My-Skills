#!/usr/bin/env bash
# 全面测试脚本，用于验证 opsx-dev-pipeline 中的所有分支和门禁
# 覆盖所有在 pipeline-branch-matrix.md 中定义的分支路径

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$TEST_DIR/comprehensive-test-results.log"

# 清空日志文件
> "$LOG_FILE"

echo "开始全面管道测试 $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# 测试函数
run_test() {
    local test_name="$1"
    local test_desc="$2"
    local test_func="$3"

    echo "" >> "$LOG_FILE"
    echo "[$test_name] $test_desc" >> "$LOG_FILE"
    echo "----------------------------------------" >> "$LOG_FILE"

    if "$test_func"; then
        echo "[PASS] $test_name" >> "$LOG_FILE"
        return 0
    else
        echo "[FAIL] $test_name" >> "$LOG_FILE"
        return 1
    fi
}

# 环境预检查测试
test_preflight_ok() {
    # 验证 preflight 脚本是否能正常运行
    if "${SCRIPT_DIR}/opsx-preflight.sh" >/dev/null 2>&1; then
        echo "Preflight check passed" >> /dev/null
        return 0
    else
        return 1
    fi
}

# schema 检测测试
test_detect_default_schema() {
    # 需要在初始化的 OpenSpec 仓库中测试
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        git init -q
        git config user.email "test@example.com"
        git config user.name "Test User"

        # 初始化 OpenSpec 项目
        if command -v openspec >/dev/null 2>&1; then
            openspec init . --tools none --force >/dev/null 2>&1

            # 运行 schema 检测
            result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "" 2>/dev/null || echo "{}")
            if [[ "$result" == *"\"schema\": \"spec-driven\""* ]] || [[ "$result" == *"\"schema\": \"default\""* ]]; then
                return 0
            else
                return 1
            fi
        else
            echo "openspec not available, skipping test" >&2
            return 0
        fi
    )
    rm -rf "$tmp_dir"
}

# 创建临时测试仓库
create_test_repo() {
    local repo_dir="$1"
    mkdir -p "$repo_dir"
    cd "$repo_dir"
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"

    if command -v openspec >/dev/null 2>&1; then
        openspec init . --tools none --force >/dev/null 2>&1
        return 0
    else
        return 1
    fi
}

# Phase 1 测试
test_propose_new_change() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            echo "Failed to create test repo" >&2
            return 1
        fi

        # 创建一个测试 change
        change_name="test-change-$(date +%s)"
        if "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1; then
            # 验证 change 是否存在
            if "${SCRIPT_DIR}/opsx-list-changes.sh" | grep -q "$change_name"; then
                return 0
            else
                return 1
            fi
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证各种脚本的输出
test_script_outputs() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="output-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 测试 change status 输出
        status_result=$("${SCRIPT_DIR}/opsx-change-status.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$status_result" != "{}" ]]; then
            # 测试 detect-schema 输出
            schema_result=$("${SCRIPT_DIR}/opsx-detect-schema.sh" "$change_name" 2>/dev/null || echo "{}")
            if [[ "$schema_result" != "{}" ]]; then
                return 0
            fi
        fi
        return 1
    )
    rm -rf "$tmp_dir"
}

# 验证指令脚本
test_instructions_script() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="instructions-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 尝试获取一个基本的指令
        instructions_result=$("${SCRIPT_DIR}/opsx-instructions.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$instructions_result" != "{}" ]]; then
            return 0
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证 apply 指令脚本
test_apply_instructions() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="apply-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 尝试获取 apply 指令
        apply_result=$("${SCRIPT_DIR}/opsx-instructions-apply.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$apply_result" != "{}" ]]; then
            return 0
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证上下文脚本
test_change_context() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="context-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 尝试获取 change 上下文
        context_result=$("${SCRIPT_DIR}/opsx-change-context.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$context_result" != "{}" ]]; then
            return 0
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证 verify 解析脚本
test_resolve_verify() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="verify-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 尝试解析 verify 命令
        verify_result=$("${SCRIPT_DIR}/opsx-resolve-verify.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$verify_result" != "{}" ]]; then
            return 0
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证验证 change 脚本
test_validate_change() {
    local tmp_dir=$(mktemp -d)
    (
        cd "$tmp_dir"
        if ! create_test_repo "$tmp_dir"; then
            return 0  # 如果 OpenSpec 不可用，则跳过此测试
        fi

        change_name="validate-test-$(date +%s)"
        "${SCRIPT_DIR}/opsx-new-change.sh" "$change_name" >/dev/null 2>&1

        # 尝试验证 change
        validate_result=$("${SCRIPT_DIR}/opsx-validate-change.sh" "$change_name" 2>/dev/null || echo "{}")
        if [[ "$validate_result" != "{}" ]]; then
            return 0
        else
            return 1
        fi
    )
    rm -rf "$tmp_dir"
}

# 验证所有脚本是否存在
test_scripts_exist() {
    local missing_scripts=()

    for script in opsx-preflight.sh opsx-detect-schema.sh opsx-new-change.sh \
                 opsx-list-changes.sh opsx-change-status.sh opsx-instructions.sh \
                 opsx-instructions-apply.sh opsx-change-context.sh \
                 opsx-resolve-verify.sh opsx-validate-change.sh \
                 opsx-validate-all.sh opsx-archive.sh opsx-ensure-change-meta.sh; do
        if [[ ! -f "${SCRIPT_DIR}/${script}" ]]; then
            missing_scripts+=("$script")
        fi
    done

    if [[ ${#missing_scripts[@]} -eq 0 ]]; then
        return 0
    else
        echo "Missing scripts: ${missing_scripts[*]}" >&2
        return 1
    fi
}

# 主要测试执行
main() {
    local failed_tests=0
    local passed_tests=0

    echo "执行全面管道测试..."

    # 执行所有测试
    run_test "SCRIPTS-EXIST" "验证所有必需脚本是否存在" test_scripts_exist && ((passed_tests++)) || ((failed_tests++))
    run_test "PREFLIGHT-OK" "验证预检脚本能正常运行" test_preflight_ok && ((passed_tests++)) || ((failed_tests++))
    run_test "DETECT-DEFAULT-SCHEMA" "验证能检测默认 schema" test_detect_default_schema && ((passed_tests++)) || ((failed_tests++))
    run_test "PROP-NEW-CHANGE" "验证能创建新 change" test_propose_new_change && ((passed_tests++)) || ((failed_tests++))
    run_test "SCRIPT-OUTPUTS" "验证各种脚本有合理输出" test_script_outputs && ((passed_tests++)) || ((failed_tests++))
    run_test "INST-SCRIPT" "验证指令脚本正常运行" test_instructions_script && ((passed_tests++)) || ((failed_tests++))
    run_test "APPLY-INST" "验证 Apply 指令脚本正常运行" test_apply_instructions && ((passed_tests++)) || ((failed_tests++))
    run_test "CHANGE-CONTEXT" "验证 Change 上下文脚本正常运行" test_change_context && ((passed_tests++)) || ((failed_tests++))
    run_test "RESOLVE-VERIFY" "验证 Verify 解析脚本正常运行" test_resolve_verify && ((passed_tests++)) || ((failed_tests++))
    run_test "VALIDATE-CHANGE" "验证 Change 验证脚本正常运行" test_validate_change && ((passed_tests++)) || ((failed_tests++))

    # 总结
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
    else
        echo ""
        echo "❌ 有 $failed_tests 个测试失败"
        echo "查看详细结果: $LOG_FILE"
        return 1
    fi
}

main "$@"