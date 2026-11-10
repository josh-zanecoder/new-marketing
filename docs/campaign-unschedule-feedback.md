# Cancel scheduled campaign — success / error notification

## Behavior

When a user cancels a **Scheduled** campaign:

1. Campaign List opens a confirm modal (`Cancel scheduled send`).
2. On success:
   - Status updates to **Draft** (list row + detail cache).
   - Toast: **Campaign schedule canceled successfully.**
3. On failure:
   - Toast shows the API error (or fallback: could not cancel…).
   - **No** success toast.

Campaign Details **Cancel** uses the same success/error toast copy after the API call.

## Code map

| Concern | Path |
| ------- | ---- |
| Copy | `shared/campaignUnscheduleCopy.ts` |
| List cancel + toast | `app/pages/tenant/campaigns/index.vue` (`confirmUnschedule`) |
| Detail cancel + toast | `app/pages/tenant/campaigns/[id].vue` (`handleUnschedule`) |
| Toast host | `app/layouts/default.vue` → `UiAppToastHost` |

## Tests

```bash
npm run test -- shared/campaignUnscheduleCopy.test.ts
```
