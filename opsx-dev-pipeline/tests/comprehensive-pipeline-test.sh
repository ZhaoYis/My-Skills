#!/usr/bin/env bash
# 兼容入口：委托给 tests/run-all.sh 的 regression 套件
# 新代码请直接使用: bash tests/run-all.sh

set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$TEST_DIR/run-all.sh" --only regression "$@"
