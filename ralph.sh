#!/usr/bin/env bash
set -euo pipefail

MAX_ITERS="${1:-10}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
MODE="safe"
REBASE_MODE="no-rebase"

if [ "$#" -ge 2 ]; then
  shift

  for arg in "$@"; do
    case "$arg" in
      safe|dangerous)
        MODE="$arg"
        ;;
      rebase|no-rebase)
        REBASE_MODE="$arg"
        ;;
      *)
        echo "Unknown option: $arg"
        echo "Usage: ./ralph.sh [count|until-done] [safe|dangerous] [rebase|no-rebase]"
        exit 1
        ;;
    esac
  done
fi

CODEX_ARGS=(
  --full-auto
  -C "$ROOT"
  -o .ralph-last.txt
  -
)

if [ "$MODE" = "dangerous" ]; then
  CODEX_ARGS=(
    --dangerously-bypass-approvals-and-sandbox
    -C "$ROOT"
    -o .ralph-last.txt
    -
  )
fi

cd "$ROOT"

maybe_rebase() {
  if [ "$REBASE_MODE" != "rebase" ]; then
    return
  fi

  if [ -n "$(git status --short)" ]; then
    echo
    echo "-- rebase --"
    echo "Skipping rebase because the worktree is dirty."
    return
  fi

  echo
  echo "-- rebase --"
  git fetch origin
  git rebase "origin/$(git rev-parse --abbrev-ref HEAD)"
}

run_iteration() {
  local i="$1"

  echo
  echo "== Ralph iteration $i =="

  maybe_rebase

  rm -f .ralph-last.txt

  cat PROMPT.md | codex exec \
    "${CODEX_ARGS[@]}"

  echo
  echo "-- agent result --"
  if [ -f .ralph-last.txt ]; then
    cat .ralph-last.txt
  fi

  echo
  echo "-- verification --"
  set +e
  npm test
  test_status=$?
  npm run build
  build_status=$?
  set -e

  if [ "$test_status" -ne 0 ] || [ "$build_status" -ne 0 ]; then
    echo
    echo "Verification is still failing."
  fi

  if [ -n "$(git status --short)" ]; then
    git add -A
    git commit -m "ralph: iteration $i"
  fi

  if [ -f .ralph-last.txt ] && grep -q "RALPH_COMPLETE" .ralph-last.txt && [ "$test_status" -eq 0 ] && [ "$build_status" -eq 0 ]; then
    echo
    echo "Ralph finished."
    exit 0
  fi
}

if [ "$MAX_ITERS" = "until-done" ]; then
  i=1
  while true; do
    run_iteration "$i"
    i=$((i + 1))
  done
fi

for i in $(seq 1 "$MAX_ITERS"); do
  run_iteration "$i"
done

echo
echo "Reached max iterations without completion."
exit 1
