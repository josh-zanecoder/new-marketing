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

## Fix

| Layer | Change |
| ----- | ------ |
| Shared | `shared/campaignRecipientDeliveryCounts.ts` — tallies + poll-shaped snapshot from recipients |
| FE poll | Retry status polls; surface `CAMPAIGN_SEND_POLL_ERROR_MESSAGE` after consecutive failures |
| Details | Fallback progress from recipients; Sending count; 5s refresh while Sending; resume when poll not live |
| Custom Marketing | Navigate to Details; do not start a competing poll loop |
| BE reconcile | Stale `sending` without `brevoMessageId` → `pending`; with id → `sent` |

## Tests

```bash
npm run test -- shared/campaignRecipientDeliveryCounts.test.ts server/services/__tests__/ackStaleInFlightSendingRecipients.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/campaignRecipientDeliveryCounts.test.ts` | Sending vs Pending tallies; poll-shaped snapshot / done flag |
| `server/services/__tests__/ackStaleInFlightSendingRecipients.test.ts` | Stale `sending` → `sent` (with message id) or `pending` (no id) |
