#!/usr/bin/env bash
set -euo pipefail

mode="${1:?mode required: web|worker}"
input="${2:?input .env file required}"
output="${3:?output yaml file required}"

skip_keys=""
case "$mode" in
  web)
    skip_keys="KAFKA_INBOUND_CONSUMER_DISABLED|KAFKA_CRM_CONSUMER_DISABLED"
    ;;
  worker)
    skip_keys="KAFKA_INBOUND_CONSUMER_DISABLED|KAFKA_CRM_CONSUMER_DISABLED|EMAIL_WORKER_DISABLED|SCHEDULE_RECONCILE_DISABLED|SENDING_RECONCILE_DISABLED"
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    exit 1
    ;;
esac

echo "---" > "$output"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* || "$line" == "PORT="* ]] && continue
  key="${line%%=*}"
  if echo "$key" | grep -Eq "^($skip_keys)$"; then continue; fi
  value="${line#*=}"
  value=$(printf '%s' "$value" | sed 's/^"//;s/"$//')
  safe_value=$(printf '%s' "$value" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
  echo "$key: \"$safe_value\"" >> "$output"
done < "$input"

case "$mode" in
  web)
    echo 'KAFKA_INBOUND_CONSUMER_DISABLED: "true"' >> "$output"
    ;;
  worker)
    echo 'EMAIL_WORKER_DISABLED: "true"' >> "$output"
    echo 'SCHEDULE_RECONCILE_DISABLED: "true"' >> "$output"
    echo 'SENDING_RECONCILE_DISABLED: "true"' >> "$output"
    ;;
esac
