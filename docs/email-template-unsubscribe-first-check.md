# Email template unsubscribe first check

Ensures every HTML email template stored in **new-marketing** has a way to unsubscribe, even if the author forgets to add one.

This is the **first check** (on save / upload). See also the [pre-send second check](./campaign-unsubscribe-second-check.md).

## Goal

Every template in the database is “safe”: it contains either:

1. The `{{unsubscribe}}` merge placeholder (filled with a signed per-recipient URL at send time), or
2. An existing unsubscribe URL / `href`, or
3. The system-appended standard unsubscribe footer (which itself uses `{{unsubscribe}}`)

## Logic (on save / upload)

1. Does the HTML contain `{{unsubscribe}}` (whitespace-tolerant)? → **keep as-is**
2. Else, does it already contain an unsubscribe link (`href` or bare `http(s)` URL with `unsubscribe`)? → **keep as-is**
3. Else → **append** the standard footer before `</body>` (or at the end of the fragment)

The footer is marked with `data-marketing-unsubscribe-footer` so it is not appended twice.

## Where it runs

| Path | Behavior |
| --- | --- |
| `POST /api/v1/tenant/email-templates` | Runs before create; response may include `unsubscribeFooterAppended: true` |
| `PUT /api/v1/tenant/email-templates/:id` | Runs when `htmlTemplate` is updated |
| Campaign save (`resolveCampaignEmailTemplateOnSave`) | Runs when persisting campaign HTML into an `EmailTemplate` |
| Kafka inbound email templates | Runs after HTML (or storage-ref) resolve, before upsert |
| FE upload / paste (template add, campaign upload, custom marketing) | Applies the same util so the editor/preview shows the footer immediately |

When the footer is auto-appended on the template create/edit page **or Custom Marketing** (upload / send / schedule), an **info modal** (not a toast) explains what happened. Use **Preview** to open the full HTML preview (with the new footer), then **Got it** to continue.

Send-time merge still replaces `{{unsubscribe}}` via `applyDefaultUnsubscribeMergeValue` / `buildUnsubscribeUrl`.

## Main code locations

| Area | Path |
| --- | --- |
| Constants / footer HTML | `shared/emailTemplateUnsubscribe.ts` |
| First-check util | `shared/utils/ensureEmailTemplateUnsubscribe.ts` |
| Default merge key | `shared/defaultEmailDynamicVariables.ts` (`DEFAULT_UNSUBSCRIBE_MERGE_KEY`) |
| Template create/update API | `server/api/v1/tenant/email-templates/index.post.ts`, `[id].put.ts` |
| Campaign template persist | `server/utils/emailTemplate/resolveCampaignEmailTemplateOnSave.ts` |
| CRM template sync | `server/kafka/handlers/inboundEmailTemplates.ts` |
| Appended-footer modal | `app/components/tenant/UnsubscribeFooterAppendedModal.vue` |
| Modal composable | `app/composables/useUnsubscribeFooterAppendedModal.ts` |
| Template add/edit page | `app/pages/tenant/email-templates/add.vue` |
| Custom Marketing compose | `app/composables/useCustomMarketingCompose.ts`, `app/pages/tenant/custom-marketing/index.vue` |

## Tests

| Test | Path |
| --- | --- |
| Placeholder / URL keep / footer append / no double-append | `server/utils/emailTemplate/__tests__/ensureEmailTemplateUnsubscribe.test.ts` |
| Modal open / dismiss behavior | `server/utils/emailTemplate/__tests__/unsubscribeFooterAppendedModal.test.ts` |

```bash
npm run test -- server/utils/emailTemplate/__tests__/ensureEmailTemplateUnsubscribe.test.ts server/utils/emailTemplate/__tests__/unsubscribeFooterAppendedModal.test.ts
```
