# Cloud Run Kafka Worker Split and Inbound Consumer Hardening

Production guide for separating Marketing web from the Kafka inbound consumer, and hardening startup so CRM contact sync no longer stops silently after deploys.

## Why we changed this

Forge Capital Lending CRM → Marketing contact sync stopped around **2,089 contacts** (~chunk 83 of 214) after a Cloud Run redeploy. Root causes:

1. **Redeploy killed the Kafka consumer** mid-sync on `marketing-production`.
2. **Multiple Cloud Run instances** (max=10) caused consumer group rebalancing (`coordinator is not aware of this member`).
3. **Mongo registry read failed at startup** → consumer subscribed to `marketing.events` only, missing `marketing.events.forge_capital_lending`.
4. **Silent fallback** in code made the partial subscription look healthy in logs.

These changes address all four.

---

## Architecture after deploy

Same Docker image, two Cloud Run services:

| Service | Role | Env overrides | Scaling |
|---------|------|---------------|---------|
| `marketing-production` | UI, API, email worker, schedule reconcile | `KAFKA_INBOUND_CONSUMER_DISABLED=true` | min **1**, max **10** |
| `marketing-kafka-worker-production` | Kafka inbound consumer only | `EMAIL_WORKER_DISABLED=true`, `SCHEDULE_RECONCILE_DISABLED=true` | min **1**, max **1** |

Test environment mirrors this with `marketing-test` and `marketing-kafka-worker`.

```
CRM launch → Kafka topic (forge) → marketing-kafka-worker-production (consumer)
User UI/API → marketing-production (no consumer)
```

Related: [cloud-run-service-split.md](./cloud-run-service-split.md), [marketing-sync-stuck-backlog-runbook.md](./marketing-sync-stuck-backlog-runbook.md)

---

## Files changed

### Deploy / infra

| File | Change |
|------|--------|
| `.github/scripts/build-cloud-run-env-yaml.sh` | Builds web vs worker env YAML from the same Secret Manager `.env` |
| `.github/workflows/deploy-production-marketing.yml` | Web deploy disables consumer; new `deploy-kafka-worker` job; scaling env vars |
| `.github/workflows/deploy-test-marketing.yml` | Same pattern for test |

Workflow scaling (top-level env):

```yaml
WEB_MIN_INSTANCES: 1
WEB_MAX_INSTANCES: 10
WORKER_MIN_INSTANCES: 1
WORKER_MAX_INSTANCES: 1
```

Worker deploy runs only after web health check passes.

### Application code

| File | Change |
|------|--------|
| `server/kafka/kafkaProducer.ts` | Registry read retries; loud fallback after retries; safer consumer startup order |
| `server/kafka/plugins/kafka-inbound-consumer.ts` | Retries full consumer start every 30s on failure |

### Docs

| File | Change |
|------|--------|
| `docs/cloud-run-service-split.md` | Split architecture and manual setup |
| `docs/marketing-sync-stuck-backlog-runbook.md` | Updated for worker service and new env vars |

---

## Env builder script

`.github/scripts/build-cloud-run-env-yaml.sh` modes:

| Mode | Strips from secret | Appends |
|------|-------------------|---------|
| `web` | `KAFKA_INBOUND_CONSUMER_DISABLED`, `KAFKA_CRM_CONSUMER_DISABLED` | `KAFKA_INBOUND_CONSUMER_DISABLED=true` |
| `worker` | above + `EMAIL_WORKER_DISABLED`, `SCHEDULE_RECONCILE_DISABLED` | `EMAIL_WORKER_DISABLED=true`, `SCHEDULE_RECONCILE_DISABLED=true` |

Same secret (`marketing-production`) feeds both services; role overrides are applied at deploy time only.

---

## Consumer hardening behavior

### Registry topic load (`listInboundSubscriptionTopics`)

1. Retry reading `marketing.clients` **5 times** (2s apart, configurable).
2. **Success** → subscribe to base topic + all tenant topics from registry.
3. **All retries fail** → **fallback to base topic only** with explicit error log (no silent catch).
4. **Empty registry** → base topic only with warning (valid for fresh installs).

### Startup order

Consumer is marked started only **after** successful Kafka connect + subscribe. Failed subscribe cleans up and allows retry.

### Plugin retry

If startup throws entirely, the plugin logs and retries every **30s** until it succeeds.

### Topic registry refresh (no redeploy for new tenants)

The worker polls `marketing.clients` every **60s** (configurable). When a new tenant topic appears (e.g. `marketing.events.15k`), the consumer **stops and resubscribes** automatically — no Cloud Run redeploy required.

Log when it happens:

```text
Kafka inbound topic registry changed; resubscribing consumer {
  previousTopics: [...],
  topics: [ ..., 'marketing.events.new_tenant' ]
}
```

Set `KAFKA_INBOUND_TOPIC_REFRESH_MS=0` on the worker to disable.

### Optional env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAFKA_INBOUND_REGISTRY_READ_RETRIES` | `5` | Mongo registry read attempts |
| `KAFKA_INBOUND_REGISTRY_READ_RETRY_MS` | `2000` | Delay between attempts |
| `KAFKA_INBOUND_CONSUMER_START_RETRY_MS` | `30000` | Retry full consumer start |

---

## Log patterns to verify

### Healthy worker

```text
Kafka inbound topic registry loaded {
  topics: [ 'marketing.events', 'marketing.events.forge_capital_lending' ]
}
Kafka inbound consumer running { topics: [...], groupId: 'new-marketing-inbound-events-v2' }
Kafka inbound marketing.sync.requested { dBname: 'forge_capital_lending_db', syncedCount: 25, ... }
```

### Degraded (fallback — Forge sync will not run on this instance)

```text
Kafka inbound topic registry read failed; falling back to base topic only
Kafka inbound consumer running { topics: [ 'marketing.events' ] }
```

**Action:** Restart worker once Mongo is stable (redeploy or scale 0→1), then confirm both topics in logs.

### Healthy web (after split)

Web logs should **not** show `Kafka inbound consumer running`. Email worker and API traffic only.

---

## Deploy checklist

1. Merge to `production` branch (or run **workflow_dispatch**).
2. Confirm CI creates/updates:
   - `marketing-production` (consumer disabled)
   - `marketing-kafka-worker-production` (min=1, max=1)
3. Check **worker** logs for both topics (not web).
4. If contacts still ~2,089 → launch Marketing from **Forge CRM** once.
5. Confirm Mongo `forge_capital_lending_db.contacts` with `"source": "crm-kafka"`.

---

## Safe redeploy during sync

| Target | Safe? | Notes |
|--------|-------|-------|
| Web (`marketing-production`) | **Yes** | Consumer runs on worker only |
| Worker | **Careful** | Kills consumer mid-sync; use `KAFKA_INBOUND_CONSUMER_DISABLED=true` on worker to pause, then redeploy without flag to resume from last offset |

---

## What we did not change

- Secret Manager contents (no manual secret edits required)
- CRM external connection metadata (Forge `TENANT_ID`, `DB_NAME`, `MARKETING_API_KEY` unchanged)
- Kafka producer bridge service
- `marketing.clients` registry schema

---

## Summary

| Before | After |
|--------|-------|
| One service runs web + Kafka consumer | Web and worker split |
| Web redeploy kills sync | Worker survives web deploys |
| max=10 on consumer service | Worker max=1; web max=10 |
| Silent Mongo fallback | Retries + loud fallback log |
| Partial topic subscription looked healthy | Clear error when degraded |
