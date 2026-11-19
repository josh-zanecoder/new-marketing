# Sync Health Generate Report — date range

## Problem

The Sync Health **Generate report** dialog let admins pick tenants, but Events and DLQ always followed the **board** date filter (often **All time**). There was no way to set a report-only period for CSV/PDF.

## Fix

| Layer | Change |
| ----- | ------ |
| Shared | `shared/utils/syncHealthReportDateRange.ts` — custom range validation (`from <= to`), report date label, tenant + range filters for events/DLQ |
| FE dialog | Second `useBrevoTrackingDateRange()` instance (defaults to **All time**), `TenantBrevoTrackingDateRangePicker` in the modal, independent of the board picker |
| Export | `buildReportPayload()` filters by selected tenants + **report** date range, then still applies board Event / Level / History search; CSV and PDF both use `reportDateLabel` + those filter metadata lines |

Opening the modal resets the report range to **All time**. Invalid custom ranges (start after end, or only one bound set) disable Download CSV / Download PDF and show an inline error.

## How to verify

1. Log in as Marketing admin → **Sync Health**.
2. Optionally set the board date filter to something other than All time.
3. Click **Generate report**.
4. Confirm the dialog has a **Date range** control (presets include All time + Custom).
5. Pick a custom start/end (and try start > end — export buttons stay disabled).
6. Download CSV and PDF — header **Date range** matches the dialog; Events/DLQ rows fall inside that window, not the board filter.

## Tests

```bash
npm run test -- shared/utils/__tests__/syncHealthReportDateRange.test.ts
```

| File | Covers |
| ---- | ------ |
| `shared/utils/__tests__/syncHealthReportDateRange.test.ts` | Validation, label, tenant + date filtering, All time unbounded |
