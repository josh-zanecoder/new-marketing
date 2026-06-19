import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import { resolveBrevoEventReportRequest } from './brevoEventReportQuery'
import {
  extractBrevoEventsFromReport,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'

const BREVO_EVENTS_PAGE_LIMIT = 2500
const BREVO_MAX_PAGINATION_OFFSET = 20_000

export { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

export async function fetchTenantBrevoEmailEvents(params: {
  fromYmd?: string | null
  toYmd?: string | null
}): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const dateQuery = resolveBrevoEventReportRequest(params.fromYmd ?? null, params.toYmd ?? null)

  const merged: BrevoTrackingEmailEvent[] = []
  let offset = 0

  while (offset <= BREVO_MAX_PAGINATION_OFFSET) {
    const request: GetEmailEventReportRequest = {
      ...dateQuery,
      limit: BREVO_EVENTS_PAGE_LIMIT,
      offset,
      sort: 'desc'
    }
    const { report, error } = await getTransactionalEmailEventReport(request)
    if (error) {
      return { events: merged, error }
    }

    const batch = extractBrevoEventsFromReport(report)
    if (batch.length === 0) break
    merged.push(...batch)
    if (batch.length < BREVO_EVENTS_PAGE_LIMIT) break
    offset += BREVO_EVENTS_PAGE_LIMIT
  }

  return { events: merged }
}
