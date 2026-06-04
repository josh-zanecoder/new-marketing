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

## Mongo / EPIPE hardening (worker)

Previously, handler errors were logged and **swallowed** → Kafka committed the offset → **chunks skipped permanently** (stuck ~3,274 on large imports).

**Current behavior** (`server/kafka/kafkaProducer.ts`):

| Mechanism | Effect |
|-----------|--------|
| **Re-throw** on inbound handler failure | Failed chunk offset is **not** committed |
| **3× retry** on sync upsert for transient Mongo errors | Covers `EPIPE`, `ECONNRESET`, `MongoNetworkError`, `MongoNotConnectedError` |
| **Consumer restart** after run loop exit | Restarts after `KAFKA_INBOUND_CONSUMER_START_RETRY_MS` (default 30s) |

Deploy **`marketing-kafka-worker`** for this fix to be live. Web redeploy alone does not update sync consumption.

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

When registry tenants gain new Kafka topics (new tenant DB), the worker resubscribes without redeploy (`KAFKA_INBOUND_TOPIC_REFRESH_MS`, default 60s):

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

`[ScheduleReconcile] MongoNotConnectedError` on web is **scheduled email** jobs — **not** CRM contact sync. Safe to ignore for sync troubleshooting.

---

## Stuck import (e.g. 3,274 / 15k)

**Cause:** Mongo dropped mid-sync → old code committed offset anyway → gap in chunks → count stops (~131 chunks × 25).

**Recovery (test):**

1. Do **not** relaunch repeatedly (each launch adds another full sync to the queue).
2. **Clear messages** on tenant topic in Kafka UI (e.g. `marketing.events.15k`).
3. Confirm External Connection `TENANT_ID` matches Marketing registry tenant id.
4. **Launch Marketing once** from CRM.
5. Watch worker for **new `syncId`** and `chunkIndex: 1, 2, 3…`.
6. Optional on CRM: `MARKETING_SYNC_CHUNK_SIZE=10`.

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

---

## Deploy checklist

| Step | Action |
|------|--------|
| 1 | Deploy **CRM backend** (delta launch sync) |
| 2 | Deploy **`marketing-kafka-worker`** once (`DEPLOY_KAFKA_WORKER=true` in test CI if gated) |
| 3 | Clear stuck Kafka topic if needed → **one** CRM launch |
| 4 | Verify worker logs: new `syncId`, rising `chunkIndex`, `syncedCount: 25` |
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
