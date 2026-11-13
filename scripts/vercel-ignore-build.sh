#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 skips the build, exit 1 runs it.
set -euo pipefail

# Always build production.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi

# First commit on a shallow clone has no parent — build.
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  exit 1
fi

# Skip preview deploys that only touch docs / agent files.
git diff --quiet HEAD^ HEAD -- . \
  ':!*.md' \
  ':!.cursor' \
  ':!.agents' \
  ':!AGENTS.md' \
  ':!.cursorrules'
