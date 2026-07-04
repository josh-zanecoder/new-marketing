import type { BrevoTrackingDateRange } from '~/composables/useBrevoTrackingDateRange'

interface BrevoTrackingReportResponse {
  report: unknown
}

function readCachedPayload(key: string, nuxtApp: ReturnType<typeof useNuxtApp>) {
  return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
}

function buildTrackingQuery(
  campaignId: string | undefined,
  dateRange: BrevoTrackingDateRange | undefined
): Record<string, string> {
  const query: Record<string, string> = {}
  const campaign = campaignId?.trim()
  if (campaign) query.campaignId = campaign

  const from = dateRange?.from?.trim()
  const to = dateRange?.to?.trim()
  if (from) query.from = from
  if (to) query.to = to

  return query
}

export function useBrevoTrackingReport(options?: {
  campaignId?: MaybeRefOrGetter<string | undefined>
  dateRange?: MaybeRefOrGetter<BrevoTrackingDateRange | undefined>
}) {
  const query = computed(() =>
    buildTrackingQuery(toValue(options?.campaignId), toValue(options?.dateRange))
  )

  const fetchKey = computed(() => `tenant-tracking-brevo-${JSON.stringify(query.value)}`)

  return useFetch<BrevoTrackingReportResponse>('/api/v1/tracking', {
    query,
    key: fetchKey,
    getCachedData: (key, nuxtApp) => readCachedPayload(key, nuxtApp)
  })
}
