#!/bin/bash
# Test script for fullstack-todo
set -e

cd "$(dirname "$0")/.."

echo "Running all tests..."
npm test --workspaces --if-present

echo "Tests complete."
