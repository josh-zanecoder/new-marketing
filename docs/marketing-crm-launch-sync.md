# Marketing ↔ CRM launch sync (worker + operations)

Guide for **consuming** CRM launch sync on Marketing: Kafka worker behavior, Mongo retry hardening, delta logs, topic resubscribe, and recovery from stuck imports.

**CRM publish (delta + in-progress guard):** [MARKETING_LAUNCH_SYNC_DELTA.md](../../mortdash-crm/docs/MARKETING_LAUNCH_SYNC_DELTA.md)

**Stuck backlog runbook:** [marketing-sync-stuck-backlog-runbook.md](./marketing-sync-stuck-backlog-runbook.md)

**Admin external connection JSON:** [admin-crm-external-connection-modal.md](./admin-crm-external-connection-modal.md)

---

## Service split

| Service | Role |
|---------|------|
| **`marketing-test` / `marketing-production` (web)** | UI, API, handoff — **no** inbound Kafka consumer (`KAFKA_INBOUND_CONSUMER_DISABLED=true` on test web) |
| **`marketing-kafka-worker`** | Consumes `marketing.sync.requested`, `contact.*`, email templates — **contact sync runs here** |
| **`marketing-kafka-producer-bridge`** | CRM → Kafka HTTP publish |

Sync logs (`marketing.sync.requested`, `syncedCount`) appear on **`marketing-kafka-worker`**, not the web service.

---

## Pipeline

```text
CRM Launch Marketing
  → marketing.sync.requested chunks (Kafka topic per tenant)
  → marketing-kafka-worker
  → Mongo tenant DB (upsert by externalId, source: crm-kafka)
```

Day-to-day CRM contact changes use **`contact.created`** / **`contact.updated`** on the same topic — no launch required.

---

## CRM chunk size (publish)

Configured on **CRM backend** only (`crmKafkaProducer.ts` → `resolveMarketingSyncChunkSize()`).

| Setting | Value |
|---------|--------|
| Default | **200** contacts per Kafka message |
| Min | **100** |
| Max | **500** (via `MARKETING_SYNC_CHUNK_SIZE` + `MARKETING_SYNC_CHUNK_SIZE_MAX`) |

Marketing **`bulkWrite`** upserts every valid contact in each message (`externalId` + `source: crm-kafka`). Log field **`syncedCount`** = rows written for that chunk (≤ chunk size).

**Why 200:** count cap for throughput. CRM also splits by **`MARKETING_SYNC_CHUNK_MAX_BYTES`** (default **900000**) so heavy `metadata` cannot exceed ~1 MB Kafka messages.

**Worker (200 vs 25):** launch-sync upserts use **`bulkWrite`** then recipient-list sync at **`MARKETING_SYNC_RECIPIENT_LIST_CONCURRENCY`** (default **10**, with Kafka **heartbeat** between batches) so 200 contacts do not run 200 parallel list jobs or lose the consumer session.

**15k example:** ~**75** chunks at 200 vs ~**600** at old default 25.

See CRM doc: [MARKETING_LAUNCH_SYNC_DELTA.md](../../mortdash-crm/docs/MARKETING_LAUNCH_SYNC_DELTA.md).

---

## Mongo / EPIPE hardening (worker)

Previously, handler errors were logged and **swallowed** → Kafka committed the offset → **chunks skipped permanently** (stuck ~3,274 on large imports).

**Current behavior** (`server/kafka/kafkaProducer.ts`):

| Mechanism | Effect |
|-----------|--------|
| **Re-throw** on inbound handler failure | Failed chunk offset is **not** committed |
| **3× retry** on sync upsert for transient Mongo errors | Covers `EPIPE`, `ECONNRESET`, `MongoNetworkError`, `MongoNotConnectedError`, `MongooseServerSelectionError`, `ReplicaSetNoPrimary` |
| **Registry connect** (`server/lib/mongoose.ts`) | Single-flight connect, 3× retry, `invalidateRegistryConnection` on failure, `maxPoolSize` default **15** |
| **Sync upsert** (`inboundContacts.ts`) | One **`bulkWrite`** per chunk (`ordered: false`) — upsert by `externalId` + `source: crm-kafka` |
| **Consumer restart** after run loop exit | Restarts after `KAFKA_INBOUND_CONSUMER_START_RETRY_MS` (default 30s) |

Deploy **`marketing-kafka-worker`** for this fix to be live. Web redeploy alone does not update sync consumption.

---

## Survive worker redeploy (Cloud Run)

On **`marketing-kafka-worker`**, a rolling deploy sends **SIGTERM** to the old revision. The consumer now:

| Mechanism | Effect |
|-----------|--------|
| **Graceful shutdown** (`SIGTERM` / Nitro `close`) | `consumer.stop()` finishes the **current chunk**, then disconnects |
| **No auto-restart during shutdown** | Old revision does not spawn a stray consumer before exit |
| **Kafka heartbeat during sync** | Long Mongo upserts call `heartbeat()` so the member is not evicted mid-chunk |
| **Same consumer group** | New revision joins `KAFKA_CONSUMER_GROUP_ID` and continues from the **last committed offset** |

Logs on deploy:

```text
Kafka inbound consumer shutdown starting { reason: 'SIGTERM' }
Kafka inbound consumer shutdown completed { reason: 'SIGTERM' }
```

**Rules:**

- Prefer **not** redeploying mid-sync when avoidable (large 15k imports).
- Keep worker **min=1, max=1** so only one consumer processes a tenant topic at a time.
- Failed chunks still **re-throw** (not committed) — redeploy during a chunk retry resumes that chunk on the new revision.

Optional env:

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAFKA_CONSUMER_SESSION_TIMEOUT_MS` | `180000` (worker deploy) | Must exceed longest chunk processing time |
| `KAFKA_CONSUMER_HEARTBEAT_INTERVAL_MS` | `3000` | Keepalive interval; also drives in-handler heartbeat ticks |
| `KAFKA_CONSUMER_REBALANCE_TIMEOUT_MS` | `120000` | Max wait for group rebalance |

---

## Delta sync logs (worker)

Search **`marketing-kafka-worker`** logs:

| Log | When |
|-----|------|
| `Kafka inbound marketing.sync.delta started` | First chunk of delta sync (`login_reconcile_delta`) |
| `Kafka inbound marketing.sync.requested` | Every chunk — includes `syncMode: delta \| full` |
| `Kafka inbound marketing.sync.delta completed` | Last chunk of delta sync |
| `Kafka inbound marketing.sync.completed` | Last chunk of full sync |
| `Kafka inbound marketing.sync.requested retry after Mongo error` | Transient Mongo retry (attempt 1–2) |
| `Kafka inbound handler error` | Handler failed — chunk should **not** be committed |

---

## Topic resubscribe logs (worker)

When a new tenant is created/updated in Marketing admin, the worker picks up the new Kafka topic without redeploy:

- **Event:** `requestInboundConsumerTopicsRefresh` after `ensureTenantEventTopic` (web writes a registry signal; worker applies it within ~30s).
- **No blind poll during sync:** worker sets `KAFKA_INBOUND_TOPIC_REFRESH_MS=0` (no 60s resubscribe loop).
- **Signal poll:** `KAFKA_INBOUND_TOPIC_SIGNAL_MS=30000` on worker only — checks `kafka_inbound_consumer_signals` in registry.
- Resubscribe runs only when **topics were added** and **no launch sync chunk** is in progress (otherwise deferred until sync idle).

Optional legacy full registry poll (`KAFKA_INBOUND_TOPIC_REFRESH_MS`, default 60s on non-worker):

| Log | When |
|-----|------|
| `Kafka inbound topic refresh scheduler enabled` | Worker startup |
| `Kafka inbound topic resubscribe starting` | Registry topic list changed (`addedTopics`, `removedTopics`) |
| `Kafka inbound topic resubscribe completed` | Resubscribe succeeded |
| `Kafka inbound topic refresh unchanged` | Debug — no change on tick |

---

## Web instance logs (expected)

On **`marketing-test` web**:

```text
Kafka inbound consumer disabled on this instance
```

`[ScheduleReconcile]` / `[SendingReconcile]` Mongo errors on **web** are **email** safety nets — **not** CRM contact sync. Safe to ignore for sync troubleshooting if the worker still shows rising `chunkIndex` and `syncedCount` (up to CRM chunk size, default **200**).

On **`marketing-kafka-worker`**, deploy sets `SENDING_RECONCILE_DISABLED=true` (with schedule/email disabled) — worker logs should **not** show `[SendingReconcile]`.

---

## Stuck import (e.g. 3,274 / 15k)

**Cause:** Mongo dropped mid-sync → old code committed offset anyway → gap in chunks → count stops partway (e.g. ~17 chunks × 200 ≈ 3,400 contacts).

**Recovery (test):**

1. Do **not** relaunch repeatedly (each launch adds another full sync to the queue).
2. **Clear messages** on tenant topic in Kafka UI (e.g. `marketing.events.15k`).
3. Confirm External Connection `TENANT_ID` matches Marketing registry tenant id.
4. **Launch Marketing once** from CRM.
5. Watch worker for **new `syncId`** and `chunkIndex: 1, 2, 3…`.
6. Optional on CRM: lower `MARKETING_SYNC_CHUNK_SIZE` (min `100`) if Kafka rejects large messages.

Code hardening prevents **new** gaps after worker deploy; it does **not** replay chunks Kafka already skipped on an old run.

---

## Environment variables (Marketing worker)

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAFKA_INBOUND_CONSUMER_DISABLED` | `false` on worker | Must be **false** on worker |
| `KAFKA_INBOUND_TOPIC_REFRESH_MS` | `60000` | Topic poll / resubscribe interval (`0` = off) |
| `KAFKA_INBOUND_CONSUMER_START_RETRY_MS` | `30000` | Consumer start/restart backoff |
| `KAFKA_CONSUMER_GROUP_ID` | `new-marketing-inbound-events` | Consumer group |
| `KAFKA_CONSUMER_FROM_BEGINNING` | `false` | New topics start at latest offset |
| `MONGODB_MAX_POOL_SIZE` | **`15` in code** | Optional override; per-instance pool cap |
| `MARKETING_SYNC_RECIPIENT_LIST_CONCURRENCY` | **`10`** | Parallel recipient-list updates per sync chunk (worker) |

---

## Deploy checklist

| Step | Action |
|------|--------|
| 1 | Deploy **CRM backend** (delta launch sync + chunk size default **200**) |
| 2 | Deploy **`marketing-kafka-worker`** once (`DEPLOY_KAFKA_WORKER=true` in test CI if gated) |
| 3 | Clear stuck Kafka topic if needed → **one** CRM launch |
| 4 | Verify worker logs: new `syncId`, rising `chunkIndex`, `syncedCount` up to chunk size (default 200) |
| 5 | Verify Mongo tenant `contacts` count (`source: crm-kafka`) |

---

## Code references

| Area | File |
|------|------|
| Inbound consumer + retry | `server/kafka/kafkaProducer.ts` |
| Consumer plugin | `server/kafka/plugins/kafka-inbound-consumer.ts` |
| Sync upsert | `server/kafka/handlers/inboundContacts.ts` |
| Tenant DB resolve | `server/kafka/tenantConnection.ts` |
| Mongoose pools | `server/lib/mongoose.ts` |
