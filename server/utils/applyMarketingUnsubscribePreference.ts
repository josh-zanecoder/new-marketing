import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'

export async function applyMarketingUnsubscribePreference(params: {
  dbName: string
  contactId: string
  marketing: boolean
}): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  const tenantConn = await getTenantConnectionByDbName(params.dbName)
  const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)
  const oid = new mongoose.Types.ObjectId(params.contactId)

  const updated = await Contact.updateOne(
    { _id: oid, deletedAt: null },
    { $set: { isUnsubscribe: !params.marketing } }
  )

  if (updated.matchedCount === 0) {
    return { ok: false, reason: 'not_found' }
  }

  if (!params.marketing) {
    await RecipientListMember.deleteMany({ contactId: oid })
  }

  return { ok: true }
}
