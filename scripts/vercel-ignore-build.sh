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
if ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  exit 1
fi

# Redeploy of the last successful commit has PREV == HEAD (env-var
# refresh, retry, or force). An empty self-diff must not skip the build.
if [ "$(git rev-parse "$PREV")" = "$(git rev-parse HEAD)" ]; then
  exit 1
fi

# Skip preview deploys whose changes since last success are only docs / agent files.
git diff --quiet "$PREV" HEAD -- . \
  ':!*.md' \
  ':!.cursor' \
  ':!.agents' \
  ':!AGENTS.md' \
  ':!.cursorrules'
