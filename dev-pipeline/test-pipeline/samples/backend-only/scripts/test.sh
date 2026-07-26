#!/usr/bin/env bash
set -euo pipefail
node --import tsx --test src/__tests__/*.test.ts
