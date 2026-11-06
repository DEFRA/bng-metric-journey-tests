#!/usr/bin/env bash
#
# refresh-stack.sh
#
# Mirrors the manual workflow:
#   1. git pull the main branch of frontend, backend, harness, library
#      and the digital prototype
#   2. from the journey-tests repo: docker compose pull   (all latest images)
#   3. docker compose up --wait -d   (once the pull completes)

set -euo pipefail

# This script lives in the journey-tests repo; the workspace is its parent.
JOURNEY_TESTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(cd "$JOURNEY_TESTS/.." && pwd)"
FRONTEND="$WORKSPACE/bng-metric-frontend"
BACKEND="$WORKSPACE/bng-metric-backend"
HARNESS="$WORKSPACE/bng-metric-harness"
LIBRARY="$WORKSPACE/bng-library"
PROTOTYPE="$WORKSPACE/bng-metric-digital-prototype"

info() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# Retries with backoff (about 2.5 minutes in total). During a GitHub incident,
# valid SSH keys can intermittently fail with "Permission denied (publickey)".
retry() {
  local attempt=1 max_attempts=6 delay=5
  until "$@"; do
    if [ "$attempt" -eq "$max_attempts" ]; then
      printf 'Giving up after %d attempts: %s\n' "$max_attempts" "$*" >&2
      return 1
    fi
    printf 'Attempt %d/%d failed, retrying in %ds\n' "$attempt" "$max_attempts" "$delay" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

pull_main() {
  local dir="$1" name
  name="$(basename "$dir")"
  info "Pulling main in $name"
  git -C "$dir" checkout main
  # Only the network step is retried; a diverged branch still fails immediately.
  retry git -C "$dir" fetch origin main
  git -C "$dir" merge --ff-only origin/main
}

# ---- Step 1: git pull main across the sibling repos ----
pull_main "$FRONTEND"
pull_main "$BACKEND"
pull_main "$HARNESS"
pull_main "$LIBRARY"
pull_main "$PROTOTYPE"

# ---- Step 2: pull all latest images (from the journey-tests repo) ----
info "Pulling latest Docker images"
docker compose --project-directory "$JOURNEY_TESTS" pull

# ---- Step 3: bring the stack up (only reached if the pull succeeded) ----
info "Bringing the stack up"
docker compose --project-directory "$JOURNEY_TESTS" up --wait -d

info "Done — stack is up."
