# Campaign send reliability (mortdash-crm ratesheet pattern)

Campaign bulk send uses the same ideas as `mortdash-crm` ratesheet sends: chunked jobs, per-recipient delivery ledger, Brevo idempotency, and `sendRunId` to invalidate stale workers.

**Batch transport:** **Google Cloud Tasks** whenever project/location/queue + `CAMPAIGN_SEND_WORKER_SECRET` are set; otherwise **BullMQ** + Redis.

## Separate from Kafka

| Concern | Stack | Plugin / entry |
| ------- | ----- | -------------- |
| **Send now (batch chunks)** | Mongo recipients + **Cloud Tasks** → `POST /api/internal/campaign-sends/batch` (or BullMQ locally) | `server/queue/campaignCloudTasksQueue.ts` / `server/queue/emailQueue.ts` |
| **Schedule / reschedule** | Mongo `Scheduled` + delayed start (Cloud Tasks or BullMQ); reschedule replaces the job (`docs/campaign-reschedule.md`). Task ids are unique per enqueue so cancel→schedule-again works (`docs/campaign-schedule-cancel-reschedule.md`) | `server/api/v1/tenant/send-campaign/schedule.post.ts`; `server/queue/campaignCloudTasksQueue.ts`; `server/utils/campaignSend/campaignScheduleCloudTaskId.ts`; `server/plugins/scheduled-campaign-reconcile.ts` |
| **CRM sync / contacts** | **Kafka** inbound consumer | `server/kafka/plugins/kafka-inbound-consumer.ts` |

Send and schedule **do not** consume Kafka topics and **do not** require `KAFKA_BROKERS`. After a campaign finishes, an **optional** `campaign.send.completed` event may be published for CRM (`notifyCampaignSendCompleted`); set `CAMPAIGN_SEND_KAFKA_NOTIFY=false` to disable.

On Cloud Run with Cloud Tasks enabled, **batch chunks** target `marketing-send-worker` (`CAMPAIGN_SEND_WORKER_URL`); the **web** service enqueues only (`EMAIL_WORKER_DISABLED=true`). See `docs/cloud-run-service-split.md`.

## Flow

1. **`beginCampaignSend`** — builds `CampaignRecipient` rows (frozen audience), sets `status: Sending`, assigns `sendRunId`, enqueues batch page `0`.
2. **`processBatch`** (via `runCampaignBatchJob`) — atomically **claims** pending/failed rows as `sending` (batch size from env/constants), sends one Brevo `messageVersions` request with **`Idempotency-Key`**, marks `sent` / `failed`.
3. **Pipeline** — when more work remains and it is safe to chain, enqueues the next page (`page + 1`). Defers chaining while only in-flight `sending` rows remain (`chainNext: false`).
4. **`finalizeCampaignSendIfComplete`** — when no `pending` or `sending` rows remain → `Sent` or `Failed`.

## Duplicate prevention

| Layer | Mechanism |
| ----- | --------- |
| DB | Only `sent` is final; retries load `pending` + `failed` only |
| Queue | Job/task id `batch\|{db}\|{campaign}\|{sendRunId}\|p{page}` (Cloud Tasks prefixes `cs-`) — skip if already active |
| Worker | Skip chunk when `campaign.sendRunId !== job.sendRunId` or campaign not `Sending` |
| Brevo | `campaignBatchBrevoIdempotencyKey(campaign, sendRunId, page, recipientIds)` |

## Failure handling

- BullMQ: 3 attempts, exponential backoff (5s base).
- Cloud Tasks HTTP handler: always returns **200**; app-level retry re-enqueues with `retryAttempt` / `delayMs` (up to `CAMPAIGN_SEND_MAX_RETRY_ATTEMPTS`).
- Batch API error → all rows in chunk marked `failed` (retryable).
- Stale `sending` (default **2h**, `CAMPAIGN_SEND_STALE_SENDING_MS`) → `failed` so reconcile/retry can continue.
- **Sending reconcile** (web) clears stuck sends and re-enqueues when work remains but no active job/tasks.
- Stale in-flight `sending` (~3m, `CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS`): rows **with** `brevoMessageId` → `sent` (lost DB ack); rows **without** → `pending` (worker died before provider ack) so the next batch can retry.

## Details UI / delivery stats

While status is `Sending`, the campaign Details page:

1. Resumes `/send-campaign/status/:id` polling (retries on transient errors; surfaces copy after repeated failures).
2. Falls back to recipient ledger counts when the status poll has not hydrated yet (avoids a permanent “loading delivery stats…” banner when rows are already `sending`).
3. Counts **Sending** separately from Pending in the recipients summary.
4. Refreshes the detail payload every ~5s so badges/status update without a manual reload.

Custom Marketing send navigates to Details and lets that page own polling (does not start a second poll loop that can race).

## Env (Cloud Tasks)

```env
CLOUD_TASKS_PROJECT_ID=poc-1-aima-pmu
CLOUD_TASKS_LOCATION=us-west1
CLOUD_TASKS_QUEUE_NAME=marketing-test
CAMPAIGN_SEND_WORKER_SECRET=<shared-secret>
# Injected by deploy when send-worker exists:
# CAMPAIGN_SEND_WORKER_URL=https://…/api/internal/campaign-sends/batch
# EMAIL_WORKER_DISABLED=true
```

Cloud Tasks IAM: grant the Cloud Run service account `roles/cloudtasks.enqueuer` on the queue (or project). Prefer ADC on Cloud Run; optional `CLOUD_TASKS_CLIENT_EMAIL` / `CLOUD_TASKS_PRIVATE_KEY` for local.
