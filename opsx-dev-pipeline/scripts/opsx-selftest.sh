#!/usr/bin/env bash
# 在临时 git + OpenSpec 仓库中依次执行本目录下各 opsx-*.sh（不含本文件），断言退出码与预期输出。
# 依赖：git、openspec、python3（与 opsx-instructions.sh 省略 artifact 时一致）。
# 可选：KEEP_TMP=1 成功结束时打印临时目录路径（不删除）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF_BASENAME="opsx-selftest.sh"
CHANGE_NAME="opsx-selftest-change"

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

# --- 各命令（按依赖顺序）；不测试本文件 ---
expect_ok "opsx-new-change.sh" "${SCRIPT_DIR}/opsx-new-change.sh" "$CHANGE_NAME"
write_valid_delta

expect_stdout_contains "opsx-preflight.sh 输出 ok" "ok" "${SCRIPT_DIR}/opsx-preflight.sh"

expect_stdout_contains "opsx-list-changes.sh 含 change 名" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh"

expect_stdout_contains "opsx-list-changes.sh 透传 --sort name" "$CHANGE_NAME" "${SCRIPT_DIR}/opsx-list-changes.sh" --sort name

expect_stdout_contains "opsx-change-status.sh JSON" "\"changeName\"" "${SCRIPT_DIR}/opsx-change-status.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh 无 artifact（ready 推断）" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-instructions.sh proposal" "\"artifactId\"" "${SCRIPT_DIR}/opsx-instructions.sh" "$CHANGE_NAME" proposal

expect_stdout_contains "opsx-instructions-apply.sh" "\"changeName\"" "${SCRIPT_DIR}/opsx-instructions-apply.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-validate-change.sh 通过" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME"

expect_stdout_contains "opsx-validate-change.sh 透传 --strict" '"valid": true' "${SCRIPT_DIR}/opsx-validate-change.sh" "$CHANGE_NAME" --strict

# openspec validate --all 在当前版本中可能对 change 返回空 items 仍退出 0；预期：成功执行且输出为 JSON 摘要
expect_stdout_contains "opsx-validate-all.sh JSON 摘要" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh"

expect_stdout_contains "opsx-validate-all.sh 透传 --strict" '"summary"' "${SCRIPT_DIR}/opsx-validate-all.sh" --strict

expect_stdout_contains "opsx-archive.sh -y 归档成功" "archived" "${SCRIPT_DIR}/opsx-archive.sh" "$CHANGE_NAME" -y

echo ""
echo "opsx-selftest: 全部通过（本目录除 $SELF_BASENAME 外每条 opsx-*.sh 均已执行且符合预期）。"
