import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { getRegistryConnection } from '@server/lib/mongoose'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'

const MAX_BULK_REMOVE = 200

/**
 * Soft-remove many contacts from a recipient list (LO recipient-list flag ON only).
 * Same semantics as single DELETE .../members/:contactId — excludedContactIds + member row delete.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantLoRecipientLists: 1 } }
  )
  if (!parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)) {
    throw createError({
      statusCode: 403,
      message: 'Bulk remove is only available when LO recipient lists are enabled'
    })
  }

  const rawListId = getRouterParam(event, 'id')
  if (!rawListId || !mongoose.isValidObjectId(rawListId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const body = (await readBody(event).catch(() => ({}))) as { contactIds?: unknown }
  const rawIds = Array.isArray(body?.contactIds) ? body.contactIds : []
  const contactIds = [
    ...new Set(
      rawIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ].slice(0, MAX_BULK_REMOVE)

  if (!contactIds.length) {
    throw createError({
      statusCode: 400,
      message: 'Select at least one recipient to remove'
    })
  }

  const listId = new mongoose.Types.ObjectId(rawListId)
  const objectIds = contactIds.map((id) => new mongoose.Types.ObjectId(id))

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

  const visibleContacts = await Contact.find(
    mergeTenantOwnerEmailScopeFilter(
      { _id: { $in: objectIds }, deletedAt: null },
      auth
    )
  )
    .select('_id')
    .lean()
  const allowedIds = visibleContacts.map((c) => c._id as mongoose.Types.ObjectId)
  if (!allowedIds.length) {
    throw createError({ statusCode: 404, message: 'No matching contacts to remove' })
  }

  const listType =
    (list as { listType?: string }).listType === 'static' ? 'static' : 'hybrid'

  await RecipientList.updateOne(
    { _id: listId },
    {
      $addToSet: { excludedContactIds: { $each: allowedIds } },
      $set: { listType }
    }
  )

  await RecipientListMember.deleteMany({
    recipientListId: listId,
    contactId: { $in: allowedIds }
  })

  return {
    ok: true,
    removedCount: allowedIds.length,
    contactIds: allowedIds.map((id) => String(id)),
    listId: String(listId)
  }
})
