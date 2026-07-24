import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import {
  onContactSubscribed,
  onContactUnsubscribed
} from '@server/utils/contact/contactSubscriptionEffects'

export async function applyMarketingUnsubscribePreference(params: {
  dbName: string
  contactId: string
  marketing: boolean
}): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  const dbName = params.dbName.trim()
  const contactId = params.contactId.trim()
  if (!dbName || !mongoose.isValidObjectId(contactId)) {
    return { ok: false, reason: 'not_found' }
  }

  const tenantConn = await getTenantConnectionByDbName(dbName)
  const { Contact } = getTenantClientModels(tenantConn)
  const oid = new mongoose.Types.ObjectId(contactId)

  const updated = await Contact.updateOne(
    {
      _id: oid,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    },
    { $set: { isUnsubscribe: !params.marketing } }
  )

  if (updated.matchedCount === 0) {
    return { ok: false, reason: 'not_found' }
  }

  if (params.marketing) {
    await onContactSubscribed(tenantConn, oid)
  } else {
    await onContactUnsubscribed(tenantConn, oid)
  }

  return { ok: true }
}
