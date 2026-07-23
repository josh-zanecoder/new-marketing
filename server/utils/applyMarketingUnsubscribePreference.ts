import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { syncRecipientListsForContactSubscription } from '@server/utils/recipient/syncContactRecipientListMembership'

export async function applyMarketingUnsubscribePreference(params: {
  dbName: string
  contactId: string
  marketing: boolean
}): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  const tenantConn = await getTenantConnectionByDbName(params.dbName)
  const { Contact } = getTenantClientModels(tenantConn)
  const oid = new mongoose.Types.ObjectId(params.contactId)

  const updated = await Contact.updateOne(
    { _id: oid, deletedAt: null },
    { $set: { isUnsubscribe: !params.marketing } }
  )

  if (updated.matchedCount === 0) {
    return { ok: false, reason: 'not_found' }
  }

  await syncRecipientListsForContactSubscription(tenantConn, oid, params.marketing)

  return { ok: true }
}
