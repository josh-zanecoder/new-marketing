# Brevo transactional webhooks → Marketing Tracking

Near-real-time delivery events (sent, delivered, opened, clicked, bounces, …) upsert into each tenant’s `brevo_tracking_events` collection so Tracking / campaign Tracking refresh less often.

## Endpoint

```http
POST /api/v1/webhooks/brevo/transactional
```

Public (no session). Authenticated with a shared secret (per-tenant or env).

**URL (prod):** `{NUXT_PUBLIC_MARKETING_BASE_URL}/api/v1/webhooks/brevo/transactional`

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
