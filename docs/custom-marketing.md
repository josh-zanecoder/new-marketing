# Custom Marketing (plain personal email)

Custom Marketing is a **sidebar nav item** for sending bulk email that still looks like a normal personal message (Gmail-style), with an optional HTML template upload.

## User flow

1. Open **Custom Marketing** in the sidebar (`/tenant/custom-marketing`).
2. Choose a **recipient list** (To). The **first recipient** from that list is shown under the dropdown (name · email), plus total contact count when available.
3. Edit **Subject**.
4. Choose content:
   - **Write message** — plain personal body (defaults provided), or
   - **Upload HTML template** — choose a `.html` / `.htm` file (previewed and sent as-is)
5. Click **Send** — creates a campaign with `templateHtmlSource: custom` and starts the Brevo send pipeline, then opens the campaign detail page.

## Implementation notes

| Piece | Location |
| --- | --- |
| Nav item | `app/constants/marketingSidebarNav.ts` |
| Page | `app/pages/tenant/custom-marketing/index.vue` |
| Compose + send logic | `app/composables/useCustomMarketingCompose.ts` |
| Defaults + plain↔HTML + upload resolve | `shared/customMarketingEmail.ts` |
| HTML file reader | `shared/utils/uploadedEmailHtml.ts` |
| Template source `custom` | `shared/campaignTemplateSource.ts`, EmailTemplate `htmlSource` enum |

- Write mode converts plain body to **minimal HTML**.
- Upload mode sends the uploaded HTML **as-is** (same pipeline as campaign HTML upload).
- Custom templates are **not** saved to the template library (`saveToLibrary: false`).

## Tests

| Test | Path |
| --- | --- |
| Plain↔HTML, upload resolve, source mapping | `shared/__tests__/customMarketingEmail.test.ts` |

```bash
cd new-marketing
node --import tsx --test shared/__tests__/customMarketingEmail.test.ts
```
