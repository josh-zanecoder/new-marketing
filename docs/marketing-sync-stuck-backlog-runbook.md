# Marketing sync stuck backlog runbook

Guide for when CRM → Marketing contact sync is blocked by a large or broken Kafka backlog (example: unused **Convere** tenant with hundreds of `marketing.sync.requested` chunks).

## What we encountered (incident summary)

Forge Capital Lending was configured correctly in CRM external connection metadata and in the marketing registry (`marketing.clients`), but contacts never appeared in `forge_capital_lending_db` after launching Marketing from CRM.

### What was actually wrong (layer by layer)

1. **CRM → Kafka was working**  
   Messages showed up in Kafka UI on `marketing.events.forge_capital_lending` with `marketing.sync.requested`. The bridge, topic, and publish path were fine.

2. **Marketing Kafka consumer was the bottleneck**  
   One consumer processes one message at a time. An old **Convere** sync from June 1 had **606 chunks** (~15k contacts) still sitting on `marketing.events.convere`. The worker spent hours on Convere and rarely reached Forge messages.

3. **Two Cloud Run instances made it worse**  
   Min-instances caused **2 consumer members** in the same group → constant rebalancing (`The group is rebalancing`, `coordinator is not aware of this member`). One instance sometimes subscribed to all topics; another only `marketing.events` when Mongo failed at startup.

4. **Deleting the Convere Kafka topic without removing the registry row crashed the consumer**  
   After clearing/removing `marketing.events.convere` in Kafka UI, Marketing still tried to subscribe to it because the **Convere row remained in `marketing.clients`**. Startup failed with:
   ```text
   Failed to start Kafka inbound consumer
   This server does not host this topic-partition
   ```
   With the consumer dead, **no sync ran at all**, including Forge.

5. **Handoff 401 blocked launch for a while**  
   Regenerating the API key in Marketing admin without updating CRM `MARKETING_API_KEY` caused `POST /api/v1/auth/tenant-handoff` → 401 (`Unknown API key`). Some JWTs also had **Convere’s `tenantId`** (`f0604af4-...`) instead of Forge’s (`ae4d6cdc-...`) when launching from the wrong CRM tenant or before metadata was fixed.

6. **Wrong `tenantId` inside some Kafka messages**  
   Messages on the Forge topic sometimes had `tenantId: f0604af4-...` (Convere) with `dBname: forge_capital_lending_db`. Marketing resolves the Mongo DB by **`tenantId` from the registry**, so mismatched ids would write to the wrong DB even if the consumer ran.

7. **Mongo errors were intermittent, not IP whitelist**  
   Atlas had `0.0.0.0/0` allowed. `ReplicaSetNoPrimary` and `ScheduleReconcile` failures happened under load/deploy churn; Mongo worked at other times (sync chunks with `syncedCount: 25`, admin API 200).

8. **UI login ≠ sync**  
   After handoff was fixed (`tenant-handoff` 200), the dashboard loaded but contacts stayed empty until the **Kafka consumer** was healthy and processing the Forge topic.

### What fixed it (in order)

| Step | Action |
|------|--------|
| 1 | Delete **Convere** from `marketing.clients` (keep Forge) |
| 2 | Cloud Run **min=1, max=1** |
| 3 | `KAFKA_CONSUMER_GROUP_ID=new-marketing-inbound-events-v2` to skip old backlog |
| 4 | Update CRM **`MARKETING_API_KEY`** after any regenerate; confirm **`TENANT_ID`** = Forge |
| 5 | Redeploy Marketing; confirm consumer topics include `marketing.events.forge_capital_lending` |
| 6 | Launch Marketing from **Forge CRM** again |

### What did **not** need changing

Forge CRM external connection JSON (`TENANT_ID`, `DB_NAME`, `KAFKA_TOPIC_MARKETING_EVENTS`, bridge URL/token) was correct once API key and tenant id were aligned. The issue was operational (backlog, consumer crash, handoff), not wrong Forge metadata design.

---

Related docs:

- [cloud-run-kafka-worker-split-and-consumer-hardening.md](./cloud-run-kafka-worker-split-and-consumer-hardening.md) — full change summary (split + hardening)
- [cloud-run-service-split.md](./cloud-run-service-split.md) — web vs Kafka worker Cloud Run services
- [kafka-local.md](./kafka-local.md) — local Kafka / topic naming
- [tenant-handoff-authentication.md](./tenant-handoff-authentication.md) — handoff JWT and API keys
- **mortdash-crm** [KAFKA_BRIDGE_MODE_CLOUD_RUN_SETUP.md](../../mortdash-crm/docs/KAFKA_BRIDGE_MODE_CLOUD_RUN_SETUP.md) — CRM external connection / bridge
- **mortdash-crm** [scripts/kafka/ui/README.md](../../mortdash-crm/scripts/kafka/ui/README.md) — Kafka UI tunnel (production port **8083**)

Code references:

- Consumer plugin: `server/kafka/plugins/kafka-inbound-consumer.ts` — retries startup on registry/Kafka errors
- Topic list from registry: `listInboundSubscriptionTopics()` in same file
- Sync handler: `server/kafka/handlers/inboundContacts.ts` → `upsertContactsFromSyncSnapshot`
- Registry DB: `server/lib/mongoose.ts` (`MONGODB_URI`, `MONGODB_DB_NAME` default `marketing`)

---

## How sync works (short)

1. User opens **Marketing from CRM** (not the Marketing URL directly).
2. CRM publishes `marketing.sync.requested` chunks to Kafka (topic from CRM external connection metadata).
3. **new-marketing** inbound Kafka consumer upserts contacts into the tenant Mongo DB (`source: "crm-kafka"`).

If step 3 is down or busy with another tenant’s backlog, your tenant’s contacts never appear.

---

## Symptoms

| Symptom | Likely cause |
|--------|----------------|
| Marketing UI loads but contacts empty | Consumer not processing your tenant topic |
| Logs show Convere `chunkIndex: N, chunkCount: 606` for days | Old backlog on `marketing.events.convere` |
| `Failed to start Kafka inbound consumer` / `This server does not host this topic-partition` | Subscribing to a **deleted** topic while row still in `marketing.clients` |
| Consumer `topics: [ 'marketing.events' ]` only | Mongo registry read failed after retries — consumer falls back to base topic only (check error log; tenant sync will not run until registry loads on restart/retry) |
| `POST /api/v1/auth/tenant-handoff` **401** | Wrong or regenerated `MARKETING_API_KEY` in CRM |
| Kafka message has wrong `tenantId` vs `dBname` | CRM `TENANT_ID` metadata wrong |
| `ReplicaSetNoPrimary` / Mongo errors | Intermittent Atlas connectivity (not always IP whitelist) |

---

## Marketing env vars (Cloud Run)

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Atlas cluster URI (required) |
| `MONGODB_DB_NAME` | Registry DB name (default **`marketing`**) |
| `KAFKA_BROKERS` | Required for inbound consumer |
| `KAFKA_CONSUMER_GROUP_ID` | Default `new-marketing-inbound-events`; use `-v2` after backlog |
| `KAFKA_INBOUND_CONSUMER_DISABLED` | Set `true` on **worker** only to pause consumer (offset reset) |
| `KAFKA_INBOUND_REGISTRY_READ_RETRIES` | Registry read attempts before consumer start (default **5**) |
| `KAFKA_INBOUND_REGISTRY_READ_RETRY_MS` | Delay between registry read attempts (default **2000**) |
| `KAFKA_INBOUND_CONSUMER_START_RETRY_MS` | Retry full consumer start after failure (default **30000**) |
| `KAFKA_TOPIC_MARKETING_EVENTS` | Base topic (default `marketing.events`) |

See `nuxt.config.ts` runtimeConfig for full list.

---

## Cloud Run baseline (always)

Marketing uses **two services** (same image). See [cloud-run-service-split.md](./cloud-run-service-split.md).

| Service | Min | Max | Consumer |
|---------|-----|-----|----------|
| `marketing-production` (web) | `1` | `10` | **Off** (`KAFKA_INBOUND_CONSUMER_DISABLED=true`) |
| `marketing-kafka-worker-production` | `1` | `1` | **On** |

Sync logs (`Kafka inbound consumer running`, `marketing.sync.requested`) appear on the **worker**, not the web service.

Multiple worker instances cause Kafka consumer group rebalancing — keep worker max at **1**.

Recommended after a backlog incident:

```bash
KAFKA_CONSUMER_GROUP_ID=new-marketing-inbound-events-v2
```

A **new group id** starts at **latest** offset and skips old unread messages without Kafka UI.

---

## Fix path A — Easiest (no Kafka UI): new consumer group

1. Cloud Run → **marketing-kafka-worker-production** → Edit → add or update:
   - `KAFKA_CONSUMER_GROUP_ID=new-marketing-inbound-events-v2`
   - Min **1**, max **1**
2. Deploy **worker** (web deploy is safe anytime).
3. Confirm logs:

   ```text
   Kafka inbound consumer running {
     topics: [ 'marketing.events', 'marketing.events.forge_capital_lending' ],
     groupId: 'new-marketing-inbound-events-v2'
   }
   ```

4. Open Marketing from CRM again.
5. Look for:

   ```text
   Kafka inbound marketing.sync.requested {
     tenantId: '<your-marketing-tenant-id>',
     dBname: '<your-tenant-db>',
     syncedCount: 25
   }
   ```

---

## Fix path B — Remove unused tenant (Convere example)

Use when a tenant is **unused** but still blocks the consumer.

### B1. Delete from marketing registry

MongoDB Compass → database **`marketing`** → collection **`clients`**.

**Delete** the unused row (example Convere):

| Field | Example |
|-------|---------|
| `name` | `Convere` |
| `dbName` | `convere_db` |
| `tenantId` | `f0604af4-384f-4059-a405-20671dc00610` |
| `kafkaOutboundTopic` | `marketing.events.convere` |

**Do not delete** active tenants (e.g. Forge Capital Lending).

Why: `listInboundSubscriptionTopics()` reads all `clients` rows. If Convere’s Kafka topic was deleted but the row remains, the consumer crashes:

```text
Failed to start Kafka inbound consumer
This server does not host this topic-partition
```

### B2. Clear or remove the Kafka topic (optional)

Kafka UI → topic `marketing.events.convere`:

- **Clear messages** — drop backlog, keep topic name
- **Remove topic** — OK if tenant is permanently unused

### B3. Redeploy Kafka worker

1. Redeploy **marketing-kafka-worker-production** (min/max = 1).
2. Confirm consumer topics **exclude** the removed tenant topic.
3. Launch Marketing from CRM again.

---

## Fix path C — Kafka UI: reset consumer offset

Use when you must keep the old consumer group name and skip backlog on one topic.

### C1. Open Kafka UI (production)

From **mortdash-crm** repo (Kafka UI scripts live there):

```bash
chmod +x scripts/kafka/connect-kafka-ui-tunnel-production.sh
chmod +x scripts/kafka/ui/*.sh
./scripts/kafka/connect-kafka-ui-tunnel-production.sh
```

Open **http://localhost:8083**

### C2. Stop the consumer (required)

Kafka rejects offset reset while the group is **Stable**.

**Option 1 — Cloud Run scaling (worker)**

- On **marketing-kafka-worker-production**: min instances **0**, max **1**.
- Wait until no worker instances are running.

**Option 2 — Disable consumer (worker)**

On **marketing-kafka-worker-production** only:

```bash
KAFKA_INBOUND_CONSUMER_DISABLED=true
```

Deploy worker, wait ~1 minute.

### C3. Reset offset

Kafka UI → **Consumer groups** → your group (e.g. `new-marketing-inbound-events`).

For the **stuck topic only** (e.g. `marketing.events.convere`):

- Reset type: **LATEST**
- Partitions: **all**
- Click **Reset offsets**

Do **not** reset active tenant topics unless you want to skip their pending sync too.

### C4. Start worker again

- Remove `KAFKA_INBOUND_CONSUMER_DISABLED` from **worker** if used.
- Worker min **1**, max **1** → deploy.
- Launch from CRM.

If reset fails with *"group is in Stable state"*, the consumer is still running — repeat C2.

---

## Fix path D — Delete consumer group (Kafka UI)

Consumer group → ⋮ menu → **Delete consumer group**.

Redeploy **marketing-kafka-worker-production**. Startup creates a fresh group (`fromBeginning: false` → new messages only).

Pair with path B if a deleted topic caused startup failure.

---

## Handoff / API key checklist

Sync is triggered on CRM launch. Handoff must return **200** first.

| Check | Expected |
|-------|----------|
| `POST /api/v1/auth/tenant-handoff` | **200** |
| JWT `sub` in `/auth/tenant-callback` | Matches `clients.tenantId` for that tenant |
| CRM `MARKETING_API_KEY` | Current full `nmk_...` from Marketing admin |
| After **Regenerate API key** in admin | Update CRM external connection immediately |

401 messages: `Unknown API key`, `Handoff tenant mismatch`, `Invalid or expired handoff token`.

---

## Verify Kafka envelope (CRM publish)

Topic e.g. `marketing.events.forge_capital_lending` — message root fields must align:

```json
{
  "tenantId": "<clients.tenantId>",
  "dBname": "<clients.dbName>",
  "eventType": "marketing.sync.requested"
}
```

Marketing resolves the tenant DB by **`tenantId`** (registry lookup), not `dBname` alone. Mismatched `tenantId` writes contacts to the wrong database.

---

## Verify success

### Cloud Run logs (worker service)

Filter **marketing-kafka-worker-production**:

```text
Kafka inbound consumer running { topics: [ ..., 'marketing.events.<tenant>' ] }
Kafka inbound marketing.sync.requested { syncedCount: 25, ... }
```

### MongoDB Compass

Tenant DB (e.g. `forge_capital_lending_db`) → **`contacts`** with `"source": "crm-kafka"`.

---

## MongoDB notes

- `MONGODB_URI` — same URI as Compass.
- `MONGODB_DB_NAME` — optional; defaults to **`marketing`** in `server/lib/mongoose.ts`.
- Atlas `0.0.0.0/0` can still show intermittent `ReplicaSetNoPrimary` — use one Cloud Run instance.

---

## Quick decision tree

```text
Contacts not syncing?
├─ tenant-handoff 401? → Fix MARKETING_API_KEY + TENANT_ID in CRM
├─ Consumer failed to start / topic-partition? → Delete unused row from marketing.clients
├─ Huge lag on unused topic? → KAFKA_CONSUMER_GROUP_ID=v2 OR reset offset OR clear topic
├─ Consumer only on marketing.events? → Redeploy after Mongo stable
└─ Handoff 200 but no sync log? → Launch from CRM again; check Kafka topic
```

---

## Unused tenant cleanup checklist

- [ ] Delete unused document from `marketing.clients`
- [ ] Kafka UI: clear or remove that tenant’s topic (optional)
- [ ] Cloud Run worker: min=1, max=1
- [ ] Cloud Run web: consumer disabled (CI sets `KAFKA_INBOUND_CONSUMER_DISABLED=true`)
- [ ] Redeploy marketing-kafka-worker-production
- [ ] Confirm consumer `topics` lists only active tenants
- [ ] CRM external connection: matching `TENANT_ID` + `MARKETING_API_KEY`
- [ ] Launch Marketing from CRM
- [ ] Confirm `marketing.sync.requested` + `syncedCount` in logs
- [ ] Confirm tenant `contacts` with `source: "crm-kafka"`
