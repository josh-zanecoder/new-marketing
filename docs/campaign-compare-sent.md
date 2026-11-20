# Campaign compare — Sent metric

`/tenant/campaigns/compare` side-by-side SMTP metrics for 2–5 campaigns.

## Sent (Emails sent)

Compare **Sent** must match campaign **Details → Recipients → Sent**.

| Source | When used |
| --- | --- |
| `CampaignRecipient` rows with `status: 'sent'` | Preferred (same ledger as Details) |
| Stored tracking `requests` (`brevo_tracking_events`) | Fallback when recipient ledger has **0** sent rows |

Do **not** blindly overwrite SMTP `requests` with a zero recipient count — that forced Sent to `0` even when tracking already had sends.

API: `GET /api/v1/tracking/stats/compare` returns `aggregated.requests` (resolved Sent) and `sentRecipients` (same value). The FE Sent row prefers `sentRecipients`.

## Other metrics

Delivered, Trackable openers, Opens, Clicks, Hard bounces come from `brevo_tracking_events` for the selected range (`lifetime=1` = all time). If the campaign has no ingested tracking events, those cells stay `0` until sync/webhooks populate the store — independent of Sent.

## Code

| Piece | Path |
| --- | --- |
| Compare API | `server/api/v1/tracking/stats/compare.get.ts` |
| Recipient sent count | `server/utils/tracking/countCampaignRecipientSent.ts` |
| Sent resolver | `shared/utils/resolveCampaignCompareSentCount.ts` |
| Rate recompute | `server/utils/tracking/withBrevoSmtpRequestsCount.ts` |
| UI | `app/pages/tenant/campaigns/compare.vue` |

## Tests

```bash
cd new-marketing
npm run test -- \
  shared/utils/__tests__/resolveCampaignCompareSentCount.test.ts \
  server/utils/tracking/withBrevoSmtpRequestsCount.test.ts \
  server/utils/tracking/countCampaignRecipientSent.test.ts
```
