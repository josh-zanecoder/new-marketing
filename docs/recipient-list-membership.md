# Recipient list membership

How dynamic recipient lists decide **which contacts** are members, how that is **stored**, and how it stays **in sync** when contacts change.

## Concepts

### List document fields

| Field | Purpose |
|--------|---------|
| **`membershipScope`** | `'tenant'` \| `'owner_emails'`. Set from the **session** when the list is created or patched. |
| **`membershipOwnerEmails`** | Lowercased email list, **snapshot** of the scoped identity(ies) used for `'owner_emails'` membership. Lets **workers** apply the same rules **without** `event.context.auth`. Empty when `membershipScope === 'tenant'`. |
| **`metadata.ownerEmail`** | List “owner” for **ACL** (who can see the list) and **fallback** for sync if `membershipOwnerEmails` is empty. |
| **`createdBy` / `updatedBy`** | Who created or last edited (user id or email from session). |

### `membershipScope` values

- **`tenant`** — Members are **all non-deleted contacts** that match the list’s **filter criteria** (no extra owner-email filter on contacts).
- **`owner_emails`** — Members must match the criteria **and** fall under the **same contact-owner rules** as the contacts API: `metadata.ownerEmail` must be in **`membershipOwnerEmails`** (or unassigned contacts, per `mergeContactOwnerScopeFilter`).

### How scope is chosen from auth

Implemented in `server/tenant/registry-auth.ts`:

- **`recipientListMembershipScopeFromAuth`** — `tenant` for Firebase tenant sessions, API key with **`tenantWideContacts`**, or API key **without** `contactOwnerScope`. `owner_emails` when the API key session has **`contactOwnerScope`**.
- **`recipientListMembershipOwnerEmailsFromAuth`** — For `owner_emails`, copies **`contactOwnerScope`** (deduped, lowercased), or a single **`tenantUserEmail`**, or `[]`.

## End-to-end flow

### Create — `POST /api/v1/tenant/recipient-list`

1. **`createRecipientList`** in `server/utils/recipient/recipientListService.ts` calls **`resolveRecipientListFiltersFromBody`** (`recipientListMutation.ts`).
2. Set **`membershipScope`** and **`membershipOwnerEmails`** from auth (see above).
3. Set ownership fields via **`recipientListOwnershipFromAuth`** (`metadata.ownerEmail`, `createdBy`, …).
4. Insert the list, then **`rebuildRecipientListMembers`** (`recipientListMembershipQuery.ts`):
   - **`tenant`**: query = filter criteria only (+ `deletedAt` via query builder).
   - **`owner_emails`** + non-empty **`membershipOwnerEmails`**: criteria **and** `mergeContactOwnerScopeFilter(..., membershipOwnerEmails)`.
   - **`owner_emails`** + empty emails: fallback **`mergeTenantOwnerEmailScopeFilter`** with current `auth`.

### Patch — `PATCH /api/v1/tenant/recipient-list/:id`

**`updateRecipientList`** in `recipientListService.ts` recomputes the same membership fields from the current session, saves, then **rebuilds** members with the same rules as create.

### Read — `GET` (index and by id)

Responses include **`membershipScope`** and **`membershipOwnerEmails`** (normalized) so the UI can explain list behavior.

### Background sync — `syncContactRecipientListMembership`

Runs when a **contact** is created/updated (e.g. Kafka path). There is **no user session**.

For each **non-static** list:

1. Rebuild the **criteria query** from persisted `filterRows` / `filters` (same family as full rebuild).
2. If **`membershipScope === 'tenant'`** → use criteria query only.
3. If **`owner_emails'`** → `mergeContactOwnerScopeFilter` with **`membershipOwnerEmails`** from the list; if that array is empty, fall back to **`metadata.ownerEmail`**.

Then add/remove **`RecipientListMember`** rows for the changed contact.

## Main code locations

| Area | Path |
|------|------|
| Auth helpers | `server/tenant/registry-auth.ts` |
| **Create / patch orchestration** | `server/utils/recipient/recipientListService.ts` |
| **Mongo membership query + rebuild** | `server/utils/recipient/recipientListMembershipQuery.ts` |
| **Filter rows from body** | `server/utils/recipient/recipientListMutation.ts` |
| **Legacy / doc normalization** | `server/utils/recipient/recipientListNormalization.ts` |
| Contact sync | `server/utils/recipient/syncContactRecipientListMembership.ts` |
| Owner-email Mongo filter | `server/utils/contactOwnerFilter.ts` |
| Mongoose schema | `server/models/tenant/RecipientList.ts` |
| Types | `server/types/tenant/recipientList.model.ts` |
| HTTP handlers | `server/api/v1/tenant/recipient-list/index.post.ts`, `[id].patch.ts`, `index.get.ts`, `[id].get.ts` |
| Module map | `server/utils/recipient/README.md` |

## Session vs marketing cookie

Browser tenant sessions are **`type: 'tenantApiKey'`** with fields populated from the **marketing tenant JWT** (see `server/middleware/auth.ts` and `server/utils/auth/marketingTenantBrowserSession.ts`): e.g. **`tenantWideContacts`**, **`contactOwnerScope`** (from JWT `owners` / `contactOwnerEmails`), **`tenantUserEmail`**.

## Design intent

- **Interactive** create/patch and **headless** sync should agree: scope is **persisted** on the list (`membershipScope` + `membershipOwnerEmails`), not re-inferred only from `metadata.ownerEmail`.
- **`tenant`** lists behave like “all contacts that match these rules.”
- **`owner_emails`** lists behave like “only contacts I’m allowed to see under owner-email rules,” including **multiple** emails when `contactOwnerScope` lists several.
