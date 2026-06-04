# Test deploy: optional Kafka worker and bridge

Guide for the **`DEPLOY_KAFKA_WORKER`** and **`DEPLOY_KAFKA_BRIDGE`** flags in [`.github/workflows/deploy-test-marketing.yml`](../.github/workflows/deploy-test-marketing.yml).

These flags control whether a push to **`master`** (or a manual workflow run) redeploys the Kafka inbound worker and Kafka producer bridge on **test**, in addition to the main web service **`marketing-test`**.

---

## Flags

| Flag | Service | Default | Job |
|------|---------|---------|-----|
| `DEPLOY_KAFKA_WORKER` | `marketing-kafka-worker` | `'false'` | `deploy-kafka-worker` |
| `DEPLOY_KAFKA_BRIDGE` | `marketing-kafka-producer-bridge` | `'false'` | `deploy-kafka-bridge` |

The web service **`marketing-test`** is **always** deployed when the workflow runs and health checks pass.

Values must be the string `'true'` or `'false'` (quoted in YAML).

---

## Default behavior (`false` / `false`)

On each test deploy:

| Service | Redeployed? |
|---------|-------------|
| `marketing-test` (web) | Yes |
| `marketing-kafka-worker` | No — keeps current revision |
| `marketing-kafka-producer-bridge` | No — keeps current revision |

Use this when changes only touch the Marketing app (admin UI, API, handoff, email worker, etc.) and **not** the worker or bridge code/config.

---

## Does CRM sync keep running?

**Yes**, when only web is deployed.

Sync path on test:

```text
CRM → marketing-kafka-producer-bridge → Kafka → marketing-kafka-worker → tenant DB
```

Worker and bridge keep running on their existing Cloud Run revisions. Deploying **`marketing-test`** does not restart them (web has `KAFKA_INBOUND_CONSUMER_DISABLED=true`).

Sync logs for inbound Kafka consumption are on **`marketing-kafka-worker`**, not `marketing-test`.

---

## When to set `'true'`

### `DEPLOY_KAFKA_WORKER: 'true'`

Enable when you need to roll out worker changes, for example:

- Kafka consumer startup / retry / topic refresh hardening
- Inbound event handlers under `server/kafka/`
- Worker env changes from the `marketing-test` secret (same secret, worker-specific overrides from `build-cloud-run-env-yaml.sh worker`: disables email worker, schedule/sending reconcile, keeps Kafka consumer on)

After deploy, confirm logs on **`marketing-kafka-worker`** (subscription topics, sync chunk processing; no `[SendingReconcile]`).

### `DEPLOY_KAFKA_BRIDGE: 'true'`

Enable when you need to roll out bridge changes, for example:

- Code under `kafka-producer-bridge/`
- Bridge secret updates (`marketing-kafka-producer-bridge`: `BRIDGE_TOKEN`, `KAFKA_BROKERS`, etc.)

CRM bridge mode uses the bridge URL in CRM external connection metadata; redeploying web alone does not change the bridge.

---

## How to change the flags

Edit the workflow env block:

```yaml
# .github/workflows/deploy-test-marketing.yml
env:
  DEPLOY_KAFKA_WORKER: 'false'
  DEPLOY_KAFKA_BRIDGE: 'false'
```

Commit and push to **`master`**, or run **New Marketing Test Deployment** via **workflow_dispatch**.

Example — deploy web + worker only (bridge unchanged):

```yaml
DEPLOY_KAFKA_WORKER: 'true'
DEPLOY_KAFKA_BRIDGE: 'false'
```

Example — deploy all three:

```yaml
DEPLOY_KAFKA_WORKER: 'true'
DEPLOY_KAFKA_BRIDGE: 'true'
```

---

## How the workflow evaluates flags

Job-level `if` cannot read workflow `env` directly. The **`deploy`** job exports flags from a step, then downstream jobs use `needs.deploy.outputs`:

```yaml
deploy_kafka_worker: ${{ steps.deploy_flags.outputs.deploy_kafka_worker }}
deploy_kafka_bridge: ${{ steps.deploy_flags.outputs.deploy_kafka_bridge }}
```

Worker and bridge jobs run only when:

1. Web health check passed (`test_success == 'true'`), **and**
2. The corresponding flag output is `'true'`.

---

## Production

Production uses [`.github/workflows/deploy-production-marketing.yml`](../.github/workflows/deploy-production-marketing.yml). Worker and bridge deploy on every successful production deploy (no opt-out flags). See [cloud-run-service-split.md](./cloud-run-service-split.md).

---

## Related docs

- [cloud-run-service-split.md](./cloud-run-service-split.md) — web vs worker roles
- [cloud-run-kafka-worker-split-and-consumer-hardening.md](./cloud-run-kafka-worker-split-and-consumer-hardening.md) — consumer hardening and deploy checklist
- [marketing-sync-stuck-backlog-runbook.md](./marketing-sync-stuck-backlog-runbook.md) — sync troubleshooting
