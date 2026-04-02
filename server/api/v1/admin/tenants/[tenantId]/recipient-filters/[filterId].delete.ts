import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { clearManualRecipientsForCampaignsReferencingLists } from '@server/utils/campaign/clearManualRecipientsForCampaignsReferencingLists'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const filterId = getRouterParam(event, 'filterId') ?? ''
  if (!tenantId || !filterId || !mongoose.Types.ObjectId.isValid(filterId)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const filterOid = new mongoose.Types.ObjectId(filterId)
  const filterIdStr = String(filterOid)
  const idVariants = [...new Set([filterIdStr, filterId.trim()])]

  const { RecipientFilter: FilterModel, RecipientList, Campaign } = getTenantClientModels(tenantConn)

  const filterDoc = await FilterModel.findById(filterOid).select('_id').lean()
  if (!filterDoc) {
    throw createError({ statusCode: 404, message: 'Filter not found' })
  }

  const listsWithFilter = await RecipientList.find({
    'filterRows.recipientFilterId': { $in: idVariants }
  })
    .select('_id')
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>()

  const affectedListIds = [...new Set(listsWithFilter.map((d) => String(d._id)))]

  let campaignsUpdated = 0
  let manualRecipientsRemoved = 0
  if (affectedListIds.length) {
    manualRecipientsRemoved = await clearManualRecipientsForCampaignsReferencingLists(
      tenantConn,
      affectedListIds
    )
    const campRes = await (Campaign as CampaignModel).updateMany(
      { recipientsListId: { $in: affectedListIds } },
      { $set: { recipientsListId: '', recipientsType: 'manual' } }
    )
    campaignsUpdated = campRes.modifiedCount ?? 0
  }

  await RecipientList.updateMany(
    { 'filterRows.recipientFilterId': { $in: idVariants } },
    { $pull: { filterRows: { recipientFilterId: { $in: idVariants } } } }
  )

  const res = await FilterModel.deleteOne({ _id: filterOid }).exec()

  if (res.deletedCount === 0) {
    throw createError({ statusCode: 404, message: 'Filter not found' })
  }

  return { ok: true, campaignsUpdated, manualRecipientsRemoved }
})
