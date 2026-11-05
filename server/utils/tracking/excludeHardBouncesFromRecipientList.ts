import type { Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { mongoEventValuesForFilter } from '@server/utils/tracking/mongoEventValuesForFilter'

/**
 * Soft-remove contacts who hard-bounced on a campaign from that campaign's
 * recipient list (`excludedContactIds` + delete membership rows).
 */
export async function excludeHardBouncesFromRecipientList(params: {
  dbName: string
  auth: unknown
  campaignId: string
}): Promise<{
  listId: string
  listName: string
  bounceEmails: number
  matchedContacts: number
  removedMembers: number
}> {
  if (!isRegisteredTenantAuthContext(params.auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }
  const auth = params.auth as RegisteredTenantAuthContext
  const campaignId = params.campaignId.trim()
  if (!/^[a-f\d]{24}$/i.test(campaignId)) {
    throw createError({ statusCode: 400, message: 'Invalid campaign id' })
  }

  const conn = await getTenantConnectionByDbName(params.dbName)
  const { Campaign, Contact, RecipientList, RecipientListMember } = getTenantClientModels(conn)

  const campaign = (await Campaign.findById(campaignId)
    .select({ recipientsListId: 1, name: 1 })
    .lean()
    .exec()) as { recipientsListId?: string; name?: string } | null
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }

  const listIdRaw = String(campaign.recipientsListId || '').trim()
  if (!listIdRaw || !/^[a-f\d]{24}$/i.test(listIdRaw)) {
    throw createError({
      statusCode: 400,
      message: 'This campaign has no recipient list to clean'
    })
  }

  const list = await RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listIdRaw }, auth)
  )
    .select('_id name listType')
    .lean()
  if (!list) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }

  const hardBounceEvents = mongoEventValuesForFilter('hardBounces') || ['hardBounces']
  const { BrevoTrackingEvent } = getTenantClientModels(conn)
  const bounceDocs = (await BrevoTrackingEvent.find({
    campaignId,
    event: { $in: hardBounceEvents },
    email: { $regex: /@/ }
  })
    .select({ email: 1 })
    .lean()
    .exec()) as Array<{ email?: string }>

  const emailSet = new Set<string>()
  for (const doc of bounceDocs) {
    const n = String(doc.email || '')
      .trim()
      .toLowerCase()
    if (n.includes('@')) emailSet.add(n)
  }

  if (!emailSet.size) {
    return {
      listId: String((list as { _id: Types.ObjectId })._id),
      listName: String((list as { name?: string }).name || ''),
      bounceEmails: 0,
      matchedContacts: 0,
      removedMembers: 0
    }
  }

  const contacts = await Contact.find(
    mergeTenantOwnerEmailScopeFilter(
      { email: { $in: [...emailSet] }, deletedAt: null },
      auth
    )
  )
    .select('_id')
    .lean<{ _id: Types.ObjectId }[]>()
    .exec()

  const contactIds = contacts.map((c) => c._id).filter(Boolean)
  if (!contactIds.length) {
    return {
      listId: String((list as { _id: Types.ObjectId })._id),
      listName: String((list as { name?: string }).name || ''),
      bounceEmails: emailSet.size,
      matchedContacts: 0,
      removedMembers: 0
    }
  }

  const listType =
    (list as { listType?: string }).listType === 'static' ? 'static' : 'hybrid'

  await RecipientList.updateOne(
    { _id: (list as { _id: Types.ObjectId })._id },
    {
      $addToSet: { excludedContactIds: { $each: contactIds } },
      $set: { listType }
    }
  )

  const memberRes = await RecipientListMember.deleteMany({
    recipientListId: (list as { _id: Types.ObjectId })._id,
    contactId: { $in: contactIds }
  })

  return {
    listId: String((list as { _id: Types.ObjectId })._id),
    listName: String((list as { name?: string }).name || ''),
    bounceEmails: emailSet.size,
    matchedContacts: contactIds.length,
    removedMembers: memberRes.deletedCount ?? 0
  }
}
