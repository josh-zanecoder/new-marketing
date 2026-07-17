# Custom Marketing (personal email + rich text)

Custom Marketing is a **sidebar nav item** for sending bulk email that still looks like a normal personal message (Gmail-style), with TipTap rich text compose or an optional HTML template upload.

## User flow

1. Open **Custom Marketing** in the sidebar (`/tenant/custom-marketing`).
2. Choose a **Recipient list** (separate field).
3. **To** is a readonly input showing only the first recipient email from that list (empty until a list is selected). Bulk send still goes to everyone on the list.
4. Edit **Subject**.
5. Choose content:
   - **Write message** — TipTap rich text compose; click **Preview** for browser + Gmail view, or
   - **Upload HTML template** — choose a `.html` / `.htm` file (previewed and sent as-is)
6. Click **Send** to send now, or **Schedule send** to pick a date/time (same flow as campaign create) — creates a campaign with `templateHtmlSource: custom`, then starts Brevo send or enqueues the scheduled job, and opens the campaign detail page.

## Rich text editor

| Capability | Behavior |
| --- | --- |
| Preview chrome | **Preview** opens a centered modal (backdrop click / Esc / Close) with browser frame + Gmail-like reading pane. Subject/body `{{…}}` tags are filled from the **first contact** on the selected recipient list (`/email/merge-context`). Without a list, tags stay as written. |
| Compose surface | Plain editor under the ribbon while writing |
| Formatting ribbon | Font/size/color/highlight, B/I/U/strike, sub/sup, lists, indent, align, undo/redo, image, two columns, **variable picker**. Hover any control for a label (including font dropdowns and disabled buttons). |
| Images | Paste/insert → GCS upload (defaults to **float left** so you can type beside the photo). When selected: **S/M/L/Full**, **Left/Right** (text wraps beside), **Center** (text below), and an on-photo **trash** control. Drag a corner to resize. Drag the photo to move it. |
| Two columns | Optional fixed side-by-side table. Hover/focus shows an on-block **trash** control that removes the layout and keeps the content. Prefer Left/Right align for free typing beside a photo. |
| Variable picker | Subject: Insert variable select. Body: `{ }` toolbar menu loads `/tenant/dynamic-variables` (falls back to built-in recipient/sender tags). Inserts `{{key}}` at caret. |
| Quick tips panel | Below the editor: Preview, Variables, Photos, Layout (`CustomMarketingEditorTips.vue`) |
| Image folders | `custom-marketing/{tenantName}/{recipientListId\|no-list}/{timestamp-uuid}.jpg` (registry tenant **name**; `no-list` when none selected) |
| From | Tenant default campaign sender (`/tenant/me`) — shown in preview, not editable on this page |

## GCS setup

| Env | Purpose |
| --- | --- |
| `GCS_BUCKET` (or `MARKETING_GCS_BUCKET`) | Bucket name (required for photo insert / send with images) |
| `GCS_PROJECT_ID` | Optional; falls back to `CLOUD_TASKS_PROJECT_ID` / Firebase project |
| `GCS_CLIENT_EMAIL` | SA email, e.g. `marketing-bucket@poc-1-aima-pmu.iam.gserviceaccount.com` |
| `GCS_PRIVATE_KEY_BASE64` | Preferred: PEM private key base64-encoded (`base64 -w0` / `base64`) |
| `GCS_PRIVATE_KEY` | Alternative: PEM with `\n` escapes (falls back to Firebase Admin key) |

Grant the service account **write** on the bucket (`roles/storage.objectAdmin` or objectCreator). Objects need **public read** so Gmail can fetch `https://storage.googleapis.com/...`.

```bash
# Project that owns the bucket
export GCP_PROJECT=poc-1-aima-pmu
export GCS_BUCKET=custom-marketing-images

# Allow public objects (required if "Public access: Not public" / prevent public access is on)
gcloud storage buckets update "gs://${GCS_BUCKET}" \
  --project="${GCP_PROJECT}" \
  --no-public-access-prevention

# Public read for all objects in the bucket (Gmail can load images)
gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --project="${GCP_PROJECT}" \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

Optional — grant the upload SA write access:

```bash
# marketing-bucket SA (preferred) or Firebase SA fallback
export UPLOAD_SA=marketing-bucket@poc-1-aima-pmu.iam.gserviceaccount.com

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --project="${GCP_PROJECT}" \
  --member="serviceAccount:${UPLOAD_SA}" \
  --role=roles/storage.objectAdmin
```

If you prefer not to open the whole bucket, keep prevent-public-access off and rely on per-object `makePublic()` after upload (already attempted in code). Uniform bucket-level access often blocks that — the `allUsers` binding above is the reliable path for email images.

## Implementation notes

| Piece | Location |
| --- | --- |
| Nav item | `app/constants/marketingSidebarNav.ts` |
| Page | `app/pages/tenant/custom-marketing/index.vue` |
| Compose + send / schedule logic | `app/composables/useCustomMarketingCompose.ts` |
| Schedule datetime helpers | `shared/datetimeLocal.ts` |
| TipTap editor logic | `app/composables/useCustomMarketingRichTextEditor.ts` |
| Inbox preview chrome | `app/composables/useCustomMarketingEmailPreviewChrome.ts` |
| Message Preview modal | `app/composables/useCustomMarketingMessagePreview.ts`, `app/composables/useCustomMarketingPreviewMerge.ts`, `shared/customMarketingMessagePreview.ts` |
| TipTap UI shell | `app/components/tenant/CustomMarketingRichTextEditor.vue` |
| Editor CSS | `app/assets/css/custom-marketing-editor.css` |
| Defaults + rich wrap + upload resolve | `shared/customMarketingEmail.ts` |
| Font / image / inbox helpers | `shared/customMarketingEditorOptions.ts` |
| Gmail clip size helpers | `shared/customMarketingEmailSize.ts` |
| Hosted image helpers (data URL ↔ GCS path) | `shared/customMarketingHostedImages.ts` |
| Draggable + resizable image node | `shared/customMarketingDraggableImage.ts` |
| Two-column layout (email table) | `shared/customMarketingTwoColumn.ts` |
| Merge variable helpers | `shared/customMarketingMergeVariables.ts` |
| Variable picker (body) | `app/composables/useCustomMarketingVariablePicker.ts` |
| Quick tips panel | `app/components/tenant/CustomMarketingEditorTips.vue`, `app/composables/useCustomMarketingEditorTips.ts`, `shared/customMarketingEditorTips.ts` |
| External drop vs reposition helper | `shared/customMarketingImageDrag.ts` |
| Image compression | `app/utils/compressCustomMarketingImage.ts` |
| GCS upload + HTML rewrite | `server/services/customMarketingImageUpload.service.ts` |
| Image upload API | `server/api/v1/tenant/custom-marketing/images.post.ts` |
| Paragraph indent | `shared/customMarketingParagraphIndent.ts` |
| List item (Enter → new bullet) | `shared/customMarketingListItem.ts` — content `paragraph block*` so highlight → bullet works; Enter still splits to a new item; `trailingNode` disabled; CSS draws `•` / `1.` markers |
| HTML file reader | `shared/utils/uploadedEmailHtml.ts` |
| Template source `custom` | `shared/campaignTemplateSource.ts`, EmailTemplate `htmlSource` enum |

- Write mode stores a TipTap HTML **fragment** and wraps it in a minimal email document on send.
- Upload mode sends the uploaded HTML **as-is** (same pipeline as campaign HTML upload).
- Custom templates are **not** saved to the template library (`saveToLibrary: false`).
- On campaign save, any leftover `data:image` embeds are rewritten to GCS URLs under the tenant + recipient-list folders.

## Tests

| Test | Path |
| --- | --- |
| Plain↔HTML, rich wrap, upload resolve, editor options, inbox helpers | `shared/__tests__/customMarketingEmail.test.ts` |
| Paragraph indent levels | `shared/__tests__/customMarketingParagraphIndent.test.ts` |
| List item content constraint | `shared/__tests__/customMarketingListItem.test.ts` |
| Gmail clip size helpers | `shared/__tests__/customMarketingEmailSize.test.ts` |
| Hosted image / GCS path helpers | `shared/__tests__/customMarketingHostedImages.test.ts` |
| Image drag vs external drop | `shared/__tests__/customMarketingImageDrag.test.ts` |
| Image resize / align (corners, shrink-wrap, margins) | `shared/__tests__/customMarketingDraggableImage.test.ts` |
| Two-column insert / wrap image | `shared/__tests__/customMarketingTwoColumn.test.ts` |
| Merge variable token / fallback / groups | `shared/__tests__/customMarketingMergeVariables.test.ts` |
| Message Preview modal Escape + merge helpers | `shared/__tests__/customMarketingMessagePreview.test.ts` |
| Schedule datetime-local helpers | `shared/__tests__/datetimeLocal.test.ts` |
| Quick tips copy | `shared/__tests__/customMarketingEditorTips.test.ts` |

```bash
cd new-marketing
node --import tsx --test shared/__tests__/customMarketingEmail.test.ts shared/__tests__/customMarketingParagraphIndent.test.ts shared/__tests__/customMarketingListItem.test.ts shared/__tests__/customMarketingEmailSize.test.ts shared/__tests__/customMarketingHostedImages.test.ts shared/__tests__/customMarketingImageDrag.test.ts shared/__tests__/customMarketingDraggableImage.test.ts shared/__tests__/customMarketingTwoColumn.test.ts shared/__tests__/customMarketingMergeVariables.test.ts shared/__tests__/customMarketingMessagePreview.test.ts shared/__tests__/datetimeLocal.test.ts shared/__tests__/customMarketingEditorTips.test.ts
```