import mongoose from 'mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

export async function applyMarketingUnsubscribePreference(params: {
  dbName: string
  contactId: string
  marketing: boolean
}): Promise<{ ok: boolean }> {
  const dbName = params.dbName.trim()
  const contactId = params.contactId.trim()
  if (!dbName || !mongoose.isValidObjectId(contactId)) return { ok: false }

  const tenantConn = await getTenantConnectionByDbName(dbName)
  const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)
  const oid = new mongoose.Types.ObjectId(contactId)

  const updated = await Contact.updateOne(
    {
      _id: oid,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    },
    { $set: { isUnsubscribe: !params.marketing } }
  )

  if (updated.matchedCount === 0) return { ok: false }

  if (!params.marketing) {
    await RecipientListMember.deleteMany({ contactId: oid })
  }

  return { ok: true }
}
