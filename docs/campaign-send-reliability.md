# Campaign send reliability (mortdash-crm ratesheet pattern)

Campaign bulk send uses the same ideas as `mortdash-crm` ratesheet sends: chunked jobs, per-recipient delivery ledger, Brevo idempotency, and `sendRunId` to invalidate stale workers.

**Batch transport:** **Google Cloud Tasks** when `CLOUD_TASKS_ENABLED=true` (test/prod queue `marketing-test`, `us-west1`); otherwise **BullMQ** + Redis for local dev.

## Separate from Kafka

| Concern | Stack | Plugin / entry |
| ------- | ----- | -------------- |
| **Send now (batch chunks)** | Mongo recipients + **Cloud Tasks** → `POST /api/internal/campaign-sends/batch` (or BullMQ locally) | `server/queue/campaignCloudTasksQueue.ts` |
| **Schedule** | Mongo `Scheduled` + **BullMQ** delayed `startScheduledCampaign` | `server/plugins/email-worker.ts`; `server/plugins/scheduled-campaign-reconcile.ts` |
| **CRM sync / contacts** | **Kafka** inbound consumer | `server/kafka/plugins/kafka-inbound-consumer.ts` |

Send and schedule **do not** consume Kafka topics and **do not** require `KAFKA_BROKERS`. After a campaign finishes, an **optional** `campaign.send.completed` event may be published for CRM (`notifyCampaignSendCompleted`); set `CAMPAIGN_SEND_KAFKA_NOTIFY=false` to disable.

On Cloud Run, the **kafka worker** service disables the email worker; the **web** service runs BullMQ send/schedule reconcile — see `docs/cloud-run-service-split.md`.

## Flow

1. **`beginCampaignSend`** — builds `CampaignRecipient` rows (frozen audience), sets `status: Sending`, assigns `sendRunId`, **fan-out enqueues** up to **`CAMPAIGN_SEND_FANOUT_COUNT`** (default **20**) batch tasks in parallel.
2. **`processBatch`** (worker) — atomically **claims** pending/failed rows as `sending` (up to **500** for static blast HTML, **200** default when merge tags present), sends one Brevo `messageVersions` request with **`Idempotency-Key`**, marks `sent` / `failed`. Uniform HTML uses a compact ratesheet-style Brevo payload.
3. **Pipeline** — completing workers **replenish** one task at `page + fanout` to keep ~fanout batches in flight per campaign. Empty claim with remaining work triggers a new fan-out wave. Does not chain while only stale `sending` rows are in flight (`chainNext: false`).
4. **Send-run cache** — template, dynamic-variable bindings, and registry metadata are memoized in-process per `sendRunId` (invalidates on campaign/template `updatedAt`); contacts and rendered HTML are never cached.
4. **`finalizeCampaignSendIfComplete`** — when no `pending` or `sending` rows remain → `Sent` or `Failed`.

## Duplicate prevention

| Layer | Mechanism |
| ----- | --------- |
| DB | Only `sent` is final; retries load `pending` + `failed` only |
| Queue | Task/job id `cs-batch\|{db}\|{campaign}\|{sendRunId}\|p{page}` (Cloud Tasks) or same without `cs-` prefix (BullMQ) — skip if already active |
| Worker | Skip chunk when `campaign.sendRunId !== job.sendRunId` or campaign not `Sending` |
| Brevo | `campaignBatchBrevoIdempotencyKey(campaign, sendRunId, page, recipientIds)` |

## Failure handling

- BullMQ: 3 attempts, exponential backoff (5s base).
- Batch API error → all rows in chunk marked `failed` (retryable).
- Stale `sending` (default **2h**, `CAMPAIGN_SEND_STALE_SENDING_MS`) → `failed` so reconcile/retry can continue.
- **`reconcileStuckSendingCampaigns`** (web plugin): clear stale sending, finalize idle jobs, re-enqueue if pending but no BullMQ job.
- **`POST /api/v1/tenant/send-campaign/retry-failed`** — new `sendRunId`, only non-`sent` recipients.

## Env

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `CAMPAIGN_SEND_STALE_SENDING_MS` | `7200000` (2h) | Stale `sending` → `failed` |
| `CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS` | `180000` (3m) | Stale `sending` → `sent` when Brevo likely delivered |
| `CLOUD_TASKS_ENABLED` | `false` | `true` on test/prod to enqueue batch chunks to Cloud Tasks |
| `CLOUD_TASKS_PROJECT_ID` | — | GCP project (e.g. `poc-1-aima-pmu`) |
| `CLOUD_TASKS_LOCATION` | `us-west1` | Queue region |
| `CLOUD_TASKS_QUEUE_NAME` | `marketing-test` | Cloud Tasks queue ID |
| `MARKETING_PUBLIC_BASE_URL` | — | Cloud Run origin; worker path appended automatically |
| `CAMPAIGN_SEND_WORKER_SECRET` | — | `X-Campaign-Send-Worker-Secret` on worker HTTP POST |
| `CAMPAIGN_SEND_FANOUT_COUNT` | `20` | Parallel batch tasks at send start (1–30) |
| `CAMPAIGN_SEND_BATCH_SIZE_UNIFORM` | `500` | Chunk size when subject/body has no merge tags |
| `CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED` | `200` | Chunk size when `{{…}}` merge tags or recipient dynamic vars |
| `CAMPAIGN_EMAIL_WORKER_CONCURRENCY` | `3` | BullMQ worker parallelism (local / scheduled-start only when Cloud Tasks on) |
| `CAMPAIGN_SEND_KAFKA_NOTIFY` | (enabled) | Set `false` to skip optional `campaign.send.completed` Kafka publish |
| `EMAIL_WORKER_DISABLED` | — | `true` on kafka-only Cloud Run worker |
| `SCHEDULE_RECONCILE_DISABLED` / `SENDING_RECONCILE_DISABLED` | — | Disable Mongo safety-net ticks |

## Code map

| Area | File |
| ---- | ---- |
| Send orchestration | `server/services/send-campaign.service.ts` |
| Queue (BullMQ + CT router) | `server/queue/emailQueue.ts` |
| Cloud Tasks adapter | `server/queue/campaignCloudTasksQueue.ts` |
| Batch worker HTTP | `server/api/internal/campaign-sends/batch.post.ts` |
| Batch job runner | `server/services/runCampaignBatchJob.ts` |
| BullMQ worker (schedule) | `server/workers/emailWorker.ts` |
| Brevo batch | `server/services/brevo.service.ts` |
| Constants / idempotency / Brevo batch shape | `server/utils/campaignSend/` |
| Recipient claim | `server/utils/campaignSend/claimCampaignRecipientBatch.ts` |
| Reconcile | `server/services/reconcileStuckSendingCampaigns.ts` |
| Optional CRM notify | `server/kafka/notifyCampaignSendCompleted.ts` |
