import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { requireTenantAdvancedRecipientFiltering } from '@server/utils/requireTenantAdvancedRecipientFiltering'
import { previewRecipientListAudience } from '@server/utils/recipient/previewRecipientListAudience'

/**
 * Advanced Recipient Filtering: count + sample contacts for a filter body
 * without creating a recipient list. Gated by the tenant permission.
 */
export default defineEventHandler(async (event) => {
  await requireTenantAdvancedRecipientFiltering(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const sampleLimit =
    typeof body.sampleLimit === 'number'
      ? body.sampleLimit
      : typeof body.limit === 'number'
        ? body.limit
        : undefined
  const page = typeof body.page === 'number' ? body.page : undefined
  const tenantConn = await getTenantConnectionFromEvent(event)
  return previewRecipientListAudience({
    tenantConn,
    auth: event.context.auth as unknown,
    body,
    sampleLimit,
    page,
    search: typeof body.search === 'string' ? body.search : undefined
  })
})
