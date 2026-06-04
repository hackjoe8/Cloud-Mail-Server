#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo "[deploy] missing .env in $SCRIPT_DIR" >&2
  exit 1
fi

compose() {
  docker compose --env-file .env "$@"
}

run_init_step() {
  local service="$1"
  echo "[deploy] running init step: $service"
  compose run --rm --no-deps "$service"
}

echo "[deploy] removing old init containers (if any)"
compose rm -f -s minio-init cloud-mail-init cloud-mail-configure-storage cloud-mail-refresh-cache >/dev/null 2>&1 || true

echo "[deploy] starting core services"
compose up -d --build postgres redis minio cloud-mail-server

run_init_step minio-init
run_init_step cloud-mail-init
run_init_step cloud-mail-configure-storage
run_init_step cloud-mail-refresh-cache

echo "[deploy] final status"
compose ps
