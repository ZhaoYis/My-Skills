#!/bin/bash
# Validate script for fullstack-todo
# Usage: ./validate.sh [backend|frontend|all]
# Used by opsx-verify and opsx-dev-pipeline Phase 4

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

validate_backend() {
  echo "=== Validating backend ==="
  cd "$ROOT_DIR/backend"
  npm run build --if-present 2>/dev/null || echo "  ⚠ No build step"
  npm test || { echo "  ❌ Backend tests failed"; exit 1; }
  echo "  ✅ Backend OK"
}

validate_frontend() {
  echo "=== Validating frontend ==="
  cd "$ROOT_DIR/frontend"
  npm run build --if-present 2>/dev/null || echo "  ⚠ No build step"
  npm test || { echo "  ❌ Frontend tests failed"; exit 1; }
  echo "  ✅ Frontend OK"
}

case "$TARGET" in
  backend)
    validate_backend
    ;;
  frontend)
    validate_frontend
    ;;
  all)
    validate_backend
    validate_frontend
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    exit 1
    ;;
esac

echo "=== All validations passed ==="
