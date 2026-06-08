import type { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

type ContactModel = ReturnType<typeof getTenantClientModels>['Contact']

/** One aggregation instead of per-key `countDocuments` for audience picker labels. */
export async function countMarketableContactsByTypeKey(params: {
  Contact: ContactModel
  contactFilter: Record<string, unknown>
  countKeys: string[]
}): Promise<Record<string, number>> {
  const contactCounts: Record<string, number> = {}
  for (const key of params.countKeys) {
    contactCounts[key] = 0
  }
  if (!params.countKeys.length) return contactCounts

  const normalizedKeys = params.countKeys.map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (!normalizedKeys.length) return contactCounts

  const rows = await params.Contact.aggregate<{ _id: string; count: number }>([
    { $match: params.contactFilter },
    { $unwind: '$contactType' },
    { $match: { contactType: { $in: normalizedKeys } } },
    { $group: { _id: '$contactType', count: { $sum: 1 } } }
  ]).exec()

  for (const row of rows) {
    const key = String(row._id ?? '')
      .trim()
      .toLowerCase()
    if (key && key in contactCounts) {
      contactCounts[key] = row.count
    }
  }

  return contactCounts
}

/** All contact-type keys present on marketable contacts (campaign contact picker). */
export async function countAllMarketableContactsByType(params: {
  Contact: ContactModel
  contactFilter: Record<string, unknown>
}): Promise<Record<string, number>> {
  const rows = await params.Contact.aggregate<{ _id: string; count: number }>([
    { $match: params.contactFilter },
    { $unwind: '$contactType' },
    { $group: { _id: '$contactType', count: { $sum: 1 } } }
  ]).exec()

  const contactCounts: Record<string, number> = {}
  for (const row of rows) {
    const key = String(row._id ?? '')
      .trim()
      .toLowerCase()
    if (key) contactCounts[key] = row.count
  }
  return contactCounts
}
