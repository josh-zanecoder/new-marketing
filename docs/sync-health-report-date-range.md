# Sync Health Generate Report — date range

## Problem

Tenant Sync Health CSV/PDF exports used the **event history** date filter. There was no report-only period (including an explicit **All time** default independent of the board).

## Fix

| Layer | Change |
| ----- | ------ |
| Shared | `shared/utils/syncHealthReportDateRange.ts` — custom range validation (`from <= to`), report date label, tenant + range filters for events/DLQ |
| FE | Second `useBrevoTrackingDateRange()` on `app/pages/admin/sync-health/[dbName].vue` (defaults to **All time**), picker next to CSV/PDF, independent of the event-history picker |
| Export | `buildReportPayload()` uses the **report** date range; Event / Level / Search still follow the page filters; CSV and PDF both use `reportDateLabel` |

Invalid custom ranges (start after end, or only one bound set) disable CSV / PDF and show an inline error.

## How to verify

1. Log in as Marketing admin → **Sync Health** → open a tenant.
2. Optionally set the event-history date filter to something other than All time.
3. Set **Report date range** (presets include All time + Custom).
4. Try start > end — CSV/PDF stay disabled.
5. Download CSV and PDF — header **Date range** matches the report picker; Events/DLQ rows fall inside that window, not the history board filter.

## Tests

```bash
npm run test -- shared/utils/__tests__/syncHealthReportDateRange.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/utils/__tests__/syncHealthReportDateRange.test.ts` | Validation, label, tenant + date filtering, All time unbounded |
