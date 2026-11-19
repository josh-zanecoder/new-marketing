# Template Builder — single selection toggle

## Problem

Sections stayed highlighted with no way to deselect except picking another section. Switching to **Images** and selecting a photo could leave the section highlight on too, so it was unclear what was active.

## Behavior

| Action | Result |
| ------ | ------ |
| Click selected section again | Deselect; editing controls hide |
| Click selected image again | Deselect; Change/Remove (and handles) hide |
| Select section | Clears image selection |
| Select image | Clears section selection |
| Switch Sections ↔ Images (or leave that tab) | Clears the selection from the tab you left |

## Implementation

| Layer | File |
| ----- | ---- |
| Pure helpers | `shared/utils/emailTemplateBuilderSelection.ts` |
| Builder wiring | `app/components/tenant/EmailTemplateImageBuilder.vue` |

## Tests

```bash
npm run test -- shared/utils/__tests__/emailTemplateBuilderSelection.test.ts
```
