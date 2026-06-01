#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
IMAGE="provectuslabs/kafka-ui:v0.7.2"
CONTAINER="kafka-ui-production"
ENV_FILE=".env.production"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} in $(pwd)"
  exit 1
fi
docker pull "${IMAGE}"
docker rm -f "${CONTAINER}" 2>/dev/null || true
docker run -d --name "${CONTAINER}" --restart unless-stopped -p 8083:8080 --env-file "${ENV_FILE}" "${IMAGE}"
docker ps --filter "name=${CONTAINER}"
