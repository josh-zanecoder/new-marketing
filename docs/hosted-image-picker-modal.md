# Hosted image picker (Insert / Replace image)

Used from Email Templates (and similar flows) via `TenantHostedImagePickerModal` when the tenant Images flag is on.

## Upload vs gallery load

Opening the modal fetches the Images library for browsing/selection. That list fetch can take several seconds.

| Control | Blocked when |
| --- | --- |
| **Upload** / file input / “Upload from device” | Only while an upload is in flight (`uploadPending`) |
| Gallery grid | Shows a skeleton during the first empty list fetch |
| Insert / Replace confirm | Until a library image is selected, or while uploading |

Upload must **not** wait for `fetchTenantHostedImages` to finish. Users can upload immediately after the modal opens; list loading is a separate concern.

Gate helpers: `shared/utils/hostedImagePickerUploadGate.ts`.

## Related files

| Area | Path |
| --- | --- |
| Modal | `app/components/tenant/HostedImagePickerModal.vue` |
| Email template Insert/Replace | `app/pages/tenant/email-templates/add.vue` |
| Library list/upload API | `GET` / `POST` `/api/v1/tenant/images` |

## Tests

| Test | Command |
| --- | --- |
| Upload gate unit | `npm run test -- shared/utils/__tests__/hostedImagePickerUploadGate.test.ts` |
| Email template image wiring | `npm run test -- shared/emailTemplateHtmlImageReplace.wiring.test.ts` |
| Upload → template → send-test wiring | `npm run test -- shared/uploadTemplateSendTestImageFlow.wiring.test.ts` |
