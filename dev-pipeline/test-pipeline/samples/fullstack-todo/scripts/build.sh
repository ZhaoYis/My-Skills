#!/bin/bash
# Build script for fullstack-todo
set -e

echo "Building backend..."
cd "$(dirname "$0")/../backend" && npm run build

echo "Building frontend..."
cd "$(dirname "$0")/../frontend" && npm run build

echo "Build complete."
