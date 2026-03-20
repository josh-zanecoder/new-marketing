import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { CampaignRecipient } from '../../../models/CampaignRecipient'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  await getRegistryConnection()

  const campaign = await (Campaign as Model<any>).findById(id)
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  await Promise.all([
    (CampaignRecipient as Model<any>).deleteMany({ campaign: id }),
    (ManualRecipient as Model<any>).deleteMany({ campaign: id })
  ])
  await (Campaign as Model<any>).findByIdAndDelete(id)

  return { ok: true }
})
