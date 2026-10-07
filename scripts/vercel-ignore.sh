#!/bin/sh
# Vercel "Ignored Build Step" for the Vite SPA at the repo root. Exit 0 = SKIP, 1 = BUILD.
#
# Why: every push to any branch creates a Vercel deployment record, and a docs-only, reports-only
# or CI-only change cannot change the built site. Hobby-plan deployment quota (100/day) was being
# spent on builds that produced an identical site.
#
# Built when anything that can affect the build output differs from the base (WATCHED below).
# reports/, .github/ and scripts/ are deliberately NOT watched: `npm run build` is
# `tsc -b && vite build`, tsconfig.app.json includes only src/, and src/ imports nothing from
# them (reports/ is only named in comments; checked with grep on 2026-10-07). If a Vercel
# dashboard Build Command ever calls a script under scripts/, add that path to WATCHED.
#
# Base, in order (same design as review-iq web/scripts/vercel-ignore.sh, S18 Z4a, which probed
# Vercel's real clone: shallow, no origin/main ref, no VERCEL_GIT_PREVIOUS_SHA on a new branch):
#   1. VERCEL_GIT_PREVIOUS_SHA if that commit exists in the clone;
#   2. merge-base with origin/<base> (fetched), else with a fetch of the PUBLIC repo URL built
#      from VERCEL_GIT_REPO_OWNER/VERCEL_GIT_REPO_SLUG;
#   3. shallow clone only: the window oldest-cloned-commit..HEAD. Skip if nothing watched changed
#      in it (may over-build, never skips a change inside the window; never skips production).
# Anything else fails OPEN (build): a wasted build is cheaper than shipping a stale site.
set -u -f
cd "$(dirname "$0")/.." || exit 1
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "ignore-step: not a git repo; building"; exit 1; }
cd "$ROOT" || exit 1

export GIT_TERMINAL_PROMPT=0 GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=20

# Pathspecs (relative to the repo root).
WATCHED="src public index.html package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json components.json .npmrc .env.production vercel.json .vercelignore"

BASE_BRANCH="${VERCEL_IGNORE_BASE_BRANCH:-main}"
REMOTE_REF="${VERCEL_IGNORE_BASE_REF:-origin/$BASE_BRANCH}"

# shellcheck disable=SC2086 -- WATCHED is a deliberate word-split pathspec list
changed() { ! git diff --quiet "$1" HEAD -- $WATCHED; }

BASE=""
if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null; then
  BASE="$VERCEL_GIT_PREVIOUS_SHA"
  echo "ignore-step: base = previous deployed commit $BASE"
fi

if [ -z "$BASE" ]; then
  if ! git rev-parse --verify -q "$REMOTE_REF" >/dev/null 2>&1; then
    git fetch --no-tags --depth=200 origin "$BASE_BRANCH" >/dev/null 2>&1 || true
  fi
  if git rev-parse --verify -q "$REMOTE_REF" >/dev/null 2>&1; then
    BASE=$(git merge-base HEAD "$REMOTE_REF" 2>/dev/null || true)
  fi
  [ -n "$BASE" ] && echo "ignore-step: base = merge-base with $REMOTE_REF $BASE"
fi

if [ -z "$BASE" ]; then
  PUBLIC_URL="${VERCEL_IGNORE_PUBLIC_URL:-}"
  if [ -z "$PUBLIC_URL" ] && [ -n "${VERCEL_GIT_REPO_OWNER:-}" ] && [ -n "${VERCEL_GIT_REPO_SLUG:-}" ]; then
    PUBLIC_URL="https://github.com/${VERCEL_GIT_REPO_OWNER}/${VERCEL_GIT_REPO_SLUG}.git"
  fi
  if [ -n "$PUBLIC_URL" ] && git fetch --no-tags --depth=200 "$PUBLIC_URL" "$BASE_BRANCH" >/dev/null 2>&1; then
    BASE=$(git merge-base HEAD FETCH_HEAD 2>/dev/null || true)
    [ -n "$BASE" ] && echo "ignore-step: base = merge-base with public $BASE_BRANCH $BASE"
  fi
fi

if [ -z "$BASE" ]; then
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || true)
  OLDEST=""
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
    OLDEST=$(git rev-list --max-parents=0 HEAD 2>/dev/null | tail -n 1)
  fi
  if [ "${VERCEL_ENV:-}" = "production" ]; then
    echo "ignore-step: no base and this is a production deploy; building (never skip production on a guess)"
    exit 1
  fi
  if [ -n "$OLDEST" ] && [ -n "$HEAD_SHA" ] && [ "$OLDEST" != "$HEAD_SHA" ]; then
    if changed "$OLDEST"; then
      echo "ignore-step: no base; shallow window $OLDEST..HEAD touches watched paths; building"
      exit 1
    fi
    echo "ignore-step: no base; shallow window $OLDEST..HEAD has no watched change; skipping build"
    exit 0
  fi
  echo "ignore-step: could not determine a base or a usable window; building (fail open)"
  exit 1
fi

if changed "$BASE"; then
  echo "ignore-step: watched paths changed since $BASE; building"
  exit 1
fi
echo "ignore-step: no watched path changed since $BASE; skipping build"
exit 0
