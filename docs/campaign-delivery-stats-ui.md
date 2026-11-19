# Campaign delivery stats UI (Details)

## Problem

After Send (including **Custom Marketing**), Details could stay on:

- Status: `Sending`
- Banner: “Sending in progress — loading delivery stats…”
- Recipients summary: `Pending: 0, Sent: 0, Failed: 0` while row badges showed `sending`

Root causes:

1. Status poll / resume failed once and **stopped forever** (silent catch).
2. Recipient summary only counted `pending` / `sent` / `failed` — ignored in-flight `sending`.
3. No fallback progress from the detail ledger while the status API was empty.
4. Custom Marketing started a poll loop then navigated — Details could skip resume while `sendStatus` was null.
5. Stale worker claims without a provider message id could sit in `sending` until long stale timeouts.

### QA follow-up (status inconsistency)

Fast Custom Marketing sends could finish before Details resumed polling. Optimistic store progress stayed at `Sent 0 / Pending N` while:

- Campaign badge → `Sent`
- Recipient list / delivery report → `Sent`
- Banner / modal summary → still “Scheduled send in progress” / “Sending”

Cause: poll snapshot preferred over the recipient ledger, and `resumeSendStatusPolling` did not clear modal state when the first status fetch was already `done`.

## Fix

| Layer | Change |
| ----- | ------ |
| Shared | `shared/campaignRecipientDeliveryCounts.ts` — tallies + poll-shaped snapshot from recipients |
| Shared | `shared/reconcileCampaignSendProgress.ts` — prefer ledger/report when poll lags |
| FE poll | Retry status polls; surface `CAMPAIGN_SEND_POLL_ERROR_MESSAGE` after consecutive failures |
| FE store | Clear modal/`sendStatus` when resume finds `done`; `releaseSendUiIfCampaignComplete` on Sent/Failed |
| Details | Reconciled progress; Sending count; 5s refresh while Sending; release stale UI when terminal |
| Modal | Summary cards follow delivery-report counts when they are ahead of the poll |
| Custom Marketing | Navigate to Details; do not start a competing poll loop |
| BE reconcile | Stale `sending` without `brevoMessageId` → `pending`; with id → `sent` |

## Tests

```bash
npm run test -- shared/campaignRecipientDeliveryCounts.test.ts shared/reconcileCampaignSendProgress.test.ts shared/constants/__tests__/campaignTerminalStatus.test.ts server/services/__tests__/ackStaleInFlightSendingRecipients.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/campaignRecipientDeliveryCounts.test.ts` | Sending vs Pending tallies; poll-shaped snapshot / done flag |
| `shared/reconcileCampaignSendProgress.test.ts` | Optimistic Pending overridden by Sent ledger / report |
| `shared/constants/__tests__/campaignTerminalStatus.test.ts` | Terminal Sent/Failed constants |
| `server/services/__tests__/ackStaleInFlightSendingRecipients.test.ts` | Stale `sending` → `sent` (with message id) or `pending` (no id) |
