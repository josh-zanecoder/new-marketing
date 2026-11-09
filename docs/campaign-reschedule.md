# Campaign reschedule (Scheduled only)

Scheduled campaigns on **Campaign details** expose a **Reschedule** action so users can change send date/time without canceling back to Draft or recreating the campaign.

## UX

| Item | Behavior |
| ---- | -------- |
| Visibility | **Reschedule** appears only when `status === 'Scheduled'` and `scheduledAt` is set |
| Placement | Left of **Send now** on the campaign detail header actions |
| Modal | Same datetime picker as Schedule send; title **Reschedule send**; confirm **Save schedule** |
| Prefill | Current `scheduledAt` (local datetime-local value) |
| Client validation | Rejects invalid / past / less-than-one-minute-ahead times |
| After save | Detail overview, countdown chip, and campaign list refresh to the new `scheduledAt` |

**Cancel** still unschedule → Draft. **Edit** can change content; Reschedule only changes send time.

## API

`POST /api/v1/tenant/send-campaign/schedule` with `{ campaignId, scheduledAt }`.

| Status before | Result |
| ------------- | ------ |
| `Draft` | Schedule (unchanged) → `Scheduled` + enqueue delayed start |
| `Scheduled` | Reschedule → keep `Scheduled`, update `scheduledAt`, replace queue/Cloud Task |
| Other | `400` — only draft or scheduled campaigns can be scheduled |

Lead time: schedule instant must be **≥ 1 minute** from now (`CAMPAIGN_SCHEDULE_MIN_LEAD_MS`).

On enqueue failure while rescheduling, the API attempts to restore the previous `scheduledAt` and re-enqueue; if that also fails, it falls back to Draft (same safety net as a failed first-time schedule).

Response includes `rescheduled: true` when the campaign was already Scheduled.

## Code map

| Concern | Path |
| ------- | ---- |
| Shared validation / copy | `shared/campaignScheduleTime.ts` |
| Schedule / reschedule route | `server/api/v1/tenant/send-campaign/schedule.post.ts` |
| Queue replace | `enqueueScheduledCampaignStart` in `server/queue/emailQueue.ts` |
| FE capability | `canRescheduleScheduled` in `app/composables/useCampaignSendFlow.ts` |
| Detail actions + modal | `app/pages/tenant/campaigns/[id].vue` |
| Client API | `scheduleCampaignSend` in `app/composables/useTenantMarketingApi.ts` |

## Tests

```bash
npm run test -- shared/__tests__/campaignScheduleTime.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/__tests__/campaignScheduleTime.test.ts` | Status allowlist, past/too-soon rejection, valid lead time, ISO parse |
