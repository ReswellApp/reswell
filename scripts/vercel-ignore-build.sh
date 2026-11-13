#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 skips the build, exit 1 runs it.
set -euo pipefail

# Always build production.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi

# First preview on a branch has no previous successful deploy — build.
previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$previous" ]; then
  exit 1
fi

# Skip preview deploys that only touch docs / agent files.
git diff --quiet "$previous" HEAD -- . \
  ':!*.md' \
  ':!.cursor' \
  ':!.agents' \
  ':!AGENTS.md' \
  ':!.cursorrules'
