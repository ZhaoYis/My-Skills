#!/usr/bin/env bash

readonly EXIT_DEPENDENCY_MISSING=1
readonly EXIT_NOT_GIT_REPO=2
readonly EXIT_OPENSPEC_NOT_INITIALIZED=3
readonly EXIT_INVALID_INPUT=4
readonly EXIT_COMMAND_FAILED=5
readonly EXIT_INVALID_OUTPUT=6

json_escape() {
  local value="${1-}"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  printf '%s' "$value"
}

emit_error() {
  local reason="$1"
  local detail="$2"
  local next_action="$3"
  local exit_code="$4"

  printf '{"status":"error","reason":"%s","detail":"%s","nextAction":"%s"}\n' \
    "$(json_escape "$reason")" \
    "$(json_escape "$detail")" \
    "$(json_escape "$next_action")"
  exit "$exit_code"
}

require_command() {
  local command_name="$1"
  local reason="$2"
  local next_action="$3"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    emit_error "$reason" "找不到命令：$command_name" "$next_action" "$EXIT_DEPENDENCY_MISSING"
  fi
}

require_argument() {
  local label="$1"
  local value="${2-}"
  if [[ -z "$value" ]]; then
    emit_error \
      "missing-argument" \
      "缺少必需参数：$label" \
      "provide-required-argument" \
      "$EXIT_INVALID_INPUT"
  fi
}

cd_repo_root() {
  require_command git "git-cli-not-found" "install-git"

  local repo_root
  set +e
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
  local git_exit=$?
  set -e
  if [[ $git_exit -ne 0 || -z "$repo_root" ]]; then
    emit_error "not-a-git-repo" "当前目录不在 Git 仓库内" "init-git-or-cd" "$EXIT_NOT_GIT_REPO"
  fi

  cd "$repo_root"
}

validate_change_name() {
  local value="$1"
  if [[ ${#value} -gt 64 || "$value" == -* || "$value" == *- || ! "$value" =~ ^[a-z0-9-]+$ ]]; then
    emit_error \
      "invalid-change-name" \
      "change 名称必须是 1-64 位 kebab-case，且不能以连字符开头或结尾" \
      "choose-valid-change-name" \
      "$EXIT_INVALID_INPUT"
  fi
}

validate_identifier() {
  local label="$1"
  local value="$2"
  if [[ -z "$value" || ${#value} -gt 128 || "$value" == -* || ! "$value" =~ ^[A-Za-z0-9._-]+$ ]]; then
    emit_error \
      "invalid-identifier" \
      "$label 必须由字母、数字、点、下划线或连字符组成" \
      "choose-valid-identifier" \
      "$EXIT_INVALID_INPUT"
  fi
}

prepare_openspec_repo() {
  require_command openspec "openspec-cli-not-found" "install-openspec"
  require_command node "node-cli-not-found" "install-node"
  cd_repo_root
}

run_json_command() {
  local failure_reason="$1"
  local next_action="$2"
  shift 2

  local output
  set +e
  output="$("$@" 2>&1)"
  local command_exit=$?
  set -e

  if [[ $command_exit -ne 0 ]]; then
    emit_error \
      "$failure_reason" \
      "命令执行失败（exit $command_exit）：$output" \
      "$next_action" \
      "$EXIT_COMMAND_FAILED"
  fi
  if [[ -z "$output" ]]; then
    emit_error \
      "command-output-empty" \
      "命令成功但没有返回 JSON" \
      "$next_action" \
      "$EXIT_INVALID_OUTPUT"
  fi

  set +e
  printf '%s' "$output" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try { JSON.parse(input); } catch { process.exit(1); }
});
'
  local parse_exit=$?
  set -e
  if [[ $parse_exit -ne 0 ]]; then
    emit_error \
      "command-output-json-invalid" \
      "命令返回了非 JSON 输出：$output" \
      "$next_action" \
      "$EXIT_INVALID_OUTPUT"
  fi

  printf '%s\n' "$output"
}
