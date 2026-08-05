# Campaign unsubscribe second check (pre-send)

Final safety check before a campaign is queued for sending. Complements the [first check on template save](./email-template-unsubscribe-first-check.md).

## Goal

No campaign goes out without an unsubscribe path. If the system must add one at send time, a human must **Approve** or **Decline** (with preview) before send continues.

## Logic (once per campaign send attempt)

1. Load the campaign’s linked email template HTML (not per recipient).
2. Run `ensureEmailTemplateUnsubscribe`.
3. **If already safe** (`{{unsubscribe}}` or an unsubscribe URL / system footer) → enqueue send as usual.
4. **If a footer would be appended** and this is an interactive send:
   - **Do not enqueue** and **do not persist** yet.
   - Return `needsUnsubscribeApproval: true` + `previewHtml`.
   - FE shows Approve / Decline / Preview.
5. **Approve** → `POST /api/v1/tenant/send-campaign/unsubscribe-approve` persists the footer (if still needed) and starts send with `awaitUnsubscribeApproval: false`.
6. **Decline** → send is cancelled; user can edit the template and try again.

Scheduled / worker starts use `awaitUnsubscribeApproval: false` so a missing link is auto-appended and the send continues (failsafe; templates should already be safe from the first check).

**Custom Marketing** uses `campaignStore.sendCampaign` after creating a draft campaign, so the same second check + approval host applies. The compose page stays put when approval is pending (does not navigate away mid-modal).

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/tenant/send-campaign/send` | May return `needsUnsubscribeApproval` instead of queueing |
| `POST` | `/api/v1/tenant/send-campaign/unsubscribe-approve` | Persist footer + begin send |

## Main code locations

| Area | Path |
| --- | --- |
| Gate in send | `server/services/send-campaign.service.ts` (`beginCampaignSend`) |
| Inspect / persist | `server/utils/emailTemplate/applyCampaignUnsubscribeSecondCheck.ts` |
| Approve API | `server/api/v1/tenant/send-campaign/unsubscribe-approve.post.ts` |
| Copy | `shared/campaignUnsubscribeSecondCheck.ts` |
| Store | `app/store/campaignStore.ts` |
| Modal + host | `app/components/tenant/CampaignUnsubscribeSecondCheckModal.vue`, `CampaignUnsubscribeSecondCheckHost.vue` |
| Composable | `app/composables/useCampaignUnsubscribeSecondCheckModal.ts` |

## Tests

| Test | Path |
| --- | --- |
| Second-check copy + ensure behavior | `server/utils/emailTemplate/__tests__/campaignUnsubscribeSecondCheck.test.ts` |

```bash
npm run test -- server/utils/emailTemplate/__tests__/campaignUnsubscribeSecondCheck.test.ts
```
