import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { recipientListExcludedContactIds } from '@server/utils/recipient/recipientListMutation'

/**
 * Restore a soft-removed recipient to the active list.
 * Clears `excludedContactIds` for this contact and upserts the member row.
 * Does not change the Contact or campaign history.
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
    .select('_id excludedContactIds')
    .lean()
  if (!list) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }

  const excluded = recipientListExcludedContactIds(
    list as { excludedContactIds?: unknown }
  )
  const wasExcluded = excluded.some((id) => String(id) === String(contactId))
  if (!wasExcluded) {
    throw createError({
      statusCode: 404,
      message: 'Contact is not in the removed recipients for this list'
    })
  }

  const contact = await Contact.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: contactId, deletedAt: null }, auth)
  )
    .select('_id')
    .lean()
  if (!contact) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  await RecipientList.updateOne(
    { _id: listId },
    { $pull: { excludedContactIds: contactId } }
  )

  await RecipientListMember.updateOne(
    { recipientListId: listId, contactId },
    { $setOnInsert: { recipientListId: listId, contactId } },
    { upsert: true }
  )

  return {
    ok: true,
    restored: true,
    contactId: String(contactId),
    listId: String(listId)
  }
})
