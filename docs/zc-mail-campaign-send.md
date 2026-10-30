# Campaign send via zcMail

Mirrors [CRM ratesheet zcMail bulk](../../mortdash-crm/docs/RATESHEET_ZC_MAIL_BULK.md) for Marketing campaigns.

Transactional campaign batches already used Brevo (`sendTransacEmail` + `messageVersions`). Tenants can now choose **zcMail** as the outbound provider.

## Setup

1. Admin → Tenants → Edit → **Email provider** = `zcMail`
2. Set **zcMail tenant name** (must match a zc-mail SES TenantName), **base URL**, and **API key**
3. Point the zcMail tenant **webhookUrl** at Marketing:

`POST {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/zc-mail/email-status`

4. Set the webhook HMAC secret:
   - **Per-tenant** — Admin → Tenants → Edit → **zcMail webhook secret** (stored on registry `clients.zcMailWebhookSecret`), matching the secret configured on that zcMail tenant webhook
   - **Env fallback** — `ZC_MAIL_WEBHOOK_SECRET` when the tenant has no custom secret
   - Local only: `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED=true`

Existing tenants stay on **Brevo** until you switch them.

## Send path

Campaign batch worker routes:

- `BREVO` → `sendCampaignBatchWithMessageVersions` (unchanged)
- `ZC_MAIL` → `POST /v1/mail/bulk` + poll (`sendZcMailBulk`)

Test emails use `POST /v1/mail/send`.

Each recipient is tagged with `{ source, db, tenant, campaign, user }` so webhooks can resolve the tenant database. Message ids are also stored in registry `email_message_routing` as a fallback.

## Tracking

zcMail `email.status` webhooks upsert into the same tenant `brevo_tracking_events` collection as Brevo. Campaign SMTP stats / Tracking UI keep working.

**Refresh** pulls zcMail **archive** (`GET /v1/mail/archive`) instead of Brevo’s events API:

- List rows in the selected date range → `requests` / `delivered` / `hardBounces`
- Archive detail SES events → opens, clicks, deliveries, bounces (same labels as Brevo). Detail fan-out is capped (2500) so very large campaigns still rely on webhooks for complete open coverage.
- Refresh prefers campaign/tag archive list first (few pages). Per-id `q=<sesMessageId>` only gap-fills missing recipients (capped at 400). If the filter is empty/wrong **or** the list is partial with more than 400 gaps, Refresh falls back to a parallel tenant list scan that keeps matching ids — never unbounded per-id lookups.
- Campaign Statistics / Tracking still auto-Refresh once when Mongo is empty for the selected range (so you get latest archive data, not only webhooks). Manual **Refresh** does the same gap-fill on demand.
- Archive list status `sent` counts as **requests only** (not delivered). Delivered requires SES Delivery / webhook. Bounced messages are excluded from the delivered rate so “100% delivered + hard bounces” cannot happen.
- Analytics **All campaigns** Refresh is list-only (no archive detail GETs) with a hard page cap; opens/clicks rely on webhooks. Select a campaign for a deeper Refresh.
- Campaign **Send test email** (`source: new-marketing-test`) is excluded from campaign Statistics

Opens/clicks also arrive live via webhook. Archive Refresh gap-fills if webhooks were missed; detail GETs are skipped when Mongo already has open/click rows for that message.

Archive rows tagged `mortdash-crm-ratesheet` are ignored so a shared zcMail tenant does not mix ratesheet mail into Marketing.

## Env

Host, API key, tenant slug, and optional webhook secret come from **Admin → Tenants** (`clients.zcMailBaseUrl`, `zcMailApiKey`, `zcMailTenant`, `zcMailWebhookSecret`). Missing base URL falls back to `https://apizcmail.zanecoder.com`.

| Variable | Purpose |
| -------- | ------- |
| `ZC_MAIL_WEBHOOK_SECRET` | Env fallback HMAC secret for inbound webhooks (used when tenant has no custom secret) |
| `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED` | Local only |

## Auth

Marketing resolves the tenant from tags / message routing first, then checks the HMAC signature:

1. **Per-tenant** — Admin → Tenants → Edit → **zcMail webhook secret** (`clients.zcMailWebhookSecret`).
2. **Env fallback** — `ZC_MAIL_WEBHOOK_SECRET` when the tenant has no custom secret.

Header: `X-ZC-Mail-Signature: sha256=<hmac-hex>` over the raw request body.

## Code map

| Concern | Path |
| ------- | ---- |
| Bulk HTTP | `server/utils/zcmail/sendZcMailBulk.ts` |
| Single send | `server/utils/zcmail/sendZcMailEmail.ts` |
| Provider resolve | `server/utils/zcmail/resolveTenantEmailSendConfig.ts` |
| Webhook secret resolve | `server/utils/zcmail/resolveZcMailWebhookSecret.ts` |
| Webhook auth | `server/utils/zcmail/zcMailWebhookRequestAuth.ts` |
| Campaign router | `server/services/campaignOutboundEmail.service.ts` |
| Webhook | `server/api/v1/webhooks/zc-mail/email-status.post.ts` |
| Archive HTTP | `server/utils/zcmail/zcMailArchiveClient.ts` |
| Tracking Refresh | `server/utils/tracking/syncTenantZcMailTrackingEvents.ts` |
