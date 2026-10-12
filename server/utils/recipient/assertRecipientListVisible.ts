import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

/** Rejects campaign audiences built from recipient lists outside the session's owner scope. */
export async function assertRecipientListVisible(
  conn: Connection,
  listIdRaw: string,
  auth: unknown
): Promise<void> {
  const listId = listIdRaw.trim()
  if (!listId) return
  if (!mongoose.isValidObjectId(listId)) {
    throw createError({ statusCode: 400, message: 'Invalid recipient list id' })
  }
  const { RecipientList } = getTenantClientModels(conn)
  const visible = await RecipientList.findOne(mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth))
    .select('_id')
    .lean()
    .exec()
  if (!visible) {
    throw createError({ statusCode: 404, message: 'Recipient list not found' })
  }
}
