# Custom Flyers

Tenant tab for flyer images grouped by **Template categories** (same categories as Email templates). Visibility and mutations are controlled by **CRM superadmin role permissions**.

## CRM permissions

| Code | Purpose |
| --- | --- |
| `marketing:flyers:read` | Show the **Custom Flyers** tab and list |
| `marketing:flyers:add` | Upload/add flyers |
| `marketing:flyers:delete` | Delete flyers |

Handoff JWT filtering includes all three codes. Firebase / legacy sessions without a CRM permission snapshot keep full access.

### Seed / rollout (CRM backend)

No migration script. Permissions are seeded in `TenantRegistry` and rolled onto existing Admin/template roles via additive sync (`additiveRolloutPermissionCodes`). Superadmin assigns/adjusts them in the role matrix.

## Categories

Custom Flyers **does not** create its own categories. It reuses `email_template_categories` managed on **Template categories** (`/tenant/email-templates/categories`).

| Collection | Purpose |
| --- | --- |
| `email_template_categories` | Shared groups for templates + flyers |
| `flyers` | Flyer docs: `name`, `categoryId` → EmailTemplateCategory, `imageUrl`, `objectPath`, `deletedAt` |

Deleting a Template category clears `categoryId` on templates **and** flyers.

### Soft delete

Tenant `DELETE /api/v1/tenant/flyers/:id` is a **soft delete** (same pattern as email templates):

| Behavior | Detail |
| --- | --- |
| Persist | Sets `deletedAt` to now; does **not** `deleteOne` the Mongo doc |
| GCS | Hosted object under `custom-marketing/{tenant}/flyers/…` is **kept** |
| List / file | `GET` list and `GET …/file` only return docs with `deletedAt: null` |
| Idempotent | Deleting an already soft-deleted flyer returns `{ ok: true, alreadyDeleted: true }` |

### Superadmin restore

Admin → tenant detail → **Deleted flyers** tab (same pattern as Deleted templates):

| Action | Behavior |
| --- | --- |
| Recover | Clears `deletedAt` so the flyer returns to the tenant Custom Flyers library |
| Delete forever | Hard-deletes the Mongo doc and best-effort deletes the GCS object (soft-deleted only) |

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/admin/tenants/:tenantId/flyers/deleted` | Soft-deleted list |
| `POST` | `/api/v1/admin/tenants/:tenantId/flyers/:id/recover` | Restore |
| `DELETE` | `/api/v1/admin/tenants/:tenantId/flyers/:id` | Delete forever |
| `GET` | `/api/v1/admin/tenants/:tenantId/flyers/:id/file` | Binary for trash PDF preview |

Files are stored in GCS under `custom-marketing/{tenant}/flyers/…` with `Content-Disposition: inline` so PDF/images open in-browser for print.

### Allowed uploads

| Type | MIME |
| --- | --- |
| Images | `image/png`, `image/jpeg`, `image/gif`, `image/webp` |
| PDF | `application/pdf` |

Max size **15MB**. Gallery cards show image thumbnails; PDFs render **page 1** via `pdfjs-dist` (same-origin `GET /api/v1/tenant/flyers/:id/file`). Category chip on the thumbnail (click to filter); distinct **Print** / **View** / **Delete**. `fileName` stores the original upload name when provided.

**View** opens an in-app preview modal (images as-is; PDFs rendered with `pdfjs-dist` pages — no browser PDF toolbar). **Print**: PDFs open the same-origin file URL in a new tab and trigger native print; **images** print via a blank HTML sheet with `@page { margin: 0 }` so Chrome does not stamp date/URL headers (raw image tabs would). Allow pop-ups if print does nothing.

### HTTP API

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/v1/tenant/flyers` | read |
| `GET` | `/api/v1/tenant/flyers/:id/file` | read (binary for PDF thumbnail / open) |
| `POST` | `/api/v1/tenant/flyers` (`name`, `dataUrl` for PDF/image, optional `categoryId`, `originalFileName`) | add |
| `DELETE` | `/api/v1/tenant/flyers/:id` | delete (soft: sets `deletedAt`) |
| `GET` | `/api/v1/tenant/email-template-categories` | used for assign/filter dropdowns |

### UI

| Piece | Path |
| --- | --- |
| Sidebar | `app/constants/marketingSidebarNav.ts` → `/tenant/flyers` |
| Page | `app/pages/tenant/flyers/index.vue` |
| Add modal | `app/components/tenant/AddFlyerModal.vue` + `FlyerPendingFileCard.vue` (preview/chips when file selected; submit disabled until name + file; category via `TenantFilterSelect` field variant, `min-w-0` grid so fields stay inset) |
| Category filter | Page toolbar uses `TenantFilterSelect` (field) beside Filter label |
| Upload loader | `app/components/tenant/FlyerUploadLoader.vue` + `app/assets/css/flyer-upload-loader.css` (animated stack + rotating friendly hints) |
| Empty state | `app/components/tenant/FlyerEmptyState.vue` |
| Flyer card | `app/components/tenant/FlyerCard.vue` |
| Preview modal | `app/components/tenant/FlyerPreviewModal.vue` + `FlyerPdfPreviewViewer.vue` |
| Delete confirm | Reuses `ClientConfirmationModal` (danger) |
| PDF thumbnail | `app/components/tenant/FlyerPdfThumbnail.vue` + `pdfjs-dist` page-1 raster |
| Page logic | `app/composables/useMarketingFlyersPage.ts` |
| API client | `app/composables/useFlyerApi.ts` |
| Group helper | `shared/utils/groupFlyersByCategory.ts` (only categories with ≥1 flyer) |
| Admin trash | `useAdminDeletedFlyers.ts`, `TenantAdminDeletedFlyersPanel`, `TenantTabsDeletedFlyersTab` |

Deep-link filter: `/tenant/flyers?category=<id>` or `?category=uncategorized`. Empty categories are hidden from the gallery sections (filter dropdown still lists all Template categories). Admin trash: `/admin/tenants/:dbName?tab=deletedFlyers`.

## Tests

```bash
cd new-marketing
npm run test -- \
  shared/constants/__tests__/marketingFlyersPermissions.test.ts \
  shared/utils/__tests__/marketingFlyersAccess.test.ts \
  shared/utils/__tests__/normalizeFlyerName.test.ts \
  shared/utils/__tests__/formatFlyerFileSize.test.ts \
  shared/utils/__tests__/sanitizeFlyerOriginalFileName.test.ts \
  shared/utils/__tests__/isGeneratedFlyerObjectFileName.test.ts \
  shared/constants/__tests__/flyerPdfThumbnail.test.ts \
  shared/constants/__tests__/flyerPdfPreview.test.ts \
  shared/utils/__tests__/flyerUpload.test.ts \
  shared/utils/__tests__/flyerPrint.test.ts \
  shared/utils/__tests__/buildFlyerImagePrintHtml.test.ts \
  shared/utils/__tests__/flyerFileUrl.test.ts \
  shared/constants/__tests__/flyerUploadCopy.test.ts \
  shared/utils/__tests__/groupFlyersByCategory.test.ts \
  shared/utils/__tests__/flyerActive.test.ts \
  shared/constants/__tests__/adminDeletedFlyersCopy.test.ts \
  server/utils/__tests__/marketingSidebarNav.test.ts \
  server/utils/flyer/__tests__/requireMarketingFlyersPermission.test.ts \
  server/utils/flyer/__tests__/softDeleteFlyer.test.ts \
  server/utils/flyer/__tests__/recoverFlyer.test.ts \
  server/utils/flyer/__tests__/hardDeleteFlyer.test.ts
```
