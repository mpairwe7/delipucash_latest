#!/usr/bin/env bash
# ============================================================================
# Install Git Hooks — DelipuCash
# ============================================================================
#
# Sets up the TruffleHog pre-commit hook so secrets are caught locally
# before they ever reach the remote.
#
# Usage:
#   chmod +x scripts/install-hooks.sh
#   ./scripts/install-hooks.sh
# ============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPT_SRC="$REPO_ROOT/scripts/pre-commit-trufflehog.sh"

echo "Installing pre-commit hook…"

if [[ ! -f "$SCRIPT_SRC" ]]; then
  echo "Error: $SCRIPT_SRC not found." >&2
  exit 1
fi

# Back up existing hook if present
if [[ -f "$HOOKS_DIR/pre-commit" ]]; then
  echo "  Backing up existing pre-commit → pre-commit.bak"
  cp "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.bak"
fi

cp "$SCRIPT_SRC" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Pre-commit hook installed at $HOOKS_DIR/pre-commit"
echo ""
echo "The hook runs TruffleHog on staged changes before each commit."
echo "Bypass (emergency): git commit --no-verify"
