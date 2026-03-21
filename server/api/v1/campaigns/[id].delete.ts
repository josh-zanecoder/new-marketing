import type { Model, Types } from 'mongoose'
import { getTenantClientModels } from '../../../models/clients/tenantClientModels'
import { getTenantConnectionFromEvent } from '../../../utils/tenantDb'

interface CampaignDoc {
  _id: Types.ObjectId
}

interface RecipientDoc {
  campaign: Types.ObjectId
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, CampaignRecipient, ManualRecipient } = getTenantClientModels(conn)

  const campaign = await (Campaign as Model<CampaignDoc>).findById(id)
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  await Promise.all([
    (CampaignRecipient as Model<RecipientDoc>).deleteMany({ campaign: id }),
    (ManualRecipient as Model<RecipientDoc>).deleteMany({ campaign: id })
  ])
  await (Campaign as Model<CampaignDoc>).findByIdAndDelete(id)

  return { ok: true }
})
