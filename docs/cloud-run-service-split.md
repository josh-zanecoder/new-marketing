# Cloud Run service split (web + workers)

Marketing runs as **multiple Cloud Run services** from the **same Docker image**. Web deploys no longer restart background workers or steal CPU from the UI during campaign sends.

## Services

| Service | Role | Key env overrides |
|---------|------|-------------------|
| `marketing-production` | UI, API, schedule reconcile | `KAFKA_INBOUND_CONSUMER_DISABLED=true`, `EMAIL_WORKER_DISABLED=true`, `CAMPAIGN_SEND_WORKER_URL` → send worker | min **1**, max **10**, 1 CPU |
| `marketing-send-worker-production` | Cloud Tasks batch HTTP target only | `EMAIL_WORKER_DISABLED=true`, `KAFKA_INBOUND_CONSUMER_DISABLED=true`, self `CAMPAIGN_SEND_WORKER_URL` | min **1**, max **10**, **2 CPU / 2Gi** |
| `marketing-kafka-worker-production` | Kafka inbound consumer only | `EMAIL_WORKER_DISABLED=true`, `SCHEDULE_RECONCILE_DISABLED=true`, `SENDING_RECONCILE_DISABLED=true` | min **1**, max **1** |

Test environment uses `marketing-test`, `marketing-send-worker`, and `marketing-kafka-worker`.

## Why split

- Redeploying the web service used to kill the Kafka consumer mid-sync.
- Web can scale (`max-instances` > 1) without duplicate Kafka consumer group members.
- Kafka worker stays **min=1, max=1** for a single consumer instance.
- **Campaign send worker** isolates long-running Cloud Tasks batch HTTP from login/navigation on the web service (see GCP logs: batch + UI shared one instance before this split).

## Logs

| What to check | Service |
|---------------|---------|
| `Kafka inbound consumer running` | `marketing-kafka-worker-production` |
| `marketing.sync.requested` / `syncedCount` | `marketing-kafka-worker-production` |
| `POST /api/v1/auth/tenant-handoff` | `marketing-production` / `marketing-test` |
| `[CampaignBatchWorker]` / `POST /api/internal/campaign-sends/batch` | `marketing-send-worker-production` / `marketing-send-worker` |
| `[ScheduleReconcile]` / `[SendingReconcile]` | web service only |
| `[EmailWorker]` | disabled on web when `EMAIL_WORKER_DISABLED=true` |

## Safe redeploy during sync

**Web** — deploy anytime; consumer is unaffected.

**Worker** — to pause/resume consumer offset work:

1. Set `KAFKA_INBOUND_CONSUMER_DISABLED=true` on the **worker** service (or scale min=0 temporarily).
2. Deploy worker.
3. Remove the flag and redeploy worker to resume from last committed offset.

Do **not** set `KAFKA_INBOUND_CONSUMER_DISABLED` on the web service for offset resets; it is always disabled there.

## Manual one-time setup (if worker service does not exist)

After merging the workflow changes, push to `production` or run **workflow_dispatch**. The pipeline creates `marketing-kafka-worker-production` automatically.

Or deploy manually (same image tag as web):

```bash
gcloud secrets versions access latest --secret=marketing-production --project=poc-1-aima-pmu > .env
chmod +x .github/scripts/build-cloud-run-env-yaml.sh
.github/scripts/build-cloud-run-env-yaml.sh worker .env worker-env.yaml

gcloud run deploy marketing-kafka-worker-production \
  --image us-west1-docker.pkg.dev/poc-1-aima-pmu/marketing-production/marketing-production:IMAGE_TAG \
  --region us-west1 \
  --platform managed \
  --no-allow-unauthenticated \
  --service-account 980800581325-compute@developer.gserviceaccount.com \
  --vpc-connector=projects/poc-1-aima-pmu/locations/us-west1/connectors/marketing-run-kafka \
  --vpc-egress=private-ranges-only \
  --min-instances 1 \
  --max-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --port 8080 \
  --execution-environment gen2 \
  --env-vars-file=worker-env.yaml
```

Confirm logs on the worker:

```text
Kafka inbound consumer running {
  topics: [ 'marketing.events', 'marketing.events.forge_capital_lending' ],
  groupId: 'new-marketing-inbound-events-v2'
}
```

## Related

- [marketing-sync-stuck-backlog-runbook.md](./marketing-sync-stuck-backlog-runbook.md)
- Consumer plugin: `server/kafka/plugins/kafka-inbound-consumer.ts`
