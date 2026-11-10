# Delete campaign — success / error notification

## Behavior

From **Campaign List** → Delete (trash) → confirm:

| Result | Feedback |
| ------ | -------- |
| API success | Toast: **Campaign deleted successfully.** Campaign removed from the list (store filters + refresh). |
| API failure | Toast error only — **no** success toast. Modal stays open so the user can retry or cancel. |

## Code map

| Concern | Path |
| ------- | ---- |
| Copy | `shared/campaignDeleteCopy.ts` |
| List delete + toast | `app/pages/tenant/campaigns/index.vue` (`confirmDelete`) |
| Store delete | `app/store/campaignStore.ts` (`deleteCampaign` → `true` / `false`) |

## Tests

```bash
npm run test -- shared/campaignDeleteCopy.test.ts
```
