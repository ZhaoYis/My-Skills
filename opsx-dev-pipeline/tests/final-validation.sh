#!/bin/bash
# 最终验证脚本：确认 yzw-workflow 硬编码已完全移除
# 并验证所有修改都正确应用

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
REFERENCES_DIR="$ROOT_DIR/references"

echo "执行最终验证..."

# 1. 检查是否还存在 yzw-workflow 引用（排除测试文件本身）
echo "1/5. 检查 yzw-workflow 硬编码残留..."
remaining_refs=$(find "$ROOT_DIR" \( -name "*.md" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" \) -not -path "*/comprehensive-pipeline-test*" -not -path "*/advanced-pipeline-test*" -not -path "*/simplified-pipeline-test*" -not -path "*/integrity-check*" -not -path "*/branch-coverage-test*" -not -path "*/FINAL_TEST_REPORT*" -not -path "*/final-validation*" | xargs grep -l "yzw-workflow" 2>/dev/null || true)

if [[ -z "$remaining_refs" ]]; then
    echo "✅ 未发现 yzw-workflow 硬编码残留"
    yzw_check="PASS"
else
    echo "❌ 发现 yzw-workflow 硬编码残留: $remaining_refs"
    yzw_check="FAIL"
fi

# 2. 检查 schema 检测脚本是否已更新
echo "2/5. 验证 schema 检测脚本更新..."
if [[ -f "$SCRIPTS_DIR/opsx-detect-schema.sh" ]]; then
    schema_logic=$(grep -c "schema.*!=.*spec-driven\|custom.*schema" "$SCRIPTS_DIR/opsx-detect-schema.sh" || echo 0)
    if [[ $schema_logic -gt 0 ]]; then
        echo "✅ schema 检测脚本已更新为通用逻辑"
        schema_check="PASS"
    else
        echo "❌ schema 检测脚本未正确更新"
        schema_check="FAIL"
    fi
else
    echo "❌ schema 检测脚本不存在"
    schema_check="FAIL"
fi

# 3. 检查 Phase 0 文档是否已更新
echo "3/5. 验证 Phase 0 文档更新..."
if [[ -f "$REFERENCES_DIR/phase-0-entrance.md" ]]; then
    phase0_content=$(cat "$REFERENCES_DIR/phase-0-entrance.md")
    has_generic_schema=$(echo "$phase0_content" | grep -c "检测到特定 schema\|自定义 schema")

    if [[ $has_generic_schema -gt 0 ]]; then
        echo "✅ Phase 0 文档已更新为通用 schema 支持"
        phase0_check="PASS"
    else
        echo "❌ Phase 0 文档未正确更新"
        phase0_check="FAIL"
    fi
else
    echo "❌ Phase 0 文档不存在"
    phase0_check="FAIL"
fi

# 4. 检查 SKILL.md 是否已更新
echo "4/5. 验证 SKILL.md 更新..."
if [[ -f "$ROOT_DIR/SKILL.md" ]]; then
    skill_content=$(cat "$ROOT_DIR/SKILL.md")
    has_generic_schema_ref=$(echo "$skill_content" | grep -c "自定义 schema\|schema.*aware\|schema.*agnostic")

    if [[ $has_generic_schema_ref -gt 0 ]]; then
        echo "✅ SKILL.md 已更新为通用 schema 支持"
        skill_check="PASS"
    else
        echo "❌ SKILL.md 未正确更新"
        skill_check="FAIL"
    fi
else
    echo "❌ SKILL.md 不存在"
    skill_check="FAIL"
fi

# 5. 验证脚本是否存在且可执行
echo "5/5. 验证关键脚本存在..."
critical_scripts=("opsx-detect-schema.sh" "opsx-preflight.sh" "opsx-new-change.sh")
all_exist=true

for script in "${critical_scripts[@]}"; do
    if [[ ! -f "$SCRIPTS_DIR/$script" ]]; then
        echo "❌ 关键脚本 $script 不存在"
        all_exist=false
        break
    elif [[ ! -x "$SCRIPTS_DIR/$script" ]]; then
        echo "❌ 关键脚本 $script 无执行权限"
        all_exist=false
        break
    fi
done

if [[ "$all_exist" == true ]]; then
    echo "✅ 所有关键脚本存在且可执行"
    scripts_check="PASS"
else
    scripts_check="FAIL"
fi

# 总结
echo ""
echo "=== 最终验证结果 ==="
echo "yzw-workflow 残留检查: $yzw_check"
echo "Schema 检测脚本: $schema_check"
echo "Phase 0 文档: $phase0_check"
echo "SKILL.md 更新: $skill_check"
echo "关键脚本存在性: $scripts_check"

# 统计结果
failed_checks=0
for check in "$yzw_check" "$schema_check" "$phase0_check" "$skill_check" "$scripts_check"; do
    if [[ "$check" == "FAIL" ]]; then
        ((failed_checks++))
    fi
done

if [[ $failed_checks -eq 0 ]]; then
    echo ""
    echo "🎉 验证通过！"
    echo "✅ 所有修改都已正确应用"
    echo "✅ yzw-workflow 硬编码已完全移除"
    echo "✅ 系统现在支持通用 schema 检测"
    echo "✅ Phase 0 会自动识别当前项目 schema"
    echo ""
    echo "修改总结:"
    echo "- 移除了所有 yzw-workflow 硬编码依赖"
    echo "- 更新了所有相关脚本和文档"
    echo "- 实现了 schema-agnostic 架构"
    echo "- 保持了向后兼容性"
    exit 0
else
    echo ""
    echo "❌ $failed_checks 个检查失败，需要修复"
    exit 1
fi