#!/usr/bin/env bash
# opsx-verify 预检：检查项目基准与构建/测试命令的可发现性。
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不在 git 仓库内（请先进入目标仓库再使用 opsx-verify）" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

baseline_source=""
if [ -f "openspec/config.yaml" ]; then
  baseline_source="openspec/config.yaml"
elif [ -f "AGENTS.md" ]; then
  baseline_source="AGENTS.md"
elif [ -f "CLAUDE.md" ]; then
  baseline_source="CLAUDE.md"
elif [ -f "README.md" ]; then
  baseline_source="README.md"
fi

script_hint=""
script_candidates=(
  "scripts/build.sh"
  "scripts/test.sh"
  "scripts/validate.sh"
  "Makefile"
)
for candidate in "${script_candidates[@]}"; do
  if [ -e "$candidate" ]; then
    if [ -n "$script_hint" ]; then
      script_hint="$script_hint,$candidate"
    else
      script_hint="$candidate"
    fi
  fi
done

printf '{\n'
printf '  "status": "ok",\n'
printf '  "repoRoot": "%s",\n' "$repo_root"
printf '  "baselineSource": "%s",\n' "$baseline_source"
printf '  "scriptHints": "%s",\n' "$script_hint"
printf '  "message": "%s"\n' "验证前应先从项目基准（openspec/config.yaml → AGENTS.md → CLAUDE.md → README）解析构建/启动/测试命令；命令不唯一时请用户确认，不写死技术栈。"
printf '}\n'
