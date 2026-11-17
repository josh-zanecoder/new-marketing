# Template Builder — unsaved changes guard

## Behavior

When Template Builder has unsaved edits (name, subject, or HTML), the app prompts before:

- **Load template** (sidebar list)
- **New blank**
- **In-app navigation** away from `/tenant/template-builder` (sidebar / router)
- **Browser tab close / refresh** (native `beforeunload` only — browsers do not allow custom Stay/Discard/Save there)

No dialog when the editor matches the last saved/loaded snapshot.

## Dialog actions

| Action | Result |
| --- | --- |
| Stay | Cancel; keep editing |
| Discard changes | Continue with load / leave / blank |
| Save changes | Save current template; on success continue; on failure keep the dialog open and show the error **inside the modal** (name/subject required, empty content, API failure, etc.) |

## Save from the header (Save / Save template)

Clicking **Save** / **Save template** / **Save as copy** without going through the unsaved dialog opens **`TemplateSaveErrorModal`** when validation or the API fails. Copy is mapped via `resolveTemplateSaveErrorPresentation` (e.g. missing name → “Name this template” + what to do next), not a raw red “Template name is required.” dump. Inline header error text is not used.

| Concern | Path |
| --- | --- |
| Save-error copy | `shared/constants/templateSaveError.ts` |
| Save-error modal | `app/components/tenant/TemplateSaveErrorModal.vue` |

## Key files

| Concern | Path |
| --- | --- |
| Dirty compare | `shared/utils/isEmailTemplateDirty.ts` |
| Dialog copy | `shared/constants/unsavedTemplateChanges.ts` |
| Guard controller | `shared/utils/unsavedTemplateGuardController.ts` |
| Guard composable | `app/composables/useUnsavedTemplateGuard.ts` |
| Modal UI | `app/components/tenant/UnsavedTemplateChangesModal.vue` |
| Page wiring | `app/pages/tenant/template-builder/index.vue` |
| Load-template ask parent | `EmailTemplateImageBuilder` `hasUnsavedChanges` + `request-load-template` |

## Tests

```bash
npm run test -- shared/utils/__tests__/isEmailTemplateDirty.test.ts shared/constants/__tests__/unsavedTemplateChanges.test.ts shared/utils/__tests__/unsavedTemplateGuardController.test.ts shared/templateBuilderUnsavedChanges.wiring.test.ts
```
