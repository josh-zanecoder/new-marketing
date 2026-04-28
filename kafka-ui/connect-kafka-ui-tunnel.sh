#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="poc-1-aima-pmu"
ZONE="us-west1-a"
INSTANCE="kafka-ui-vm"
LOCAL_PORT="8082"
REMOTE_PORT="8082"

echo "Setting gcloud project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

echo "Opening SSH tunnel localhost:${LOCAL_PORT} -> ${INSTANCE}:${REMOTE_PORT}..."
echo "Keep this terminal open while using Kafka UI."
gcloud compute ssh "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  -- -N -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}"
