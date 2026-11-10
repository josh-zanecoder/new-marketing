# Duplicated campaign — schedule with retained recipients

## Symptom

After **Duplicate** on Marketing → Campaigns:

1. Open the copied draft — recipients already appear selected.
2. **Schedule Send** → pick date/time → **Schedule**.
3. UI shows: `Add recipients before scheduling.`

The copy cannot be scheduled even though recipients were carried over from the source campaign (saved list subset or manual selection).

## Root cause

1. Campaign **list/index** rows omit recipient emails and historically set `recipientsCount: 0` for **list** audiences (only manual rows were counted), even when `ManualRecipient` documents existed for the selected subset.
2. The add/edit wizard `buildCampaignForSend` preferred that **stale list row** from the Pinia store when confirming Schedule.
3. `canScheduleDraft` then saw `recipientsCount: 0` / empty `recipients` and blocked with “Add recipients before scheduling,” while the form still correctly showed the selected people.

Opening the schedule modal could succeed (`recipientsReadyForSchedule` reads the form), then the confirm click failed on the store row.

## Fix

| Area | Change |
| ---- | ------ |
| Wizard | `buildCampaignForSend` always builds from the selected contact ids + `recipientsCount` (never the list-index row) — `add.vue` / `edit/[id].vue` |
| Gate | `useCampaignSendFlow` uses `~~/shared/hasSendableCampaignRecipients` |
| Index count | `campaignIndexRecipientsCount` counts `ManualRecipient` for both `manual` and `list` |
| Cache upsert | `listRowFromDetail` sets `recipientsCount` from detail recipients |

Duplicate API already copies `ManualRecipient` rows (and resolves full list membership when the source had no subset rows).

## Expected behavior

- Duplicated drafts keep recognized recipients for list and manual audiences.
- Schedule succeeds when at least one valid contact id is selected.
- “Add recipients before scheduling” only when the selection is actually empty.

## Tests

```bash
npm run test -- shared/hasSendableCampaignRecipients.test.ts shared/campaignIndexRecipientsCount.test.ts
```
