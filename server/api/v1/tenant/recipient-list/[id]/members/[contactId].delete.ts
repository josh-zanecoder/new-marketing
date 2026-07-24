import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

/**
 * Soft-remove a contact from a recipient list.
 * Adds them to `excludedContactIds` so rebuild/sync will not put them back,
 * and deletes the `RecipientListMember` row. Does not delete the Contact or
 * campaign history — use POST .../members/:contactId/restore to put them back.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const rawListId = getRouterParam(event, 'id')
  const rawContactId = getRouterParam(event, 'contactId')
  if (!rawListId || !mongoose.isValidObjectId(rawListId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }
  if (!rawContactId || !mongoose.isValidObjectId(rawContactId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const listId = new mongoose.Types.ObjectId(rawListId)
  const contactId = new mongoose.Types.ObjectId(rawContactId)

  const conn = await getTenantConnectionFromEvent(event)
  const { RecipientList, RecipientListMember, Contact } = getTenantClientModels(conn)

  const list = await RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth)
  )
    .select('_id listType')
    .lean()
  if (!list) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }

  const contact = await Contact.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: contactId, deletedAt: null }, auth)
  )
    .select('_id')
    .lean()
  if (!contact) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  const listType =
    (list as { listType?: string }).listType === 'static'
      ? 'static'
      : 'hybrid'

  await RecipientList.updateOne(
    { _id: listId },
    {
      $addToSet: { excludedContactIds: contactId },
      $set: { listType }
    }
  )

  const memberRes = await RecipientListMember.deleteOne({
    recipientListId: listId,
    contactId
  })

  return {
    ok: true,
    removed: (memberRes.deletedCount ?? 0) > 0,
    contactId: String(contactId),
    listId: String(listId)
  }
})
