/**
 * Dropdown values for recipient filters set to `valuesFromContacts`: the distinct values the
 * tenant's own contacts already hold for that property (e.g. every company on client contacts).
 */
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { recipientFilterContactFieldPath } from '~~/shared/utils/recipientFilterContactField'
import { canonicalRecipientFilterFieldsFromDoc } from './recipientFilterValidation'

const MAX_VALUE_OPTIONS = 500

type FilterDocForValues = {
  _id?: unknown
  contactType?: string
  property?: string
  propertyType?: string | null
  valuesFromContacts?: boolean
}

/** Options per filter id; filters without the option enabled are absent from the map. */
export async function recipientFilterContactValueOptions(params: {
  tenantConn: Connection
  contactFilter: Record<string, unknown>
  filterDocs: unknown[]
}): Promise<Map<string, string[]>> {
  const options = new Map<string, string[]>()

  /** Filters sharing a contact type and field only need one distinct query between them. */
  const groups = new Map<string, { contactType: string; fieldPath: string; filterIds: string[] }>()
  for (const raw of params.filterDocs) {
    const doc = (raw ?? {}) as FilterDocForValues
    if (doc.valuesFromContacts !== true) continue
    const filterId = doc._id != null ? String(doc._id) : ''
    if (!filterId) continue

    const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(doc)
    const fieldPath = recipientFilterContactFieldPath(property, propertyType)
    if (!fieldPath) continue

    const contactType = String(doc.contactType ?? '').trim().toLowerCase()
    const key = `${contactType}::${fieldPath}`
    const group = groups.get(key)
    if (group) {
      group.filterIds.push(filterId)
    } else {
      groups.set(key, { contactType, fieldPath, filterIds: [filterId] })
    }
  }

  if (groups.size === 0) return options

  const { Contact } = getTenantClientModels(params.tenantConn)
  await Promise.all(
    [...groups.values()].map(async (group) => {
      const query: Record<string, unknown> = { ...params.contactFilter }
      if (group.contactType) query.contactType = group.contactType

      const raw = await Contact.distinct(group.fieldPath, query)
      const values = [
        ...new Set(raw.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))
      ]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, MAX_VALUE_OPTIONS)

      for (const filterId of group.filterIds) options.set(filterId, values)
    })
  )

  return options
}
