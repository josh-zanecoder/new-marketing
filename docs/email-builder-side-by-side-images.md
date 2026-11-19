# Email Builder — side-by-side images

Marketing **Email builder** (GrapesJS at `/tenant/grapes-builder`, and Grapes mode on `/tenant/email-editor`) supports placing multiple images in the same horizontal row using email-safe tables.

## Why tables (not float / absolute)

Inbox clients ignore or break `position` / `float` layouts. Side-by-side images are stored as a presentation table with one image per cell (`data-email-image-row`). That structure survives save, reopen, preview, and send.

## How to use

| Action | Result |
| --- | --- |
| Drag **2 Images** / **3 Images** / **4 Images** from Blocks | Inserts a ready-made image row (same horizontal row) |
| Drop **Image** onto/over another image | While dragging, shows **Side by side**; on drop joins into one row (2 → 3 → 4 max) |
| Drop **Image** clearly in empty space above/below (not over a photo) | Grapes stacks vertically |
| After drop | The green overlay is cleared (it must not stay on screen) |
| Drag an image onto another cell in the same row | Rearranges / swaps so each cell keeps one photo |
| Select the row table | Traits: **Image spacing (px)**, **Image align**, **Vertical align** |
| Select one image in a cell | Resize handles + **Width %** trait (independent per image) |
| Use preset **1/2 Section** / **1/3 Section** | Empty columns — drop an image into each cell |

## QA coverage (CRM-1291)

| Check | How it is satisfied |
| --- | --- |
| Multiple images same row | Blocks + auto-wrap on `component:add` / `component:drag:end` |
| Independent resize | Per-image `emailWidthPct` + resize:end normalizes only that image |
| Alignment / spacing | Row traits sync to `data-email-image-*` attrs and every cell |
| No overlap | Table cells + `display:block; max-width:100%; height:auto; float:none` |
| Rearrange in row | Drop into another cell → move/swap |
| Preview / save / reopen / send | Markup attrs + widths persist in exported HTML |

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
| Width helpers | `shared/utils/emailImageRowWidth.ts` |
| Beside zone helper | `shared/utils/emailImageBesideZone.ts` |
| Beside hit helper | `shared/utils/emailImageBesideHit.ts` |
| Insert into row | `shared/utils/emailImageRowInsert.ts` |
| Cell swap helpers | `shared/utils/emailImageRowSwap.ts` |
| Grapes façade | `shared/utils/grapesEmailImageRow.ts` |
| Grapes beside UX | `shared/utils/grapesEmailImageRowBeside.ts` |
| Grapes blocks | `shared/utils/grapesEmailImageRowBlocks.ts` |
| Grapes traits | `shared/utils/grapesEmailImageRowTraits.ts` |
| Grapes DnD / wrap | `shared/utils/grapesEmailImageRowDnD.ts` |
| Grapes resize | `shared/utils/grapesEmailImageRowResize.ts` |
| Iframe builder | `grapes-builder/src/main.ts` (relative import of shared setup) |
| In-app Grapes mode | `app/pages/tenant/email-editor/index.vue` |

## Tests

```bash
npm run test -- shared/constants/__tests__/emailImageRow.test.ts shared/utils/__tests__/emailImageRow.test.ts shared/utils/__tests__/emailImageRowWidth.test.ts shared/utils/__tests__/emailImageBesideZone.test.ts shared/utils/__tests__/emailImageBesideHit.test.ts shared/utils/__tests__/emailImageRowInsert.test.ts shared/utils/__tests__/emailImageRowSwap.test.ts shared/utils/__tests__/grapesEmailImageRow.wiring.test.ts
```

| Test | Covers |
| --- | --- |
| `shared/constants/__tests__/emailImageRow.test.ts` | Stable markers / trait names |
| `shared/utils/__tests__/emailImageRow.test.ts` | Row HTML, spacing/align patch, wrap helper |
| `shared/utils/__tests__/emailImageRowWidth.test.ts` | Independent width clamp / styles |
| `shared/utils/__tests__/emailImageBesideZone.test.ts` | Left/right vs center drop zones |
| `shared/utils/__tests__/emailImageBesideHit.test.ts` | Parent→iframe mapping + rect hits |
| `shared/utils/__tests__/emailImageRowInsert.test.ts` | Grow row 2→3→4 / refuse 5th |
| `shared/utils/__tests__/emailImageRowSwap.test.ts` | Rearrange cells in the same row |
| `shared/utils/__tests__/grapesEmailImageRow.wiring.test.ts` | Builder wiring + drag/add listeners |

After changing `grapes-builder/src` or shared Grapes helpers, rebuild the static bundle:

```bash
npm run build:grapes
```

Deploy uses `npm run build` (Dockerfile), which already runs `build:grapes` before Nuxt.
