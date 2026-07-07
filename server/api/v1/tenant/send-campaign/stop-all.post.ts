import { haltAllActiveCampaignSends } from '@server/services/campaign-send-control.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  console.log('[SendCampaignAPI] stopAll', { dbName: conn.db?.databaseName })

  return haltAllActiveCampaignSends(conn, { mode: 'stop', auth: event.context.auth })
})
