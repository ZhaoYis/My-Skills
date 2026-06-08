#!/usr/bin/env bash
# opsx-clarify 预检：检查仓库上下文与可复用的文档入口。
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不在 git 仓库内（请先进入目标仓库再使用 opsx-clarify）" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

knowledge_dir=""
knowledge_candidates=(
  ".knowledge"
  "docs/knowledge"
  "knowledge"
)
for candidate in "${knowledge_candidates[@]}"; do
  if [ -d "$candidate" ]; then
    knowledge_dir="$candidate"
    break
  fi
done

doc_hint=""
if [ -f "README.md" ]; then
  doc_hint="README.md"
elif [ -f "CLAUDE.md" ]; then
  doc_hint="CLAUDE.md"
elif [ -f "AGENTS.md" ]; then
  doc_hint="AGENTS.md"
fi

printf '{\n'
printf '  "status": "ok",\n'
printf '  "repoRoot": "%s",\n' "$repo_root"
printf '  "knowledgeDir": "%s",\n' "$knowledge_dir"
printf '  "docHint": "%s",\n' "$doc_hint"
printf '  "message": "%s"\n' "生成澄清问题前，先复用知识库、README/CLAUDE.md/AGENTS.md 与现有实现确定已知事实；只把真正需要干系人回答的不明确点列成问题。"
printf '}\n'
