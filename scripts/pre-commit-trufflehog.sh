#!/usr/bin/env bash
# ============================================================================
# Pre-Commit Secret Scanner — TruffleHog + GGShield (optional)
# ============================================================================
#
# Scans staged changes for secrets BEFORE they are committed.
# Only scans the diff (not full history), so it's fast (~1-3s).
#
# Two-tool defense-in-depth:
#   1. TruffleHog OSS (primary)  — always runs; blocks on verified secrets
#   2. GGShield (optional)       — runs if installed & authenticated; advisory
#
# Installation (one-time):
#   chmod +x scripts/install-hooks.sh && ./scripts/install-hooks.sh
#
# Or manually:
#   cp scripts/pre-commit-trufflehog.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Requires:
#   TruffleHog: brew install trufflehog | pip install trufflehog | Docker
#   GGShield:   pip install ggshield && ggshield auth login   (optional)
#
# NOTE: If using the pre-commit framework (.pre-commit-config.yaml), you
#       don't need this script — `pre-commit install` handles it instead.
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel)"
BLOCKED=0

# ═══════════════════════════════════════════════════════════════════════════
# 1. TruffleHog (primary — always runs)
# ═══════════════════════════════════════════════════════════════════════════
if command -v trufflehog &>/dev/null; then
  TRUFFLEHOG_CMD="trufflehog"
elif command -v docker &>/dev/null; then
  TRUFFLEHOG_CMD="docker run --rm -v ${REPO_ROOT}:/repo trufflesecurity/trufflehog:latest"
else
  echo -e "${YELLOW}⚠  trufflehog not found — skipping primary scan.${NC}"
  echo "   Install: brew install trufflehog  OR  pip install trufflehog"
  TRUFFLEHOG_CMD=""
fi

if [[ -n "$TRUFFLEHOG_CMD" ]]; then
  echo -e "${CYAN}🔍 [1/2] TruffleHog — scanning staged changes…${NC}"
  set +e
  SCAN_OUTPUT=$(
    $TRUFFLEHOG_CMD git file://. \
      --since-commit=HEAD \
      --only-verified \
      --fail \
      --json \
      --no-update \
      --config="${REPO_ROOT}/.trufflehog-config.yml" \
      --exclude-paths="${REPO_ROOT}/.trufflehog-exclude-paths.txt" 2>&1
  )
  SCAN_EXIT=$?
  set -e

  if [[ "$SCAN_EXIT" -ne 0 ]]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ✋  TruffleHog: VERIFIED SECRET DETECTED — commit blocked${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "$SCAN_OUTPUT" | head -80
    BLOCKED=1
  else
    echo -e "${GREEN}   ✅ TruffleHog: no verified secrets.${NC}"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# 2. GGShield (optional — runs if installed & authenticated)
# ═══════════════════════════════════════════════════════════════════════════
if command -v ggshield &>/dev/null; then
  # Check authentication (GITGUARDIAN_API_KEY env var or ggshield auth status)
  if [[ -n "${GITGUARDIAN_API_KEY:-}" ]] || ggshield auth check &>/dev/null 2>&1; then
    echo -e "${CYAN}🔍 [2/2] GGShield — complementary scan…${NC}"
    set +e
    GG_OUTPUT=$(ggshield secret scan pre-commit 2>&1)
    GG_EXIT=$?
    set -e

    if [[ "$GG_EXIT" -ne 0 ]]; then
      echo -e "${YELLOW}   ⚠  GGShield detected potential secrets (advisory):${NC}"
      echo "$GG_OUTPUT" | head -40
      # GGShield is advisory — does not block by default
      # Uncomment the next line to make GGShield a hard gate:
      # BLOCKED=1
    else
      echo -e "${GREEN}   ✅ GGShield: no secrets detected.${NC}"
    fi
  else
    echo -e "${YELLOW}   ⚠  GGShield installed but not authenticated — skipping.${NC}"
    echo "      Run: ggshield auth login  OR  export GITGUARDIAN_API_KEY=..."
  fi
else
  echo -e "${CYAN}   ℹ  GGShield not installed — skipping complementary scan.${NC}"
  echo "      Optional: pip install ggshield && ggshield auth login"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Final verdict
# ═══════════════════════════════════════════════════════════════════════════
if [[ $BLOCKED -ne 0 ]]; then
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Remove the secret from the file."
  echo "  2. Use environment variables or a vault instead."
  echo "  3. If it's a false positive, add its result ID to .trufflehog-ignore"
  echo ""
  echo -e "  To bypass (emergency only): ${RED}git commit --no-verify${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Pre-commit secret scan passed.${NC}"
exit 0
