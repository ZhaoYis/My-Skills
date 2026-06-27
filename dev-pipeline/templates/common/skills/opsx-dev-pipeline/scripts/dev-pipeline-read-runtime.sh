#!/bin/bash
# dev-pipeline-read-runtime.sh
# 读取 openspec/runtime-state.yaml 并输出结构化 JSON
# 用于 Phase 0 恢复检查和 Phase 6/7 模式判断

set -euo pipefail

# 确定项目根目录（与其它 dev-pipeline-*.sh 保持一致）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 尝试多种方式定位 runtime state 文件
resolve_runtime_file() {
  local candidate

  # 方式1：从当前目录向上查找 openspec/
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    candidate="$dir/openspec/runtime-state.yaml"
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
    dir="$(dirname "$dir")"
  done

  # 方式2：使用 git root
  if command -v git &>/dev/null; then
    local git_root
    git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "$git_root" ]; then
      candidate="$git_root/openspec/runtime-state.yaml"
      if [ -f "$candidate" ]; then
        echo "$candidate"
        return 0
      fi
    fi
  fi

  return 1
}

RUNTIME_FILE="$(resolve_runtime_file || true)"

if [ -z "$RUNTIME_FILE" ]; then
  cat <<EOF
{
  "status": "not_found",
  "reason": "No openspec/runtime-state.yaml found in project tree",
  "exists": false,
  "nextAction": "initialize_runtime_state"
}
EOF
  exit 0
fi

# 使用 Python 解析 YAML 并输出 JSON
# 如果没有 Python，尝试用纯 bash 做最小解析
if command -v python3 &>/dev/null; then
  python3 -c "
import json, sys, yaml

try:
    with open('$RUNTIME_FILE', 'r') as f:
        data = yaml.safe_load(f) or {}
except Exception as e:
    print(json.dumps({
        'status': 'error',
        'reason': f'YAML parse error: {str(e)}',
        'exists': True,
        'nextAction': 'check_file_integrity'
    }))
    sys.exit(0)

# 输出结构化 JSON
result = {
    'status': 'ok',
    'reason': 'Runtime state loaded',
    'exists': True,
    'file': '$RUNTIME_FILE',
    'data': data,
    'nextAction': 'check_resume_phase'
}

# 附加恢复建议
phase = data.get('current_phase', '')
if phase in ('completed', 'terminated'):
    result['nextAction'] = 'ask_user_restart_or_resume'
elif phase.startswith('phase7'):
    result['nextAction'] = 'resume_from_phase7'
elif phase:
    result['nextAction'] = 'resume_from_' + phase

print(json.dumps(result, indent=2, default=str))
"
else
  # 无 Python 时的降级处理：只检查文件是否存在，返回最小可用信息
  cat <<EOF
{
  "status": "degraded",
  "reason": "Python3 not available, cannot parse YAML. File exists at: $RUNTIME_FILE",
  "exists": true,
  "file": "$RUNTIME_FILE",
  "data": {},
  "nextAction": "install_python_or_manual_review"
}
EOF
fi
