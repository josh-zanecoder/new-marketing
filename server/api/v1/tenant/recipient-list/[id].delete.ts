import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { clearManualRecipientsForCampaignsReferencingLists } from '@server/utils/campaign/clearManualRecipientsForCampaignsReferencingLists'

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

  const existing = await RecipientList.findById(listId).select('_id').lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }

  const listIdVariants = [...new Set([idStr, rawId.trim()].filter(Boolean))]
  const manualRecipientsRemoved = await clearManualRecipientsForCampaignsReferencingLists(
    conn,
    listIdVariants
  )

  const campaignRes = await (Campaign as CampaignModel).updateMany(
    {
      $or: [{ recipientsListId: idStr }, { recipientsListId: rawId.trim() }]
    },
    { $set: { recipientsListId: '', recipientsType: 'manual' } }
  )

  await RecipientListMember.deleteMany({ recipientListId: listId })
  await RecipientList.deleteOne({ _id: listId })

  return {
    ok: true,
    campaignsUpdated: campaignRes.modifiedCount ?? 0,
    manualRecipientsRemoved
  }
})
