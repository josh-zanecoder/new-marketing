#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="poc-1-aima-pmu"
ZONE="us-west1-a"
INSTANCE="kafka-ui-vm"
REMOTE_DIR="kafka-ui-production"

echo "Generating kafka-ui/.env.production from repo .env.production..."
"${DIR}/scripts/generate-env.sh"

echo "Copying files to ${INSTANCE}:~/${REMOTE_DIR}/..."
gcloud compute ssh "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --command="mkdir -p ~/${REMOTE_DIR}"

gcloud compute scp \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  "${DIR}/.env.production" \
  "${DIR}/scripts/start-production-on-vm.sh" \
  "${INSTANCE}:~/${REMOTE_DIR}/"

echo "Starting production Kafka UI on port 8083 (docker run)..."
gcloud compute ssh "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --command="chmod +x ~/${REMOTE_DIR}/start-production-on-vm.sh && ~/${REMOTE_DIR}/start-production-on-vm.sh"

echo "Done. Run ./connect-kafka-ui-tunnel-production.sh then open http://localhost:8083"
