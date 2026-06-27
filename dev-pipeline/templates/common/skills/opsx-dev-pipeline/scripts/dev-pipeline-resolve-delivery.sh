#!/bin/bash
# dev-pipeline-resolve-delivery.sh
# 从 openspec/config.yaml 中读取 opsx.delivery_mode
# 输出结构化 JSON，为 Phase 6/7 状态机提供配置来源
#
# 用法: bash dev-pipeline-resolve-delivery.sh
# 输出: JSON { status, delivery_mode, reason, nextAction }
#
# delivery_mode 取值:
#   push_only   - 仅推送，不合并
#   local_merge - 本地合并（默认行为，兼容现有流程）
#   pr          - 创建 PR，等待 CI，合并 PR
#
# 未配置时: status=unconfigured, delivery_mode=null

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 读取 openspec/config.yaml
resolve_config() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    local candidate="$dir/openspec/config.yaml"
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

CONFIG_FILE="$(resolve_config || true)"

if [ -z "$CONFIG_FILE" ]; then
  cat <<'EOF'
{
  "status": "warning",
  "reason": "No openspec/config.yaml found — delivery_mode is unconfigured",
  "delivery_mode": null,
  "source": null,
  "nextAction": "ask_user_delivery_mode"
}
EOF
  exit 0
fi

# 用 Python 解析 config.yaml → 读取 opsx.delivery_mode
if command -v python3 &>/dev/null; then
  python3 -c "
import json, sys

try:
    import yaml
except ImportError:
    print(json.dumps({
        'status': 'warning',
        'reason': 'PyYAML not installed — cannot parse config.yaml',
        'delivery_mode': None,
        'source': '$CONFIG_FILE',
        'nextAction': 'ask_user_delivery_mode'
    }))
    sys.exit(0)

try:
    with open('$CONFIG_FILE', 'r') as f:
        config = yaml.safe_load(f) or {}
except Exception as e:
    print(json.dumps({
        'status': 'error',
        'reason': f'YAML parse error: {str(e)}',
        'delivery_mode': None,
        'source': '$CONFIG_FILE',
        'nextAction': 'check_config_integrity'
    }))
    sys.exit(0)

delivery_mode = config.get('opsx', {}).get('delivery_mode') if isinstance(config, dict) else None

# 验证 delivery_mode 值
VALID_MODES = {'push_only', 'local_merge', 'pr'}

if delivery_mode is None:
    print(json.dumps({
        'status': 'unconfigured',
        'reason': 'opsx.delivery_mode is not set in openspec/config.yaml',
        'delivery_mode': None,
        'source': '$CONFIG_FILE',
        'valid_modes': list(VALID_MODES),
        'nextAction': 'ask_user_delivery_mode'
    }))
elif delivery_mode not in VALID_MODES:
    print(json.dumps({
        'status': 'error',
        'reason': f'Invalid delivery_mode: \"{delivery_mode}\". Must be one of: {\", \".join(sorted(VALID_MODES))}',
        'delivery_mode': delivery_mode,
        'source': '$CONFIG_FILE',
        'valid_modes': list(VALID_MODES),
        'nextAction': 'fix_config_or_ask_user'
    }))
else:
    # 根据模式给出下一步建议
    next_actions = {
        'push_only': 'phase6_push_only',
        'local_merge': 'phase6_push_then_merge',
        'pr': 'phase6_push_then_phase7_pr'
    }
    print(json.dumps({
        'status': 'ok',
        'reason': f'delivery_mode resolved: {delivery_mode}',
        'delivery_mode': delivery_mode,
        'source': '$CONFIG_FILE',
        'nextAction': next_actions.get(delivery_mode, 'ask_user_delivery_mode')
    }))
"
else
  cat <<EOF
{
  "status": "degraded",
  "reason": "Python3 not available — cannot parse config.yaml at $CONFIG_FILE",
  "delivery_mode": null,
  "source": "$CONFIG_FILE",
  "nextAction": "ask_user_delivery_mode"
}
EOF
fi
