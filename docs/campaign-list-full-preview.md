# Campaign list Full Preview

Each campaign card on **Campaigns** (`/tenant/campaigns`) includes a **Full preview** action so users can view the complete email without opening detail or edit.

## UX

| Item | Behavior |
| ---- | -------- |
| Placement | Icon button to the right of Duplicate / Delete on every list card |
| Visibility | All statuses (Draft, Scheduled, Sent, Failed, etc.) |
| Click | Loads campaign detail HTML (GET by id) + merge context; opens read-only modal |
| Empty design | Toast: campaign has no email content — modal does not open |
| Close | Modal Close button, backdrop click, or Escape — returns to the list |
| Safety | Preview is read-only; no campaign fields or settings are written |

The modal reuses `TenantEmailTemplatePreviewModal` (desktop / phone width toggle). List index stays lean — it does **not** embed `templateHtml` in the campaigns list API.

## Flow

1. User clicks **Full preview** on a card (`@click.stop` so the detail link does not navigate).
2. `useCampaignListFullPreview` prefers `campaignStore.getCampaignDetailCache(id)`, else `fetchCampaignById`.
3. Fetches merge tags via `fetchEmailMergeContextOrEmpty({ campaignId })`.
4. `buildCampaignListFullPreviewContent` merges subject / body (same Mustache path as campaign detail).
5. Opens the preview modal with merged HTML + subject.

## Code map

| Concern | Path |
| ------- | ---- |
| Copy + merge builder | `shared/campaignListFullPreview.ts` |
| Open / close / load | `app/composables/useCampaignListFullPreview.ts` |
| List wiring | `app/pages/tenant/campaigns/index.vue` |
| Modal UI | `app/components/tenant/EmailTemplatePreviewModal.vue` |
| Detail HTML API | `GET /api/v1/tenant/campaigns/:id` (`templateHtml`) |

## Tests

```bash
npm run test -- shared/__tests__/campaignListFullPreview.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/__tests__/campaignListFullPreview.test.ts` | Action copy, merge without mutation, empty HTML / fallback name |
