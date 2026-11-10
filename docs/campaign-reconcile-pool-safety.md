# Campaign reconcile Mongo pool safety

Sending / Schedule reconcile share the **web** process Mongo pool (`maxPoolSize` default **5**) with zcMail/Brevo webhooks and the Marketing UI. Walking every tenant every 60s plus a webhook burst can exhaust the **app** pool (`MongoWaitQueueTimeoutError`) even when Atlas still has free connections.

## Safe behavior (current)

| Guard | What it does |
| ----- | ------------ |
| Shared gate | Sending + Schedule reconcile never run concurrently on one instance |
| Tenant batch | Each tick only scans `CAMPAIGN_RECONCILE_TENANT_BATCH` tenants (default **8**), rotating round-robin |
| Yield | ~75ms pause between tenants so HTTP handlers can check out sockets |
| Longer interval | Default tick **120s** (min **60s**) |
| Light connect | Reconcile uses `getTenantConnectionByDbName(db, { verifyWithPing: false })` |
| Webhook | Transient Mongo (incl. wait-queue timeout) → clean **503** so zcMail can retry |

Reconcile is **not** disabled. Safety nets still run; they just take gentler bites.

## Env (optional)

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `SENDING_RECONCILE_INTERVAL_MS` | `120000` | Floored at `60000` |
| `SCHEDULE_RECONCILE_INTERVAL_MS` | `120000` | Floored at `60000` |
| `CAMPAIGN_RECONCILE_TENANT_BATCH` | `8` | Max **50** |
| `MONGODB_MAX_POOL_SIZE` | `5` | Raise modestly on **web only** (e.g. `10`) if Atlas connection % stays healthy |
| `SENDING_RECONCILE_DISABLED` / `SCHEDULE_RECONCILE_DISABLED` | unset | Keep `true` on kafka worker |

## Code map

| Concern | Path |
| ------- | ---- |
| Constants | `server/constants/campaignReconcile.ts` |
| Tenant batch | `server/utils/campaignSend/reconcileTenantBatch.ts` |
| Mutex | `server/utils/campaignSend/campaignReconcileGate.ts` |
| Sending reconcile | `server/services/reconcileStuckSendingCampaigns.ts` |
| Schedule reconcile | `server/services/reconcileScheduledCampaigns.ts` |
| zcMail webhook | `server/api/v1/webhooks/zc-mail/email-status.post.ts` |

## Tests

```bash
npm run test -- server/constants/__tests__/campaignReconcile.test.ts server/utils/campaignSend/__tests__/reconcileTenantBatch.test.ts server/utils/campaignSend/__tests__/campaignReconcileGate.test.ts server/lib/__tests__/isTransientMongoError.test.ts
```

| File | Covers |
| ---- | ------ |
| `server/constants/__tests__/campaignReconcile.test.ts` | Interval / batch defaults and clamps |
| `server/utils/campaignSend/__tests__/reconcileTenantBatch.test.ts` | Round-robin batching |
| `server/utils/campaignSend/__tests__/campaignReconcileGate.test.ts` | Mutual exclusion |
| `server/lib/__tests__/isTransientMongoError.test.ts` | Wait-queue timeout is transient |
