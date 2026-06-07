#!/usr/bin/env bash
# opsx-learn 预检：检查仓库上下文、知识库存放位置建议与 .knowledge 健康提示。
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "当前目录不在 git 仓库内（请先进入目标仓库再使用 opsx-learn）" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

knowledge_dir=""
first_use="true"
knowledge_health_json=""
knowledge_health_status="unknown"
knowledge_health_summary=""
knowledge_health_highlights_json="[]"

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

if command -v opsx-dev-pipeline >/dev/null 2>&1; then
  if doctor_json="$(opsx-dev-pipeline doctor --json --dir "$repo_root" 2>/dev/null)"; then
    if DOCTOR_JSON="$doctor_json" python3 - <<'PY' >/dev/null 2>&1
import json
import os

payload = json.loads(os.environ['DOCTOR_JSON'])
knowledge = payload.get('knowledge')
assert isinstance(knowledge, dict)
assert 'status' in knowledge
PY
    then
      knowledge_health_json="$(DOCTOR_JSON="$doctor_json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['DOCTOR_JSON'])
print(json.dumps(payload['knowledge'], ensure_ascii=False))
PY
)"
      knowledge_health_status="$(DOCTOR_JSON="$doctor_json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['DOCTOR_JSON'])
print(payload['knowledge'].get('status', 'unknown'))
PY
)"
      knowledge_health_summary="$(DOCTOR_JSON="$doctor_json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['DOCTOR_JSON'])
knowledge = payload['knowledge']
summary = knowledge.get('summary', {})
warn_count = int(summary.get('warn', 0) or 0)
fail_count = int(summary.get('fail', 0) or 0)
problem_checks = [check for check in knowledge.get('checks', []) if check.get('status') in ('warn', 'fail')]
problem_messages = [check.get('message', '').strip() for check in problem_checks if check.get('message')]
head = []
if fail_count:
    head.append(f'{fail_count} 个 fail')
if warn_count:
    head.append(f'{warn_count} 个 warn')
if not head:
    print('知识库健康状态良好，可继续进行知识沉淀。')
else:
    detail = '；'.join(problem_messages[:2])
    if detail:
        print(f"知识库预检发现 {'，'.join(head)}，建议先关注：{detail}")
    else:
        print(f"知识库预检发现 {'，'.join(head)}，建议先查看 knowledgeHealth 详情。")
PY
)"
      knowledge_health_highlights_json="$(DOCTOR_JSON="$doctor_json" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['DOCTOR_JSON'])
knowledge = payload['knowledge']
highlights = []
for check in knowledge.get('checks', []):
    status = check.get('status')
    if status not in ('warn', 'fail'):
        continue
    highlight = {
        'id': check.get('id'),
        'status': status,
        'message': check.get('message')
    }
    if check.get('missingFiles'):
        highlight['missingFiles'] = check['missingFiles']
    if check.get('missingSections'):
        highlight['missingSections'] = check['missingSections']
    if 'placeholderCount' in check:
        highlight['placeholderCount'] = check['placeholderCount']
    highlights.append(highlight)
print(json.dumps(highlights[:3], ensure_ascii=False))
PY
)"
    fi
  fi
fi

printf '{\n'
printf '  "status": "ok",\n'
printf '  "repoRoot": "%s",\n' "$repo_root"
printf '  "firstUse": %s,\n' "$first_use"
printf '  "recommendedKnowledgeDir": "%s",\n' "$knowledge_dir"
printf '  "knowledgeHealthAvailable": %s,\n' "$([ -n "$knowledge_health_json" ] && printf 'true' || printf 'false')"
printf '  "knowledgeHealthStatus": "%s",\n' "$knowledge_health_status"
if [ -n "$knowledge_health_summary" ]; then
  printf '  "knowledgeHealthSummary": "%s",\n' "$knowledge_health_summary"
  printf '  "knowledgeHealthHighlights": %s,\n' "$knowledge_health_highlights_json"
fi
if [ -n "$knowledge_health_json" ]; then
  printf '  "knowledgeHealth": %s,\n' "$knowledge_health_json"
fi
printf '  "message": "%s"\n' "若项目已由 opsx-dev-pipeline 初始化，优先复用默认生成的 .knowledge/ 骨架；若未检测到既有知识目录，则与用户确认后默认使用 .knowledge/。若预检已返回 knowledgeHealth，则在落盘前先根据其中的 warn/fail 项提示用户修复或同步索引。"
printf '}\n'
