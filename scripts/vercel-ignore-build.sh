#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 skips the build, exit 1 runs it.
set -euo pipefail

# Always build production.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi

# Diff against the last successful deployment of this branch.
# Comparing only the tip commit would skip a preview that still has
# undeployed app code (first push, or a push after a failed/cancelled build).
# VERCEL_GIT_PREVIOUS_SHA is empty on a branch's first deployment.
PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$PREV" ]; then
  exit 1
fi
PREV_SHA="$(git rev-parse --verify "${PREV}^{commit}" 2>/dev/null || true)"
if [ -z "$PREV_SHA" ]; then
  exit 1
fi
# Redeploy, env-var rebuild, and retry set previous SHA to this commit.
# An empty diff would skip the build. Always rebuild the same commit.
HEAD_SHA="$(git rev-parse HEAD)"
if [ "$PREV_SHA" = "$HEAD_SHA" ]; then
  exit 1
fi

# Skip preview deploys whose changes since last success are only docs / agent files.
git diff --quiet "$PREV" HEAD -- . \
  ':!*.md' \
  ':!.cursor' \
  ':!.agents' \
  ':!AGENTS.md' \
  ':!.cursorrules'
