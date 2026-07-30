#!/usr/bin/env bash
#
# refresh-stack.sh
#
# Mirrors the manual workflow:
#   1. git pull the main branch of frontend, backend and harness
#   2. from the journey-tests repo: docker compose pull   (all latest images)
#   3. docker compose up --wait -d   (once the pull completes)

set -euo pipefail

# This script lives in the journey-tests repo; the workspace is its parent.
JOURNEY_TESTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(cd "$JOURNEY_TESTS/.." && pwd)"
FRONTEND="$WORKSPACE/bng-metric-frontend"
BACKEND="$WORKSPACE/bng-metric-backend"
HARNESS="$WORKSPACE/bng-metric-harness"

info() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

pull_main() {
  local dir="$1" name
  name="$(basename "$dir")"
  info "Pulling main in $name"
  git -C "$dir" checkout main
  git -C "$dir" pull --ff-only origin main
}

# ---- Step 1: git pull main across the three repos ----
pull_main "$FRONTEND"
pull_main "$BACKEND"
pull_main "$HARNESS"

# ---- Step 2: pull all latest images (from the journey-tests repo) ----
info "Pulling latest Docker images"
docker compose --project-directory "$JOURNEY_TESTS" pull

# ---- Step 3: bring the stack up (only reached if the pull succeeded) ----
info "Bringing the stack up"
docker compose --project-directory "$JOURNEY_TESTS" up --wait -d

info "Done — stack is up."
