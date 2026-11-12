# Schedule campaign — success / error notification

## Behavior

After **Schedule Send** succeeds (create wizard, edit wizard, campaign list, campaign details, or custom marketing):

| Result | Feedback |
| ------ | -------- |
| API success | Toast: **Campaign scheduled successfully.** Status → **Scheduled**; list + detail cache updated. |
| API failure | Error toast (and inline modal error where applicable) — **no** success toast. |

## Code map

| Concern | Path |
| ------- | ---- |
| Copy | `shared/campaignScheduleWizardCopy.ts` (`CAMPAIGN_SCHEDULE_SUCCESS`) |
| Create wizard | `app/pages/tenant/campaigns/add.vue` |
| Edit wizard | `app/pages/tenant/campaigns/edit/[id].vue` |
| Campaign list | `app/pages/tenant/campaigns/index.vue` |
| Campaign details | `app/pages/tenant/campaigns/[id].vue` |
| Custom marketing | `app/composables/useCustomMarketingCompose.ts` |

## Tests

```bash
npm run test -- shared/campaignScheduleWizardCopy.test.ts
```
