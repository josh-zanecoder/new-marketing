import type { Ref } from 'vue'
import type {
  BrevoSmtpPerformanceRow,
  BrevoTransactionalStats
} from '~/types/brevoSmtpStats'

function pctOf(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

function parseYmd(ymd: string): Date {
  const p = ymd.trim().split('-')
  if (p.length !== 3) return new Date(NaN)
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}

/** Ratesheet-style derived metrics from Brevo aggregated SMTP stats. */
export function useBrevoSmtpStatsDashboard(stats: Ref<BrevoTransactionalStats | null>) {
  const statsRangeTitleLong = computed(() => {
    const s = stats.value
    if (!s) return ''
    const a = parseYmd(s.range.startDate)
    const b = parseYmd(s.range.endDate)
    const o: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
    return `Messages from ${a.toLocaleDateString('en-US', o)} to ${b.toLocaleDateString('en-US', o)}`
  })

  const totalEmailsSent = computed(() => stats.value?.aggregated.requests ?? 0)

  const performanceRows = computed((): BrevoSmtpPerformanceRow[] => {
    const g = stats.value?.aggregated
    if (!g) return []
    const req = g.requests
    const r = g.rates
    const bouncedCnt = (g.hardBounces ?? 0) + (g.softBounces ?? 0)
    const bouncedPct = pctOf(bouncedCnt, req)
    return [
      {
        label: 'Delivered',
        pct: r.deliveredPct,
        variant: 'blue',
        valueDisplay: 'percent',
        eventFilter: 'delivered'
      },
      {
        label: 'Estimated openers',
        pct: r.opensPct,
        variant: 'teal',
        valueDisplay: 'percent',
        eventFilter: 'opened'
      },
      {
        label: 'Trackable openers',
        pct: r.uniqueOpensPct,
        variant: 'green',
        valueDisplay: 'count',
        countValue: g.uniqueOpens,
        eventFilter: 'unique_opened'
      },
      {
        label: 'Unique clickers',
        pct: r.uniqueClicksPct,
        variant: 'amber',
        valueDisplay: 'percent',
        eventFilter: 'clicks'
      },
      {
        label: 'Bounced',
        pct: bouncedPct,
        variant: 'red',
        valueDisplay: 'percent',
        eventFilter: 'bounces'
      },
      {
        label: 'Hard bounce',
        pct: r.hardBouncesPct,
        variant: 'red',
        valueDisplay: 'percent',
        eventFilter: 'hardBounces'
      },
      {
        label: 'Soft bounce',
        pct: r.softBouncesPct,
        variant: 'slate',
        valueDisplay: 'percent',
        eventFilter: 'softBounces'
      },
      {
        label: 'Complaint',
        pct: r.spamReportsPct,
        variant: 'orange',
        valueDisplay: 'percent',
        eventFilter: 'spam'
      },
      {
        label: 'Blocked',
        pct: r.blockedPct,
        variant: 'brown',
        valueDisplay: 'percent',
        eventFilter: 'blocked'
      }
    ]
  })

  const metricsGridRows = computed((): (BrevoSmtpPerformanceRow | null)[][] => {
    const list = performanceRows.value
    const map = new Map(list.map((x) => [x.label, x] as const))
    const g = (k: string): BrevoSmtpPerformanceRow | null => map.get(k) ?? null
    return [
      [g('Delivered'), g('Estimated openers'), g('Unique clickers'), g('Bounced')],
      [g('Complaint'), g('Trackable openers'), g('Hard bounce'), g('Soft bounce')],
      [null, null, null, g('Blocked')]
    ]
  })

  const metricsGridCells = computed(() => metricsGridRows.value.flat())

  return {
    statsRangeTitleLong,
    totalEmailsSent,
    performanceRows,
    metricsGridRows,
    metricsGridCells
  }
}
