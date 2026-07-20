# Email template categories

Tenant-scoped categories for organizing the email template library in **new-marketing**.

## What it does

- Create, edit, and delete categories on **Template categories** (`/tenant/email-templates/categories`)
- Assign a category when creating or editing a template (`/tenant/email-templates/add`)
- Filter the library by category on **Email templates** (alongside the existing subject filter: All templates / With default subject / Without subject)

Deleting a category clears `categoryId` on templates that used it (templates become uncategorized).

## Data model

| Collection / field | Purpose |
| --- | --- |
| `email_template_categories` | Category docs: `name` (unique, case-insensitive), `description`, `sortOrder` |
| `EmailTemplate.categoryId` | Optional ObjectId ref to a category |

API responses include both `categoryId` and resolved `categoryName` for display.

## HTTP API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/tenant/email-template-categories` | List categories |
| `POST` | `/api/v1/tenant/email-template-categories` | Create (`name` required) |
| `PUT` | `/api/v1/tenant/email-template-categories/:id` | Update |
| `DELETE` | `/api/v1/tenant/email-template-categories/:id` | Delete + clear template refs |
| `GET/POST/PUT` | `/api/v1/tenant/email-templates…` | Accept/return `categoryId` / `categoryName` |

## Main code locations

| Area | Path |
| --- | --- |
| Schema | `server/models/tenant/EmailTemplateCategory.ts`, `EmailTemplate.ts` |
| Types | `server/types/tenant/emailTemplateCategory.model.ts` |
| API | `server/api/v1/tenant/email-template-categories/*` |
| Shared helpers | `shared/utils/emailTemplateCategory.ts` |
| FE API | `app/composables/useTenantMarketingApi.ts` |
| Categories page | `app/pages/tenant/email-templates/categories.vue` + `useEmailTemplateCategoriesPage.ts` |
| List filter / assign | `app/pages/tenant/email-templates/index.vue`, `add.vue` |
| Sidebar | `app/constants/marketingSidebarNav.ts` |

## Tests

| Test | Path |
| --- | --- |
| Category normalize / filter / options | `server/utils/emailTemplate/__tests__/emailTemplateCategory.test.ts` |

```bash
npm run test -- server/utils/emailTemplate/__tests__/emailTemplateCategory.test.ts
```
