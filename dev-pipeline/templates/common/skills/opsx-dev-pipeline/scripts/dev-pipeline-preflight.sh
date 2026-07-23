#!/usr/bin/env bash
# Phase 0: openspec + git 仓库预检，含 git 配置与 openspec 初始化状态。
# 成功输出 JSON 到 stdout；失败输出 JSON 到 stderr 并返回稳定退出码。
#
# JSON 错误输出约定（所有 dev-pipeline-*.sh 脚本共享）：
#   reason: 英文 kebab-case 标识符（如 openspec-cli-not-found），供程序化解析
#   detail: 人类可读描述（中英均可），供 AI Agent 向用户展示
#   nextAction: 推荐的后续动作标识符
# warnings 以换行符分隔，避免消息中的特殊字符冲突。
set -euo pipefail

EXIT_OPENSPEC_MISSING=1
EXIT_NOT_GIT_REPO=2
EXIT_OPENSPEC_NOT_INIT=3
EXIT_PYTHON3_MISSING=4

# 带超时的命令执行（10 秒默认）
run_with_timeout() {
  local timeout_sec="${1:-10}"
  shift
  timeout "$timeout_sec" "$@" 2>/dev/null || return $?
}

# --- openspec CLI ---
if ! command -v openspec >/dev/null 2>&1; then
  echo '{"status":"error","reason":"openspec-cli-not-found","detail":"请安装 @fission-ai/openspec 并确保 PATH 可用","nextAction":"install-openspec"}' >&2
  exit $EXIT_OPENSPEC_MISSING
fi
if ! openspec --version >/dev/null 2>&1; then
  echo '{"status":"error","reason":"openspec-version-failed","detail":"openspec --version 执行失败","nextAction":"check-openspec-install"}' >&2
  exit $EXIT_OPENSPEC_MISSING
fi

# --- git 仓库 ---
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo '{"status":"error","reason":"not-a-git-repo","detail":"当前目录不在 git 仓库内（请先 cd 到项目根或执行 git init）","nextAction":"init-git-or-cd"}' >&2
  exit $EXIT_NOT_GIT_REPO
fi

# --- git 用户配置（提交时需要）---
warnings=""
if ! git config user.name >/dev/null 2>&1; then
  warnings="${warnings}git-config-user-name-missing\n"
fi
if ! git config user.email >/dev/null 2>&1; then
  warnings="${warnings}git-config-user-email-missing\n"
fi

# --- openspec 初始化状态 ---
openspec_init_ok=true
if ! openspec list --json >/dev/null 2>&1; then
  openspec_init_ok=false
fi

if ! $openspec_init_ok; then
  # 去除末尾换行符
  warnings="${warnings%\\n}"
  echo '{"status":"error","reason":"openspec-not-initialized","detail":"openspec 未初始化（请先执行 openspec init）","nextAction":"run-openspec-init","warnings":"'"$warnings"'"}' >&2
  exit $EXIT_OPENSPEC_NOT_INIT
fi

# --- python3（dev-pipeline-instructions.sh 依赖）---
python3_available=true
if ! command -v python3 >/dev/null 2>&1; then
  python3_available=false
  warnings="${warnings}python3-missing（dev-pipeline-instructions.sh 在省略 artifact-id 时需要 python3）\n"
fi

# --- 构建最终输出 ---
# 移除末尾换行符
warnings="${warnings%\\n}"
if [[ -n "$warnings" ]]; then
  printf '{"status":"ok","reason":"preflight-passed-with-warnings","nextAction":"continue-phase-0","warnings":"%s","python3Available":%s}\n' \
    "$warnings" "$python3_available"
else
  printf '{"status":"ok","reason":"preflight-passed","nextAction":"continue-phase-0","python3Available":%s}\n' \
    "$python3_available"
fi
exit 0