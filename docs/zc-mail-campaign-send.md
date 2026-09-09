# Campaign send via zcMail

Mirrors [CRM ratesheet zcMail bulk](../../mortdash-crm/docs/RATESHEET_ZC_MAIL_BULK.md) for Marketing campaigns.

Transactional campaign batches already used Brevo (`sendTransacEmail` + `messageVersions`). Tenants can now choose **zcMail** as the outbound provider.

## Setup

1. Admin → Tenants → Edit → **Email provider** = `zcMail`
2. Set **zcMail tenant name** (must match a zc-mail SES TenantName), **base URL**, and **API key**
3. Point the zcMail tenant **webhookUrl** at Marketing:

`POST {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/zc-mail/email-status`

4. Set `ZC_MAIL_WEBHOOK_SECRET` (HMAC `X-ZC-Mail-Signature: sha256=…`) or `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED=true` for local only

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
- Archive detail SES events → opens, clicks, bounces (same labels as Brevo)
- Campaign filter uses send tags (`campaign`), archive `campaign`/`tag` query (plus a couple of parallel `q` searches), stored recipient message ids for local matching, and `email_message_routing`. For campaigns with ≤500 stored recipient message ids, Refresh uses parallel `q=<sesMessageId>` directly (fast path). Larger campaigns still try campaign/tag filters first (with early abort when rows don’t match recipient ids), then fall back to the same parallel `q` lookup.
- Campaign **Send test email** (`source: new-marketing-test`) is excluded from campaign Statistics

Opens/clicks also arrive live via webhook. Archive Refresh gap-fills if webhooks were missed; detail GETs are skipped when Mongo already has open/click rows for that message.

Archive rows tagged `mortdash-crm-ratesheet` are ignored so a shared zcMail tenant does not mix ratesheet mail into Marketing.

## Env

Host, API key, and tenant slug come from **Admin → Tenants** (`clients.zcMailBaseUrl`, `zcMailApiKey`, `zcMailTenant`). Missing base URL falls back to `https://apizcmail.zanecoder.com`.

| Variable | Purpose |
| -------- | ------- |
| `ZC_MAIL_WEBHOOK_SECRET` | HMAC secret for inbound webhooks |
| `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED` | Local only |

## Code map

| Concern | Path |
| ------- | ---- |
| Bulk HTTP | `server/utils/zcmail/sendZcMailBulk.ts` |
| Single send | `server/utils/zcmail/sendZcMailEmail.ts` |
| Provider resolve | `server/utils/zcmail/resolveTenantEmailSendConfig.ts` |
| Campaign router | `server/services/campaignOutboundEmail.service.ts` |
| Webhook | `server/api/v1/webhooks/zc-mail/email-status.post.ts` |
| Archive HTTP | `server/utils/zcmail/zcMailArchiveClient.ts` |
| Tracking Refresh | `server/utils/tracking/syncTenantZcMailTrackingEvents.ts` |
