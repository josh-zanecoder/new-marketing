# Custom Marketing (plain personal email)

Custom Marketing is a **sidebar nav item** for sending bulk email that still looks like a normal personal message (Gmail-style).

## User flow

1. Open **Custom Marketing** in the sidebar (`/tenant/custom-marketing`).
2. Choose a **recipient list** (To).
3. Edit **Subject** and **Message** (defaults are provided).
4. Click **Send** — creates a campaign with `templateHtmlSource: custom` and starts the Brevo send pipeline, then opens the campaign detail page.

## Implementation notes

| Piece | Location |
| --- | --- |
| Nav item | `app/constants/marketingSidebarNav.ts` |
| Page | `app/pages/tenant/custom-marketing/index.vue` |
| Compose + send logic | `app/composables/useCustomMarketingCompose.ts` |
| Defaults + plain↔HTML | `shared/customMarketingEmail.ts` |
| Template source `custom` | `shared/campaignTemplateSource.ts`, EmailTemplate `htmlSource` enum |

- Plain body is converted to **minimal HTML** so existing merge + Brevo HTML send still works.
- Custom templates are **not** saved to the template library (`saveToLibrary: false`).

## Tests

| Test | Path |
| --- | --- |
| Plain↔HTML, defaults, source mapping | `shared/__tests__/customMarketingEmail.test.ts` |

```bash
cd new-marketing
node --import tsx --test shared/__tests__/customMarketingEmail.test.ts
```
