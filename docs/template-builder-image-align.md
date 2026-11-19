# Template Builder — image left / center / right

## Problem

After inserting and shrinking an image, users could not place it in the middle or right of the email. Drag only moved photos between sections (document flow). Absolute “free float” offsets are stripped because inbox clients ignore them (`emailClientSafeImageHtml`).

## Fix

Email-safe horizontal placement:

| Align | Margins |
| ----- | ------ |
| Left | `margin-left: 0; margin-right: auto` |
| Center | `margin-left: auto; margin-right: auto` |
| Right | `margin-left: auto; margin-right: 0` |

Persisted with `data-email-image-align` so resize can re-apply the same placement.

| Layer | Change |
| ----- | ------ |
| Constants | `shared/constants/emailImageAlign.ts` |
| Utils | `shared/utils/emailTemplateImageAlign.ts` — read / update align |
| Layout | `updateEmailTemplateHtmlImageLayout` accepts optional `align` |
| UI | Selected photo → **Position** Left / Center / Right |

Drag between sections is unchanged. Absolute XY placement remains unsupported (and stripped) for send/preview safety.

## How to verify

1. Template Builder → insert an image (Add → Image, or Uploads)
2. Click the photo so **Position** appears in the sidebar footer
3. Click **Center** or **Right** — a full-width photo shrinks first, then moves
4. Resize again — align stays
5. Save and reopen — align preserved

If Position seems to do nothing, the photo was likely still `width: 100%` (fixed in this change).

## Tests

```bash
npm run test -- shared/constants/__tests__/emailImageAlign.test.ts shared/utils/__tests__/emailTemplateImageAlign.test.ts shared/utils/__tests__/emailTemplateHtmlImages.test.ts
```
