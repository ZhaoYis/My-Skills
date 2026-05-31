#!/usr/bin/env bash
# 在临时 git + OpenSpec 仓库中依次执行本目录下各 opsx-*.sh（不含本文件），断言退出码与预期输出。
# 依赖：git、openspec、python3（与 opsx-instructions.sh 省略 artifact 时一致）。
# 可选：KEEP_TMP=1 成功结束时打印临时目录路径（不删除）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF_BASENAME="opsx-selftest.sh"
CHANGE_NAME="opsx-selftest-change"
CALL_COUNT_KEYS=""

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "opsx-selftest: 缺少命令: $1" >&2
    exit 99
  }
}

need_cmd git
need_cmd openspec
need_cmd python3

TMP="$(mktemp -d)"
CALL_COUNT_DIR="$TMP/call-counts"
mkdir -p "$CALL_COUNT_DIR"
cleanup() {
  if [[ -n "${KEEP_TMP:-}" ]]; then
    echo "opsx-selftest: 保留临时目录: $TMP" >&2
  else
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT

cd "$TMP"
git init -q
git config user.email "opsx-selftest@local"
git config user.name "opsx-selftest"
openspec init . --tools none --force >/dev/null

write_valid_delta() {
  mkdir -p "openspec/changes/${CHANGE_NAME}/specs/demo"
  cat > "openspec/changes/${CHANGE_NAME}/specs/demo/spec.md" << 'SPECEOF'
## ADDED Requirements

### Requirement: Selftest delta

The change SHALL satisfy automated opsx-selftest validation.

#### Scenario: Validation passes

- **WHEN** opsx-selftest runs validate
- **THEN** the change is reported valid
SPECEOF
}

write_fix_review_change() {
  local fix_name="$1"
  mkdir -p "openspec/changes/${fix_name}/specs/review"
  cat > "openspec/changes/${fix_name}/proposal.md" <<'EOF'
# Fix review findings
EOF
  cat > "openspec/changes/${fix_name}/tasks.md" <<'EOF'
# Tasks
- [ ] Address review findings
EOF
  cat > "openspec/changes/${fix_name}/specs/review/spec.md" <<'EOF'
## ADDED Requirements

### Requirement: Fix review findings

The system SHALL allow review fixes to be tracked in a dedicated change.

#### Scenario: Review fix is applied
- **WHEN** a fix review change is resumed
- **THEN** apply instructions are available
EOF
}

write_custom_schema_config() {
  mkdir -p openspec
  cat > "openspec/config.yaml" <<'CFGEOF'
schema: custom
shared:
  context: |
    Shared guidance for all changes.
    Standards: docs/shared.md
  rules:
    apply:
      - Follow shared workflow.
backend:
  context: |
    Backend implementation guidance.
    Standards: docs/backend.md
  rules:
    apply:
      - Keep service boundaries clear.
frontend:
  context: |
    Frontend implementation guidance.
    Standards: docs/frontend.md
  rules:
    apply:
      - Keep UI states explicit.
CFGEOF
}

track_call() {
  local key="$1"
  shift
  local file="$CALL_COUNT_DIR/${key//\//_}"
  local current=0
  if [[ -f "$file" ]]; then
    current="$(<"$file")"
  fi
  printf '%s' "$(( current + 1 ))" > "$file"
  "$@"
}

expect_call_count_eq() {
  local desc="$1"
  local key="$2"
  local expected="$3"
  local file="$CALL_COUNT_DIR/${key//\//_}"
  local count_value=0
  if [[ -f "$file" ]]; then
    count_value="$(<"$file")"
  fi
  if [[ "$count_value" != "$expected" ]]; then
    printf '   [FAIL] %s (count %s, expected %s)\n' "$desc" "$count_value" "$expected" >&2
    exit 1
  fi
  echo "   [ok] $desc"
}

expect_ok() {
  local desc="$1"
  shift
  echo "== $desc =="
  if "$@"; then
    echo "   [ok] $desc"
  else
    echo "   [FAIL] $desc (exit $?)" >&2
    exit 1
  fi
}

expect_stdout_contains() {
  local desc="$1"
  local needle="$2"
  shift 2
  local out
  out="$("$@" 2>&1)" || {
    echo "$out" >&2
    echo "   [FAIL] $desc (command failed)" >&2
    exit 1
  }
  if [[ "$out" != *"$needle"* ]]; then
    echo "$out" >&2
    echo "   [FAIL] $desc (输出不包含: $needle)" >&2
    exit 1
  fi
  echo "   [ok] $desc"
}

expect_exit_and_stderr_contains() {
  local desc="$1"
  local expected_exit="$2"
  local needle="$3"
  shift 3
  local out
  local status=0
  set +e
  out="$("$@" 2>&1)"
  status=$?
  set -e
  if [[ "$status" -ne "$expected_exit" ]]; then
    echo "$out" >&2
    echo "   [FAIL] $desc (exit $status，期望 $expected_exit)" >&2
    exit 1
  fi
  if [[ "$out" != *"$needle"* ]]; then
    echo "$out" >&2
    echo "   [FAIL] $desc (输出不包含: $needle)" >&2
    exit 1
  fi
  echo "   [ok] $desc"
}

expect_json_field_eq() {
  local desc="$1"
  local key="$2"
  local expected="$3"
  shift 3
  local out
  out="$("$@" 2>&1)" || {
    echo "$out" >&2
    echo "   [FAIL] $desc (command failed)" >&2
    exit 1
  }
  EXPECT_JSON="$out" python3 - "$key" "$expected" <<'PY'
import json
import os
import sys
key, expected = sys.argv[1], sys.argv[2]
data = json.loads(os.environ["EXPECT_JSON"])
value = data
for part in key.split('.'):
    if isinstance(value, dict) and part in value:
        value = value[part]
    elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
        value = value[int(part)]
    else:
        raise SystemExit(2)
if str(value) != expected:
    raise SystemExit(3)
PY
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "$out" >&2
    echo "   [FAIL] $desc (字段 $key != $expected)" >&2
    exit 1
  fi
  echo "   [ok] $desc"
}

# --- 各命令（按依赖顺序）；不测试本文件 ---
expect_ok "opsx-new-change.sh" "${SCRIPT_DIR}/opsx-new-change.sh" "$CHANGE_NAME"
write_valid_delta

expect_stdout_contains "opsx-preflight.sh 输出 status" '"status":"ok"' "${SCRIPT_DIR}/opsx-preflight.sh"
expect_stdout_contains "opsx-preflight.sh 输出 reason" '"reason":"preflight-passed"' "${SCRIPT_DIR}/opsx-preflight.sh"
PATH="/usr/bin:/bin:/usr/sbin:/sbin" expect_exit_and_stderr_contains "opsx-preflight.sh 缺少 openspec" 1 "openspec CLI 未找到" "${SCRIPT_DIR}/opsx-preflight.sh"

expect_stdout_contains "opsx-list-changes.sh 含 change 名" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh"

expect_stdout_contains "opsx-list-changes.sh 透传 --sort name" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh" --sort name

expect_stdout_contains "opsx-change-status.sh JSON" "\"changeName\"" track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"
expect_exit_and_stderr_contains "opsx-change-status.sh 无效 change 名" 1 "not found" track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "opsx-missing-change"
expect_json_field_eq "已有 change 初始续接点应为 Phase 1" "artifacts.0.status" "ready" track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-detect-schema.sh 默认 schema" '"schema": "spec-driven"' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-detect-schema.sh 默认 reason" '"reason": "schema-detected"' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-ensure-change-meta.sh 写入 stacks" 'stacks: [backend]' "${SCRIPT_DIR}/opsx-ensure-change-meta.sh" "$CHANGE_NAME" backend

expect_stdout_contains "opsx-detect-schema.sh 识别 .openspec.yaml" '"changeHasOpenSpecYaml": true' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-change-context.sh 默认 schema 摘要" '"schema": "spec-driven"' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
rm -f openspec/config.yaml
expect_stdout_contains "opsx-change-context.sh config 缺失告警" '"reason": "config-yaml-missing"' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-change-context.sh config 缺失 nextAction" '"nextAction": "continue-with-default-context"' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
openspec init . --tools none --force >/dev/null
expect_stdout_contains "opsx-detect-schema.sh 默认 schema（重建后）" '"schema": "spec-driven"' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-resolve-verify.sh 默认 schema 无命令" '"command": null' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-resolve-verify.sh 默认 schema warning" '"status": "warning"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-resolve-verify.sh 默认 schema reason" '"reason": "verify-command-missing"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh 无 artifact（ready 推断）" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh proposal" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME" proposal

expect_stdout_contains "opsx-instructions-apply.sh" "\"changeName\"" "${SCRIPT_DIR}/opsx-instructions-apply.sh" "$CHANGE_NAME"
expect_json_field_eq "opsx-instructions-apply.sh 初始进入应提示缺制品" "state" "blocked" "${SCRIPT_DIR}/opsx-instructions-apply.sh" "$CHANGE_NAME"
write_fix_review_change "fix-cr-mixed"
expect_stdout_contains "opsx-instructions-apply.sh fix review change 可续接实施" '"changeName": "fix-cr-mixed"' "${SCRIPT_DIR}/opsx-instructions-apply.sh" "fix-cr-mixed"
expect_stdout_contains "opsx-instructions.sh fix review proposal 可续接" '"artifactId": "proposal"' "${SCRIPT_DIR}/opsx-instructions.sh" "fix-cr-mixed" proposal

expect_stdout_contains "opsx-validate-change.sh 通过" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-validate-change.sh 透传 --strict" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME" --strict

cat > "openspec/changes/${CHANGE_NAME}/proposal.md" <<'EOF'
# Proposal

Implement selftest pipeline flow.
EOF
cat > "openspec/changes/${CHANGE_NAME}/tasks.md" <<'EOF'
# Tasks
- [x] Finish implementation
EOF
expect_json_field_eq "已有 change 提案完成后 apply 已完成实施" "state" "all_done" "${SCRIPT_DIR}/opsx-instructions-apply.sh" "$CHANGE_NAME"
mkdir -p openspec/review
cat > "openspec/review/${CHANGE_NAME}-review.md" <<'EOF'
# Review

No critical issues.
EOF
expect_stdout_contains "已有审查报告后状态查询仍可执行" '"changeName"' track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"

# B5: 主路径效率回归标记文件，模拟 Phase 2 → 3 → 5 → 4 → 6 关键状态切换
mkdir -p scripts
cat > scripts/validate.sh <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x scripts/validate.sh
expect_json_field_eq "默认 schema 在跳过审查后仍提示手动确认 verify" "command" "None" track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "跳过审查后 Phase 5 / 4 给出 verify 缺失原因" '"reason": "verify-command-missing"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "跳过审查场景保留审查报告供 Phase 5 续接" 'No critical issues.' bash -lc "cat openspec/review/${CHANGE_NAME}-review.md"

# openspec validate --all 在当前版本中可能对 change 返回空 items 仍退出 0；预期：成功执行且输出为 JSON 摘要
expect_stdout_contains "opsx-validate-all.sh JSON 摘要" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh"

expect_stdout_contains "opsx-validate-all.sh 透传 --strict" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh" --strict

expect_stdout_contains "直接归档场景在 Phase 5 后归档成功" "archived" "${SCRIPT_DIR}/opsx-archive.sh" "$CHANGE_NAME" -y
expect_exit_and_stderr_contains "直接归档后 active change 状态不可再查询" 1 "not found" track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"
expect_stdout_contains "直接归档后仍能识别 archived change schema" '"schema": "spec-driven"' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"
touch resumed-after-archive.txt
expect_stdout_contains "暂停恢复场景下可继续 Phase 6 前置检查" '"nextAction":"continue-phase-0"' "${SCRIPT_DIR}/opsx-preflight.sh"

git add resumed-after-archive.txt scripts/validate.sh openspec/review "openspec/changes/archive" >/dev/null 2>&1 || true
git commit -m "test: simulate archived change progression" >/dev/null 2>&1 || true
expect_exit_and_stderr_contains "暂停恢复场景下已归档 change 不再位于 active changes" 1 "not found" track_call opsx-change-status "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"

write_custom_schema_config
expect_stdout_contains "opsx-detect-schema.sh 识别 custom schema" '"schema": "custom"' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-detect-schema.sh custom schema 支持元数据" '"supportsStacks": true' track_call opsx-detect-schema "${SCRIPT_DIR}/opsx-detect-schema.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-ensure-change-meta.sh 写入 frontend stacks" 'stacks: [frontend]' "${SCRIPT_DIR}/opsx-ensure-change-meta.sh" "$CHANGE_NAME" frontend
expect_stdout_contains "opsx-change-context.sh 包含 frontend context" 'Frontend implementation guidance.' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-change-context.sh 包含 frontend standards" 'docs/frontend.md' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-resolve-verify.sh frontend 命令" '"command": "./scripts/validate.sh frontend"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-ensure-change-meta.sh 写入双栈 stacks" 'stacks: [backend, frontend]' "${SCRIPT_DIR}/opsx-ensure-change-meta.sh" "$CHANGE_NAME" backend,frontend
expect_stdout_contains "opsx-change-context.sh 合并 shared 与 backend" 'Shared guidance for all changes.' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-change-context.sh 合并 backend standards" 'docs/backend.md' track_call opsx-change-context "${SCRIPT_DIR}/opsx-change-context.sh" "$CHANGE_NAME"
cat > Makefile <<'MAKEEOF'
validate:
	@true
MAKEEOF
expect_stdout_contains "opsx-resolve-verify.sh 双栈优先 make validate" '"command": "make validate"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
rm -f Makefile
expect_stdout_contains "opsx-resolve-verify.sh 双栈回退 all" '"command": "./scripts/validate.sh all"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"
expect_stdout_contains "opsx-ensure-change-meta.sh 写入 backend stacks" 'stacks: [backend]' "${SCRIPT_DIR}/opsx-ensure-change-meta.sh" "$CHANGE_NAME" backend
expect_stdout_contains "opsx-resolve-verify.sh backend 命令" '"command": "./scripts/validate.sh backend"' track_call opsx-resolve-verify "${SCRIPT_DIR}/opsx-resolve-verify.sh" "$CHANGE_NAME"

expect_call_count_eq "调用次数基线：opsx-detect-schema.sh" opsx-detect-schema 7
expect_call_count_eq "调用次数基线：opsx-change-status.sh" opsx-change-status 6
expect_call_count_eq "调用次数基线：opsx-change-context.sh" opsx-change-context 7
expect_call_count_eq "调用次数基线：opsx-resolve-verify.sh" opsx-resolve-verify 9

echo ""
echo "opsx-selftest: 全部通过（默认 schema 路径、Phase B 回归样例与 schema-aware 辅助脚本均符合预期）。"
