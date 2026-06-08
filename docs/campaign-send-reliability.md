# Campaign send reliability (mortdash-crm ratesheet pattern)

Campaign bulk send uses the same ideas as `mortdash-crm` ratesheet sends: chunked BullMQ jobs, per-recipient delivery ledger, Brevo idempotency, and `sendRunId` to invalidate stale workers.

## Separate from Kafka

| Concern | Stack | Plugin / entry |
| ------- | ----- | -------------- |
| **Send now** | Mongo recipients + **BullMQ** `processCampaignBatch` | `server/plugins/email-worker.ts` |
| **Schedule** | Mongo `Scheduled` + **BullMQ** delayed `startScheduledCampaign` | same queue; `server/plugins/scheduled-campaign-reconcile.ts` |
| **CRM sync / contacts** | **Kafka** inbound consumer | `server/kafka/plugins/kafka-inbound-consumer.ts` |

Send and schedule **do not** consume Kafka topics and **do not** require `KAFKA_BROKERS`. After a campaign finishes, an **optional** `campaign.send.completed` event may be published for CRM (`notifyCampaignSendCompleted`); set `CAMPAIGN_SEND_KAFKA_NOTIFY=false` to disable.

On Cloud Run, the **kafka worker** service disables the email worker; the **web** service runs BullMQ send/schedule reconcile — see `docs/cloud-run-service-split.md`.

## Flow

1. **`beginCampaignSend`** — builds `CampaignRecipient` rows (frozen audience), sets `status: Sending`, assigns `sendRunId`, enqueues batch page `0`.
2. **`processBatch`** (worker) — atomically **claims** up to **500** pending/failed rows as `sending`, sends one Brevo `messageVersions` request with **`Idempotency-Key`**, marks `sent` / `failed`. When every recipient in the chunk shares the same rendered subject/HTML, Brevo gets a **ratesheet-style** compact payload (root content + per-recipient `to` / optional `params`); otherwise each version carries its own merged HTML.
3. **Next page** — worker runs with **concurrency 1** by default (serial chain like ratesheet Cloud Tasks). After a chunk that actually processed recipients, enqueues `page + 1`; if nothing was claimed but work remains, re-enqueues the same page. Does not chain while only stale `sending` rows are in flight (`chainNext: false`).
4. **`finalizeCampaignSendIfComplete`** — when no `pending` or `sending` rows remain → `Sent` or `Failed`.

## Duplicate prevention

| Layer | Mechanism |
| ----- | --------- |
| DB | Only `sent` is final; retries load `pending` + `failed` only |
| BullMQ | Job id `batch\|{db}\|{campaign}\|{sendRunId}\|p{page}` — skip if already active |
| Worker | Skip chunk when `campaign.sendRunId !== job.sendRunId` or campaign not `Sending` |
| Brevo | `campaignBatchBrevoIdempotencyKey(campaign, sendRunId, page, recipientIds)` |

## EmailWorker lock renewal errors

If logs show `[EmailWorker] worker.error` with `could not renew lock for job batch|…`:

| Cause | Fix |
| ----- | --- |
| Batch job longer than BullMQ default lock (30s) | Deploy with `CAMPAIGN_EMAIL_WORKER_LOCK_DURATION_MS` (default **5m** in code) |
| Redis blips during renewal | Stable Redis path (VPC connector); connection retry is enabled in `server/lib/bullmq.ts` |
| Multiple web replicas each running EmailWorker | Set `WEB_MAX_INSTANCES=1` on `marketing-production` (or accept rare duplicate-worker contention) |
| Deploy mid-send | Avoid redeploying web during large sends; `SendingReconcile` recovers stale rows |

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
| `CAMPAIGN_EMAIL_WORKER_CONCURRENCY` | `1` | BullMQ worker parallelism for batch jobs (keep at 1 in prod) |
| `CAMPAIGN_EMAIL_WORKER_LOCK_DURATION_MS` | `300000` (5m) | BullMQ job lock before renewal (default library value 30s is too short for 100-recipient Brevo batches) |
| `CAMPAIGN_SEND_KAFKA_NOTIFY` | (enabled) | Set `false` to skip optional `campaign.send.completed` Kafka publish |
| `EMAIL_WORKER_DISABLED` | — | `true` on kafka-only Cloud Run worker |
| `SCHEDULE_RECONCILE_DISABLED` / `SENDING_RECONCILE_DISABLED` | — | Disable Mongo safety-net ticks |

## Code map

| Area | File |
| ---- | ---- |
| Send orchestration | `server/services/send-campaign.service.ts` |
| Queue | `server/queue/emailQueue.ts` |
| Worker | `server/workers/emailWorker.ts` |
| Brevo batch | `server/services/brevo.service.ts` |
| Constants / idempotency / Brevo batch shape | `server/utils/campaignSend/` |
| Recipient claim | `server/utils/campaignSend/claimCampaignRecipientBatch.ts` |
| Reconcile | `server/services/reconcileStuckSendingCampaigns.ts` |
| Optional CRM notify | `server/kafka/notifyCampaignSendCompleted.ts` |
