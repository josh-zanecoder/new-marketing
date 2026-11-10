# Cancel scheduled campaign (list + detail)

## Symptom

From **Marketing → Campaigns**, clicking the cancel (X) action on a **Scheduled** campaign returned **400**:

`Only scheduled campaigns can be unscheduled`

The row stayed Scheduled in the UI and the send was not cancelled.

## Root causes

1. **Strict status check** — `DELETE /api/v1/tenant/send-campaign/schedule/:id` rejected anything other than exact `status === 'Scheduled'`. Retries after a successful cancel (or a stale list still showing Scheduled) produced the same 400.
2. **Stale list after cancel** — the list called `fetchCampaigns()` **without** `force: true`, so a 15s cache could keep showing Scheduled and the cancel button after DB was already Draft.
3. **No user feedback** — failures were silent on the list; successes did not show a confirmation banner.

## Fix

| Area | Change |
| ---- | ------ |
| Eligibility | `decideCampaignUnschedule` / `canUnscheduleCampaign` — cancel when Scheduled, or Draft with leftover `scheduledAt`; idempotent OK when already Draft |
| API | `schedule/[campaignId].delete.ts` — ObjectId cast, richer reject message, `alreadyCancelled` response |
| List UI | Confirm modal, optimistic Draft update, `fetchCampaigns({ force: true })`, success/error banners |
| Capability | `canCancelScheduledSend` — hide cancel for Sent / Sending / etc. |

Cancel still deletes Cloud Tasks / BullMQ delayed start jobs, then sets `Draft` and unsets `scheduledAt`.

## Tests

```bash
npm run test -- shared/campaignUnscheduleEligibility.test.ts shared/campaignUnscheduleCopy.test.ts
```
