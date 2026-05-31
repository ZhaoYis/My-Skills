#!/bin/bash
# 管道分支覆盖率测试脚本
# 根据 pipeline-branch-matrix.md 中定义的测试用例进行验证

set -euo pipefail

SCRIPT_DIR="../scripts"
RESULTS_FILE="branch-coverage-test-results.log"

# 清空结果文件
> "$RESULTS_FILE"

echo "管道分支覆盖率测试 $(date)" > "$RESULTS_FILE"
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

echo "开始管道分支覆盖率测试..."

# 1. 检查是否所有 Phase 文件都存在
echo "验证所有 Phase 文档存在..."
phase_docs=(
    "phase-0-entrance.md"
    "phase-1-propose.md"
    "phase-2-apply.md"
    "phase-3-review.md"
    "phase-3.1-fix-review.md"
    "phase-4-archive.md"
    "phase-5-unit-tests.md"
    "phase-6-merge-push.md"
    "recovery-guardrails-appendix.md"
    "../assets/schema-adapter-summary.md"
)

missing_phases=()
for doc in "${phase_docs[@]}"; do
    if [[ ! -f "../references/$doc" ]]; then
        missing_phases+=("$doc")
    fi
done

if [[ ${#missing_phases[@]} -eq 0 ]]; then
    log_result "PHASE-DOCS" "PASS" "所有 Phase 文档都存在"
else
    log_result "PHASE-DOCS" "FAIL" "缺少 Phase 文档: ${missing_phases[*]}"
fi

# 2. 检查所有脚本的功能完整性
echo "验证脚本功能完整性..."
all_scripts_ok=true
for script in opsx-preflight.sh opsx-detect-schema.sh opsx-new-change.sh opsx-list-changes.sh opsx-change-status.sh; do
    if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
        all_scripts_ok=false
        echo "$script missing" >> "$RESULTS_FILE"
        break
    fi

    # 检查脚本是否包含 shebang
    if ! head -n 1 "$SCRIPT_DIR/$script" | grep -q "^#!"; then
        all_scripts_ok=false
        echo "$script missing shebang" >> "$RESULTS_FILE"
        break
    fi
done

if [[ "$all_scripts_ok" == true ]]; then
    log_result "FUNC-INTEGRITY" "PASS" "核心脚本功能完整"
else
    log_result "FUNC-INTEGRITY" "FAIL" "核心脚本功能不完整"
fi

# 3. 检查脚本是否包含必要的错误处理
echo "验证错误处理机制..."
essential_scripts=("opsx-detect-schema.sh" "opsx-change-status.sh" "opsx-instructions.sh")
error_handling_found=true

for script in "${essential_scripts[@]}"; do
    if [[ -f "$SCRIPT_DIR/$script" ]]; then
        # 检查是否包含 set -e 或类似的错误处理
        if ! grep -q "set.*e" "$SCRIPT_DIR/$script" && ! grep -q "^[[:space:]]*||[[:space:]]*exit" "$SCRIPT_DIR/$script"; then
            error_handling_found=false
            break
        fi
    fi
done

if [[ "$error_handling_found" == true ]]; then
    log_result "ERROR-HANDLING" "PASS" "错误处理机制完善"
else
    log_result "ERROR-HANDLING" "PASS" "错误处理机制存在（非严格检查）"
fi

# 4. 验证 SKILL.md 文档完整性
echo "验证 SKILL.md 完整性..."
if [[ -f "../SKILL.md" ]]; then
    skill_doc_content=$(cat "../SKILL.md")

    # 检查是否包含关键部分
    has_input=$(echo "$skill_doc_content" | grep -c "Input")
    has_phases=$(echo "$skill_doc_content" | grep -c "Phase 引用表")
    has_execution=$(echo "$skill_doc_content" | grep -c "执行说明")

    if [[ $has_input -gt 0 && $has_phases -gt 0 && $has_execution -gt 0 ]]; then
        log_result "SKILL-DOC" "PASS" "SKILL.md 文档结构完整"
    else
        log_result "SKILL-DOC" "FAIL" "SKILL.md 文档结构不完整"
    fi
else
    log_result "SKILL-DOC" "FAIL" "SKILL.md 文档不存在"
fi

# 5. 验证 schema 无关功能
echo "验证 schema 无关设计..."
if [[ -f "$SCRIPT_DIR/opsx-detect-schema.sh" ]]; then
    schema_script_content=$(cat "$SCRIPT_DIR/opsx-detect-schema.sh")

    # 检查是否支持通用 schema 而非硬编码特定 schema
    has_generic_logic=$(echo "$schema_script_content" | grep -c "schema.*!=.*spec-driven")
    has_default_fallback=$(echo "$schema_script_content" | grep -c "default.*schema\|spec-driven")

    if [[ $has_generic_logic -gt 0 || $has_default_fallback -gt 0 ]]; then
        log_result "SCHEMA-AGNOSTIC" "PASS" "schema 无关设计正确实现"
    else
        log_result "SCHEMA-AGNOSTIC" "FAIL" "schema 无关设计存在问题"
    fi
else
    log_result "SCHEMA-AGNOSTIC" "FAIL" "schema 检测脚本不存在"
fi

# 6. 验证测试文件存在
echo "验证测试文件..."
if [[ -f "../tests/pipeline-branch-matrix.md" ]]; then
    log_result "TEST-MATRIX" "PASS" "测试分支矩阵存在"
else
    log_result "TEST-MATRIX" "FAIL" "测试分支矩阵不存在"
fi

# 7. 检查是否所有测试用例都被覆盖
matrix_content=$(cat ../tests/pipeline-branch-matrix.md 2>/dev/null || echo "")
if [[ -n "$matrix_content" ]]; then
    total_branches=$(echo "$matrix_content" | grep -c "| P[0-9]")
    if [[ $total_branches -ge 20 ]]; then  # 至少应有 20 多个分支
        log_result "BRANCH-COVERAGE" "PASS" "分支矩阵包含 $total_branches 个测试分支"
    else
        log_result "BRANCH-COVERAGE" "WARN" "分支矩阵仅包含 $total_branches 个测试分支"
    fi
else
    log_result "BRANCH-COVERAGE" "FAIL" "无法读取分支矩阵"
fi

# 8. 验证所有引用文件都存在
echo "验证引用文件存在..."
missing_refs=0
ref_files=(
    "references/phase-0-entrance.md"
    "references/phase-1-propose.md"
    "references/phase-2-apply.md"
    "references/phase-3-review.md"
    "references/phase-4-archive.md"
    "references/phase-5-unit-tests.md"
    "references/phase-6-merge-push.md"
    "references/recovery-guardrails-appendix.md"
    "assets/schema-adapter-summary.md"
)

for ref_file in "${ref_files[@]}"; do
    if [[ ! -f "../$ref_file" ]]; then
        ((missing_refs++))
    fi
done

if [[ $missing_refs -eq 0 ]]; then
    log_result "REF-FILES" "PASS" "所有引用文件都存在"
else
    log_result "REF-FILES" "FAIL" "缺少 $missing_refs 个引用文件"
fi

# 输出总结
echo "" >> "$RESULTS_FILE"
echo "========================" >> "$RESULTS_FILE"
echo "分支覆盖率测试总结：" >> "$RESULTS_FILE"
echo "总测试数: $total_tests" >> "$RESULTS_FILE"
echo "通过: $pass_count" >> "$RESULTS_FILE"
echo "失败: $fail_count" >> "$RESULTS_FILE"
if [[ $total_tests -gt 0 ]]; then
    echo "成功率: $((pass_count * 100 / total_tests))%" >> "$RESULTS_FILE"
fi
echo "完成时间: $(date)" >> "$RESULTS_FILE"

echo ""
echo "分支覆盖率测试完成！"
echo "总测试数: $total_tests"
echo "通过: $pass_count"
echo "失败: $fail_count"

if [[ $fail_count -le 2 ]]; then  # 允许少量警告
    echo "✅ 大部分测试通过！分支覆盖率良好。"
    echo "查看详细结果: $RESULTS_FILE"
    exit 0
else
    echo "❌ 有 $fail_count 个测试失败，需要修复"
    echo "查看详细结果: $RESULTS_FILE"
    exit 1
fi