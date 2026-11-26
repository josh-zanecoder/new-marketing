import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { clearManualRecipientsForCampaignsReferencingLists } from '@server/utils/campaign/clearManualRecipientsForCampaignsReferencingLists'
import { LIVE_AUDIENCE_PROTECTED_STATUSES } from '~~/shared/campaignAdvancedRecipientFilters'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const listId = new mongoose.Types.ObjectId(rawId)
  const idStr = String(listId)

  const conn = await getTenantConnectionFromEvent(event)
  const { RecipientList, RecipientListMember, Campaign } = getTenantClientModels(conn)

  const existing = await RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth)
  )
    .select('_id')
    .lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }

  const listIdVariants = [...new Set([idStr, rawId.trim()].filter(Boolean))]

  /**
   * Filter-built campaigns (Advanced Recipient Filtering) have no recipient snapshot — their list
   * IS the audience. Deleting it would leave an unsent campaign with nobody to send to, so block it.
   */
  const unsentLiveCampaigns = await (Campaign as CampaignModel)
    .find({
      liveListAudience: true,
      recipientsListId: { $in: listIdVariants },
      status: { $in: [...LIVE_AUDIENCE_PROTECTED_STATUSES] }
    })
    .select('name')
    .limit(5)
    .lean<Array<{ name?: string }>>()
  if (unsentLiveCampaigns.length) {
    const names = unsentLiveCampaigns.map((c) => `"${c.name ?? 'Untitled'}"`).join(', ')
    throw createError({
      statusCode: 409,
      message: `This list is the audience of an unsent campaign (${names}). Delete or finish that campaign first.`
    })
  }

  const manualRecipientsRemoved = await clearManualRecipientsForCampaignsReferencingLists(
    conn,
    listIdVariants
  )

  const campaignRes = await (Campaign as CampaignModel).updateMany(
    {
      $or: [{ recipientsListId: idStr }, { recipientsListId: rawId.trim() }]
    },
    { $set: { recipientsListId: '', recipientsType: 'manual', liveListAudience: false } }
  )

  await RecipientListMember.deleteMany({ recipientListId: listId })
  await RecipientList.deleteOne({ _id: listId })

  return {
    ok: true,
    campaignsUpdated: campaignRes.modifiedCount ?? 0,
    manualRecipientsRemoved
  }
})
