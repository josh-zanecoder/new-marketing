# Template Builder — Undo / Redo

## Behavior

Template Builder keeps a document history for:

- Email HTML (text, images, sections, layout, styling — anything that updates `html`)
- Template name and subject (debounced while typing)

| Control | Action |
| --- | --- |
| **Undo** | Restore the previous snapshot |
| **Redo** | Restore a snapshot that was undone |
| Ctrl/⌘ Z | Undo |
| Ctrl/⌘ Shift Z or Ctrl/⌘ Y | Redo |

Buttons disable when there is nothing to undo or redo. Loading a template, starting blank, or opening from the route **resets** history. Saving does not clear history, so you can still undo after a save and save again.

Inline text editing uses a `textarea` overlay; browser-native undo applies there while typing. Committing the text (blur) records a Template Builder history step.

## Key files

| Concern | Path |
| --- | --- |
| Limits | `shared/constants/templateBuilderHistory.ts` |
| Stack | `shared/utils/templateBuilderHistory.ts` |
| Vue wiring | `app/composables/useTemplateBuilderHistory.ts` |
| UI + shortcuts | `app/pages/tenant/template-builder/index.vue` |

## Tests

```bash
npm run test -- shared/utils/__tests__/templateBuilderHistory.test.ts shared/constants/__tests__/templateBuilderHistory.test.ts shared/templateBuilderUndoRedo.wiring.test.ts
```
