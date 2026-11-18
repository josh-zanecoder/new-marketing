# Email Builder — side-by-side images

Marketing **Email builder** (GrapesJS at `/tenant/grapes-builder`, and Grapes mode on `/tenant/email-editor`) supports placing multiple images in the same horizontal row using email-safe tables.

## Why tables (not float / absolute)

Inbox clients ignore or break `position` / `float` layouts. Side-by-side images are stored as a presentation table with one image per cell (`data-email-image-row`). That structure survives save, reopen, preview, and send.

## How to use

| Action | Result |
| --- | --- |
| Drag **2 Images** / **3 Images** / **4 Images** from Blocks | Inserts a ready-made image row |
| Drop a single **Image** next to another image | Auto-wraps both into a **2 Images** row |
| Select the row table | Traits: **Image spacing (px)**, **Image align**, **Vertical align** |
| Select one image in a cell | Resize handles + **Width %** trait (independent per image) |
| Use preset **1/2 Section** / **1/3 Section** | Empty columns — drop an image into each cell |

## Markup contract

| Attribute | Meaning |
| --- | --- |
| `data-email-image-row="2\|3\|4"` | Outer table for the row |
| `data-email-image-cell` | Column cell holding one image |
| `data-email-image-spacing` | Cell padding in px (spacing between images) |
| `data-email-image-align` | `left` \| `center` \| `right` |
| `data-email-image-valign` | `top` \| `middle` \| `bottom` |

Images use `display:block;width:…%;max-width:100%;height:auto` so they do not overlap.

## Files

| Concern | Path |
| --- | --- |
| Constants | `shared/constants/emailImageRow.ts` |
| HTML helpers | `shared/utils/emailImageRow.ts` |
| Grapes wiring | `shared/utils/grapesEmailImageRow.ts` |
| Iframe builder | `grapes-builder/src/main.ts` (relative import of shared setup) |
| In-app Grapes mode | `app/pages/tenant/email-editor/index.vue` |

## Tests

```bash
npm run test -- shared/constants/__tests__/emailImageRow.test.ts shared/utils/__tests__/emailImageRow.test.ts shared/utils/__tests__/grapesEmailImageRow.wiring.test.ts
```

| Test | Covers |
| --- | --- |
| `shared/constants/__tests__/emailImageRow.test.ts` | Stable markers / counts |
| `shared/utils/__tests__/emailImageRow.test.ts` | Row HTML, spacing/align patch, wrap helper |
| `shared/utils/__tests__/grapesEmailImageRow.wiring.test.ts` | Builder + email-editor import the setup |

After changing `grapes-builder/src`, rebuild the static bundle:

```bash
npm run build:grapes
```
