# Hosted image access (Images library + email template uploads)

## Problem

Uploads under `custom-marketing/{tenant}/…` are public HTTPS URLs (email clients must load `<img src>`). The **library list / delete** APIs must still isolate who can browse or remove objects so one CRM user does not see another user’s private media.

## Visibility model

| Image metadata | Who can list it | Who can delete it |
| --- | --- | --- |
| `ownerEmail` set (default on upload) | Session whose CRM owner scope includes that email (self, or manager downline) | Same scope |
| `visibility=shared` | Every user in the **same tenant** | Uploader / owner scope only |
| Untagged legacy (no owner, not shared) | Nobody (hidden from all libraries) | Nobody |

Cross-tenant isolation is the GCS prefix: `custom-marketing/{tenantFolder}/…`. Tenants never list another tenant’s prefix.

## Auth mapping (CRM handoff)

| CRM handoff | Image library viewer |
| --- | --- |
| `ownerEmails` / `contactOwnerScope` (e.g. `users:own-ae-only`) | Those emails (+ session email) |
| `tenantWideContacts` (`users:read`) | **Session email only** — not every private image in the tenant |
| No email on session | Shared images only |

Uploads always store `ownerEmail` + `uploadedBy` from the session email. Tenant-wide sessions do **not** auto-tag `visibility=shared`.

## API surface

| Route | Role |
| --- | --- |
| `GET/POST/DELETE /api/v1/tenant/images` | Images gallery (`allowTenantImages`) |
| `GET/POST/DELETE /api/v1/tenant/email-templates/images` | Template builder Uploads / insert-image host |
| `POST /api/v1/tenant/custom-marketing/images` | Custom Marketing editor host |

List/delete pass `hostedImageViewerFromAuth(auth)`. Upload passes `hostedImageOwnershipFromAuth(auth)`.

## Explicit tenant sharing

To publish a company asset into every user’s library, set GCS custom metadata `visibility=shared` on that object (or add a future “Share with tenant” UI that writes the same flag). Until then, new uploads stay private to the uploader’s scope.

## Legacy objects

Images uploaded before ownership metadata may have no `ownerEmail`. They remain reachable by their public URL in already-sent email HTML, but they no longer appear in any user’s library list (avoids leaking older personal uploads across accounts). Re-upload if they should be in the gallery.

## Key files

| Concern | Path |
| --- | --- |
| View / delete rules | `shared/hostedImageAccess.ts` |
| Auth → viewer / ownership | `server/utils/hostedImage/hostedImageAccessFromAuth.ts` |
| GCS list / upload / delete | `server/services/customMarketingImageUpload.service.ts` |

## Tests

```bash
npm run test -- server/utils/hostedImage/__tests__/hostedImageAccess.test.ts
```

| File | Covers |
| --- | --- |
| `server/utils/hostedImage/__tests__/hostedImageAccess.test.ts` | Private isolation (including two tenant-wide users), manager downline, shared visibility, legacy hidden, case-insensitive GCS keys |
