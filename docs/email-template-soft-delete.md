# Email template soft delete

Tenant email templates in **new-marketing** support soft delete via `deletedAt`, matching the Contact pattern. Admins can list soft-deleted templates and permanently hard-delete them.

## Behavior

- **Delete** on the Email templates library (`/tenant/email-templates`) opens a confirmation modal, then sets `deletedAt` to now — the row stays in MongoDB
- Soft-deleted templates are hidden from library list, get-by-id, update, and campaign template pickers
- Existing campaigns that already link a template can still resolve HTML for sends (campaign send paths do not require `deletedAt: null`)
- CRM Kafka `email.template.deleted` soft-deletes by `externalId` (no hard `deleteOne`)
- CRM create/update upserts clear `deletedAt: null` so a re-synced template reappears in the library
- **Admin** tenant detail → **Deleted templates** tab lists soft-deleted templates. **Recover** clears `deletedAt` (template returns to the library). **Delete forever** permanently removes the doc (`deleteOne`) and clears `Campaign.emailTemplate` links first. Only soft-deleted templates can be deleted forever.

## Data model

| Field | Purpose |
| --- | --- |
| `EmailTemplate.deletedAt` | `Date \| null` — `null` / missing = active |

## HTTP API

| Method | Path | Notes |
| --- | --- | --- |
| `DELETE` | `/api/v1/tenant/email-templates/:id` | Soft delete; returns `{ ok, alreadyDeleted }` |
| `GET` / `PUT` | `/api/v1/tenant/email-templates…` | Only active templates (`deletedAt: null`) |
| `GET` | `/api/v1/admin/tenants/:tenantId/email-templates/deleted` | Soft-deleted list (admin) |
| `POST` | `/api/v1/admin/tenants/:tenantId/email-templates/:id/recover` | Recover soft-deleted template (`deletedAt: null`) |
| `DELETE` | `/api/v1/admin/tenants/:tenantId/email-templates/:id` | Delete forever (soft-deleted only); returns `{ ok, campaignsCleared }` |

## Main code locations

| Area | Path |
| --- | --- |
| Schema / type | `server/models/tenant/EmailTemplate.ts`, `server/types/tenant/emailTemplate.model.ts` |
| Active / deleted filters | `shared/utils/emailTemplateActive.ts` |
| Soft-delete helper | `server/utils/emailTemplate/softDeleteEmailTemplate.ts` |
| Recover helper | `server/utils/emailTemplate/recoverEmailTemplate.ts` |
| Hard-delete helper | `server/utils/emailTemplate/hardDeleteEmailTemplate.ts` |
| Tenant DELETE API | `server/api/v1/tenant/email-templates/[id].delete.ts` |
| Admin list / recover / delete forever | `…/email-templates/deleted.get.ts` (includes HTML for card previews), `[id]/recover.post.ts`, `[id].delete.ts` |
| Kafka inbound | `server/kafka/handlers/inboundEmailTemplates.ts` |
| Tenant FE | `useTenantMarketingApi.ts`, `useEmailTemplatesPage.ts`, `email-templates/index.vue` |
| Admin FE | `useAdminDeletedEmailTemplates.ts`, `TenantTabsDeletedEmailTemplatesTab`, `TenantAdminDeletedEmailTemplatesPanel`, tenant detail `[dbName].vue` |

## Tests

| Test | Path |
| --- | --- |
| Active / deleted filters | `server/utils/emailTemplate/__tests__/emailTemplateActive.test.ts` |

```bash
npm run test -- server/utils/emailTemplate/__tests__/emailTemplateActive.test.ts
```
