import type { CampaignTrackingTimeseriesPoint } from './types'

/** Pad a sparse timeseries with zero-value days so charts always show the full window. */
export function fillTimeseriesDays(
  points: CampaignTrackingTimeseriesPoint[],
  days: number
): CampaignTrackingTimeseriesPoint[] {
  const safeDays = Math.max(1, Math.min(days, 90))
  const byDate = new Map(points.map((p) => [p.date, p]))
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - safeDays + 1)

  const result: CampaignTrackingTimeseriesPoint[] = []
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10)
    result.push(
      byDate.get(date) ?? {
        date,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        other: 0
      }
    )
  }
  return result
}
