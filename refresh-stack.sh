#!/usr/bin/env bash
#
# refresh-stack.sh
#
# Mirrors the manual workflow:
#   1. git pull the main branch of frontend, backend, harness, library
#      and the digital prototype
#   2. from the journey-tests repo: docker compose pull   (all latest images)
#   3. docker compose up --wait -d   (once the pull completes)
#
# The stack starts with the BNG Service template flag on, as CI and the CDP
# environments run it. For the legacy template:
#
#   SERVICE_TEMPLATE_ENABLED=false ./refresh-stack.sh
#
# The value comes from the shell, else from this repo's .env, else true. Run
# the suite with the same value (see README, Template runs).

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

# The template flag, resolved before anything is pulled so a bad value stops
# the script at once. docker compose would let the shell win over .env anyway;
# reading .env here only lets it beat this script's own default. Only "true"
# and "false" are accepted: the frontend reads any other value as on and the
# backend does not, which would start the two apps in different states.
#
# The .env line is read as dotenv reads it: an optional `export`, quotes, a
# trailing comment, surrounding spaces and a Windows line ending are dropped.
env_file_flag() {
  sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}SERVICE_TEMPLATE_ENABLED=//p' "$1" |
    tail -n 1 |
    tr -d '\r' |
    sed -e 's/[[:space:]]#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
      -e "s/^[\"']\(.*\)[\"']$/\1/"
}
if [ -z "${SERVICE_TEMPLATE_ENABLED:-}" ] && [ -f "$JOURNEY_TESTS/.env" ]; then
  SERVICE_TEMPLATE_ENABLED="$(env_file_flag "$JOURNEY_TESTS/.env")"
fi
export SERVICE_TEMPLATE_ENABLED="${SERVICE_TEMPLATE_ENABLED:-true}"
case "$SERVICE_TEMPLATE_ENABLED" in
  true | false) ;;
  *)
    printf 'SERVICE_TEMPLATE_ENABLED must be "true" or "false", not "%s"\n' "$SERVICE_TEMPLATE_ENABLED" >&2
    exit 1
    ;;
esac

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
info "Bringing the stack up (SERVICE_TEMPLATE_ENABLED=$SERVICE_TEMPLATE_ENABLED)"
docker compose --project-directory "$JOURNEY_TESTS" up --wait -d

info "Done — stack is up with SERVICE_TEMPLATE_ENABLED=$SERVICE_TEMPLATE_ENABLED. Run the suite with the same value."
