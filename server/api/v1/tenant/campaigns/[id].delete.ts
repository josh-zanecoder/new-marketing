import type { Model, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { removeCampaignAudienceListIfUnused } from '@server/utils/campaign/removeCampaignAudienceListIfUnused'
import { isCampaignLiveListAudience } from '~~/shared/campaignAdvancedRecipientFilters'

interface CampaignDoc {
  _id: Types.ObjectId
  recipientsType?: string
  recipientsListId?: string
  liveListAudience?: boolean
}

interface RecipientDoc {
  campaign: Types.ObjectId
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, CampaignRecipient, ManualRecipient } = getTenantClientModels(conn)

  const campaign = await (Campaign as Model<CampaignDoc>).findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: id }, event.context.auth)
  )
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  await Promise.all([
    (CampaignRecipient as Model<RecipientDoc>).deleteMany({ campaign: id }),
    (ManualRecipient as Model<RecipientDoc>).deleteMany({ campaign: id })
  ])
  await (Campaign as Model<CampaignDoc>).findByIdAndDelete(id)

  // A filter-built campaign owns an auto-created list: remove it with the campaign unless another
  // campaign (e.g. a duplicate) still follows it.
  if (isCampaignLiveListAudience(campaign)) {
    await removeCampaignAudienceListIfUnused(conn, String(campaign.recipientsListId))
  }

  return { ok: true }
})
