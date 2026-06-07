#!/usr/bin/env bash
# opsx-learn 预检：检查仓库上下文与知识库存放位置建议。
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不在 git 仓库内（请先进入目标仓库再使用 opsx-learn）" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

knowledge_dir=""
first_use="true"

candidates=(
  ".knowledge"
  "docs/knowledge"
  "knowledge"
  "docs/domain"
)

for candidate in "${candidates[@]}"; do
  if [ -d "$candidate" ]; then
    knowledge_dir="$candidate"
    first_use="false"
    break
  fi
done

if [ -z "$knowledge_dir" ]; then
  knowledge_dir=".knowledge"
fi

printf '{\n'
printf '  "status": "ok",\n'
printf '  "repoRoot": "%s",\n' "$repo_root"
printf '  "firstUse": %s,\n' "$first_use"
printf '  "recommendedKnowledgeDir": "%s",\n' "$knowledge_dir"
printf '  "message": "%s"\n' "首次使用且未检测到既有知识目录时，应明确提示用户确认知识库存放位置；默认使用 .knowledge/。"
printf '}\n'
