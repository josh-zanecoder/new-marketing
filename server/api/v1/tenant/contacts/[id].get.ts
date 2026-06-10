import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactLean } from '@server/types/tenant/contact.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

type ContactTypeLean = {
  key?: string
  label?: string
  sortOrder?: number
}

function typeKeyDisplayLabel(keyRaw: string, labelByKey: Map<string, string>): string {
  const key = keyRaw.trim().toLowerCase()
  if (!key) return '—'
  return labelByKey.get(key) ?? keyRaw.trim()
}

function effectiveContactTypeKeys(doc: {
  contactType?: string[]
  contactKind?: string
}): string[] {
  const fromArr = Array.isArray(doc.contactType)
    ? doc.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : []
  if (fromArr.length) return [...new Set(fromArr)]
  const k = String(doc.contactKind ?? '').trim().toLowerCase()
  return k ? [k] : []
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact, ContactType } = getTenantClientModels(conn)
  const auth = event.context.auth as unknown
  const filter = mergeTenantOwnerEmailScopeFilter(
    { _id: new mongoose.Types.ObjectId(rawId), deletedAt: null },
    auth
  )

  const [doc, typeDocs] = await Promise.all([
    Contact.findOne(filter).lean<ContactLean | null>(),
    ContactType.find({ enabled: { $ne: false } })
      .sort({ sortOrder: 1, key: 1 })
      .lean<ContactTypeLean[]>()
  ])

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  const labelByKey = new Map<string, string>()
  for (const d of typeDocs) {
    const key = String(d.key ?? '').trim().toLowerCase()
    const label = String(d.label ?? '').trim() || key
    if (key) labelByKey.set(key, label)
  }

  const { firstName, lastName } = contactFirstLastFromDoc(doc)
  const typeKeys = effectiveContactTypeKeys(doc)
  const primaryKey = typeKeys[0] || ''
  const metadata =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : {}

  return {
    contact: {
      id: String(doc._id),
      externalId: doc.externalId ?? '',
      source: doc.source ?? '',
      contactType: typeKeys,
      contactTypeLabels: typeKeys.map((key) => typeKeyDisplayLabel(key, labelByKey)),
      primaryTypeLabel: typeKeyDisplayLabel(primaryKey, labelByKey),
      firstName,
      lastName,
      name: formatContactFullName(firstName, lastName),
      email: doc.email ?? '',
      phone: doc.phone ?? '',
      company: doc.company ?? '',
      channel: doc.channel ?? '',
      status: doc.status ?? '',
      stage: doc.stage ?? '',
      contactProfile: doc.contactProfile ?? null,
      address: {
        street: doc.address?.street ?? '',
        city: doc.address?.city ?? '',
        state: doc.address?.state ?? '',
        county: doc.address?.county ?? ''
      },
      metadata,
      is_unsubscribe: doc.isUnsubscribe === true,
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null,
      deletedAt: doc.deletedAt?.toISOString?.() ?? null
    }
  }
})
