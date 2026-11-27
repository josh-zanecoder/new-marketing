import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getRegistryConnection } from '@server/lib/mongoose'
import { findRegistryTenantByDbName } from '@server/tenant/registry-auth'
import {
  onContactSubscribed,
  onContactUnsubscribed
} from '@server/utils/contact/contactSubscriptionEffects'
import { publishRatesheetUnsubscribedToKafka } from '@server/kafka/publishRatesheetUnsubscribed'
import { logger } from '@server/utils/logger'

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

    const contact = await Contact.findById(oid)
      .select('email')
      .lean<{ email?: string } | null>()
    const email = String(contact?.email || '')
      .trim()
      .toLowerCase()
    if (email.includes('@')) {
      let tenantId: string | undefined
      try {
        const registry = await getRegistryConnection()
        const row = await findRegistryTenantByDbName(registry, dbName)
        if (row?.tenantId) tenantId = row.tenantId
      } catch (err) {
        logger.warn('ratesheet.unsubscribed tenantId lookup failed', {
          dbName,
          err: err instanceof Error ? err.message : String(err)
        })
      }
      void publishRatesheetUnsubscribedToKafka({
        tenantDbName: dbName,
        tenantId,
        email,
        reason: 'marketing_unsubscribe',
        source: 'new-marketing-preference'
      }).catch((err) => {
        logger.warn('Failed to publish ratesheet.unsubscribed after marketing unsub', {
          dbName,
          email,
          err: err instanceof Error ? err.message : String(err)
        })
      })
    }
  }

  return { ok: true }
}
