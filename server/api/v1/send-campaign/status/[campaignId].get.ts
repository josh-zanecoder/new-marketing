import { getRegistryConnection } from '../../../../utils/db'
import { processBatch } from '../../../../services/send-campaign.service'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId')
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  return processBatch(campaignId)
})
