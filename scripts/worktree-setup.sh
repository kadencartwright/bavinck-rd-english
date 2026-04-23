#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

get_primary_checkout() {
  if [ -f ".git" ]; then
    git_dir=$(git rev-parse --git-common-dir 2>/dev/null || true)
    if [ -n "$git_dir" ] && [ "$git_dir" != ".git" ]; then
      dirname "$git_dir"
    else
      echo "Error: Unable to determine primary checkout path from worktree" >&2
      exit 1
    fi
  else
    echo "$REPO_ROOT"
  fi
}

echo "=== Worktree Setup ==="
echo ""

PRIMARY_CHECKOUT=$(get_primary_checkout)
echo "Primary checkout: $PRIMARY_CHECKOUT"
echo "Current worktree: $REPO_ROOT"
echo ""

echo "=== Checking for .env file ==="
if [ -f ".env" ]; then
  echo ".env already exists in worktree - skipping copy"
elif [ "$REPO_ROOT" = "$PRIMARY_CHECKOUT" ]; then
  echo "Already in primary checkout - no need to copy .env"
elif [ -f "$PRIMARY_CHECKOUT/.env" ]; then
  cp "$PRIMARY_CHECKOUT/.env" ".env"
  echo ".env copied from primary checkout"
else
  echo "WARNING: No .env file found in primary checkout ($PRIMARY_CHECKOUT)"
  echo "         You may need to create one manually from .env.example"
fi
echo ""

echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile
echo "Dependencies installed."
echo ""

echo "=== Setup complete! ==="
