# Template Builder — blank content blocks

## Problem

**New Blank** in Template Builder looked image-only: users could upload/insert images but had no way to add text, headings, buttons, rows, or other content.

## Cause

`EmailTemplateImageBuilder` gates the **Add** panel (and block move/edit) behind `canEditText`. Template Builder was wiring:

```vue
:can-edit-text="allowTenantEditText"
```

`allowTenantEditText` defaults to **false**, while upload was already hardcoded on:

```vue
:can-upload-image="true"
```

So a tenant with Template Builder on (but Edit text off) only saw **Sections / Images / Uploads**. Blank starter HTML is an empty column, so Sections looked empty too.

## Fix

| Layer | Change |
| ----- | ------ |
| Template Builder page | `:can-edit-text="true"` — building from scratch always includes Add blocks |
| Builder UI | Default side panel to **Add** when `canEditText` so New Blank shows Content / Rows immediately |
| Admin copy | Template builder + Edit text descriptions clarify Add blocks |

Email editor / Add template still use `:can-edit-text="allowTenantEditText"`.

## How to verify

1. CRM → Marketing → Template Builder → **New Blank**
2. Left sidebar shows **Add** (Content + Rows): Title, Paragraph, Button, Divider, column rows, etc.
3. Click or drag blocks onto the canvas; edit text; rearrange; remove; preview
4. Save and reopen — layout and content persist

## Tests

```bash
npm run test -- shared/templateBuilderBlankContentBlocks.wiring.test.ts shared/tenantFeaturePermissions.test.ts shared/utils/__tests__/emailTemplateBlocks.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/templateBuilderBlankContentBlocks.wiring.test.ts` | Page enables Add; builder defaults to Add; catalog kinds; admin copy |
| `shared/utils/__tests__/emailTemplateBlocks.test.ts` | Starter HTML + insert block behavior |
