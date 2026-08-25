# Brevo transactional webhooks → Marketing Tracking

Near-real-time delivery events (sent, delivered, opened, clicked, bounces, …) upsert into each tenant’s `brevo_tracking_events` collection so Tracking / campaign Tracking refresh less often.

## Endpoint

```http
POST /api/v1/webhooks/brevo/transactional
```

Public (no session). Authenticated with a shared secret (per-tenant or env).

**URL (prod):** `{marketing-brevo-webhook-production …}/api/v1/webhooks/brevo/transactional`  
After deploy, copy the URL from the GitHub Actions log line `Brevo webhook URL (point Brevo UI here)`.

Legacy (until Brevo UI is updated): `{NUXT_PUBLIC_MARKETING_BASE_URL}/api/v1/webhooks/brevo/transactional` on `marketing-production`.

## Auth

Marketing resolves the tenant from payload tags first, then checks the secret:

1. **Per-tenant** — Admin → Tenants → Edit → **Brevo webhook secret** (stored on registry `clients.brevoWebhookSecret`).
2. **Env fallback** — `BREVO_WEBHOOK_SECRET` when the tenant has no custom secret.

In Brevo’s UI, choose **Token** and paste that secret (Brevo sends `Authorization: Bearer …`).

Also accepted:

| Header / scheme | Notes |
|--------|--------|
| `Authorization: Bearer …` | Brevo **Token** auth |
| `Authorization: Basic …` | Brevo **Basic** — password compared to the secret |
| `x-brevo-webhook-secret` | Custom header (via “Add object” if available) |
| `x-brevo-signature` / `x-brevo-signature-v2` / `x-mailin-custom` | Also accepted |

Local only: `BREVO_WEBHOOK_ALLOW_UNSIGNED=true` skips the header check (never in production).

## Brevo UI setup

1. Brevo → **Transactional** → **Settings** → **Webhook** (or Account → Webhooks).
2. Create a **transactional** webhook pointing at the Marketing URL above.
3. Subscribe to the events you care about (`delivered`, `opened`, `unique_opened`, `click`, `hard_bounce`, `soft_bounce`, `spam`, `blocked`, …).
4. If Brevo supports custom auth headers, set `x-brevo-webhook-secret` to the tenant secret (or env default).  
   If not, put the secret in `X-Mailin-custom` when sending **or** use a reverse proxy that injects the header.  
   (Marketing also accepts `x-mailin-custom` as the auth header value.)

Use a **per-tenant secret** when each client has their own Brevo account/webhook; keep the env secret for a shared default.

## Tenant routing

Payload `tags` must include `db:{mongoDbName}` and/or `tenant:{tenantId}`.  
Campaign sends from Marketing already attach `db:…`, `tenant:…`, `campaign:…`, and optional `user:…`.

Without those tags the webhook returns **404** (cannot choose a tenant DB). Tags are also required to pick a per-tenant webhook secret.

## What gets stored

Each event upserts on `(messageId, event, date)` with:

- email, event, date (ISO from `ts_event` when present)
- tag / campaignId / userEmail (parsed from tags)
- subject, from, ip, link, reason when Brevo sends them

Manual **Refresh** on Tracking still pulls the events report; webhooks keep the store fresher between refreshes.

## Async ingest (Cloud Tasks)

When `CLOUD_TASKS_*` + `CAMPAIGN_SEND_WORKER_SECRET` are set (same as campaign sends), the public webhook **validates auth, enqueues, and returns 200 immediately** — Mongo upsert runs on the **send worker** via:

```http
POST /api/internal/brevo-webhooks/transactional
```

Worker URL defaults to the **origin** of `CAMPAIGN_SEND_WORKER_URL` + `/api/internal/brevo-webhooks/transactional`. Override with `BREVO_WEBHOOK_WORKER_URL` if needed.

| Env | Purpose |
| --- | --- |
| `CLOUD_TASKS_PROJECT_ID`, `CLOUD_TASKS_LOCATION`, `CLOUD_TASKS_QUEUE_NAME` | Shared queue with campaign batches |
| `CAMPAIGN_SEND_WORKER_SECRET` | Auth header on worker HTTP target |
| `CAMPAIGN_SEND_WORKER_URL` | Used to derive Brevo worker origin |
| `BREVO_WEBHOOK_WORKER_URL` | Optional explicit worker POST URL |
| `BREVO_WEBHOOK_ASYNC_DISABLED=true` | Force synchronous ingest (local/debug) |

Public response when queued:

```json
{ "success": true, "accepted": true, "queued": true, "taskId": "bw-…", "messageId": "…", "event": "delivered" }
```

Without Cloud Tasks config, behavior is unchanged (synchronous upsert on the web service).

## Dedicated ingress service (recommended prod)

When `DEPLOY_BREVO_WEBHOOK: 'true'` (default in deploy workflows), Brevo should POST to **`marketing-brevo-webhook-production`** (test: `marketing-brevo-webhook`), not the main UI service. That service only validates auth and enqueues; Mongo upsert still runs on the send worker.

No extra Secret Manager keys — reuses the same `marketing-production` / `marketing-test` secret + injected `CAMPAIGN_SEND_WORKER_URL`.

See also: [cloud-run-service-split.md](./cloud-run-service-split.md), [campaign-send-reliability.md](./campaign-send-reliability.md).

## Quick local test

```bash
curl -sS -X POST "http://localhost:3001/api/v1/webhooks/brevo/transactional" \
  -H "Content-Type: application/json" \
  -H "x-brevo-webhook-secret: $BREVO_WEBHOOK_SECRET" \
  -d '{
    "event": "delivered",
    "email": "test@example.com",
    "ts_event": 1754007300,
    "message-id": "<test.webhook@smtp-relay.mailin.fr>",
    "subject": "Webhook test",
    "tags": ["db:YOUR_TENANT_DB", "campaign:YOUR_CAMPAIGN_ID"]
  }'
```
