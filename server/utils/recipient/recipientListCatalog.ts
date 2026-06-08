import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'

/** Max contacts returned for campaign picker / legacy full catalog. */
export const RECIPIENT_LIST_CATALOG_LIMIT = 3000

export const CATALOG_CONTACT_SELECT = {
  firstName: 1,
  lastName: 1,
  name: 1,
  email: 1,
  contactType: 1,
  company: 1,
  channel: 1,
  source: 1,
  address: 1
} as const

export type CatalogContactRow = {
  _id: unknown
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  contactType?: string[]
  company?: string | null
  channel?: string | null
  source?: string | null
  address?: Record<string, unknown> | null
}

export type ContactTypeOption = {
  key: string
  label: string
  sortOrder: number
}

export function mapContactTypeDocs(docs: unknown[]): ContactTypeOption[] {
  return (docs as Array<{ key?: string; label?: string; sortOrder?: number }>).map((d) => {
    const key = String(d.key ?? '').trim().toLowerCase()
    const label = String(d.label ?? '').trim() || key
    return {
      key,
      label,
      sortOrder: Number(d.sortOrder ?? 0)
    }
  })
}

export function serializeCatalogContacts(contacts: CatalogContactRow[]) {
  return contacts.map((c) => {
    const { firstName, lastName } = contactFirstLastFromDoc(c)
    const contactType =
      Array.isArray(c.contactType) && c.contactType.length
        ? [...new Set(c.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean))]
        : []
    return {
      id: String(c._id),
      firstName,
      lastName,
      name: formatContactFullName(firstName, lastName),
      email: c.email ?? '',
      contactType,
      company: c.company ?? '',
      channel: c.channel ?? '',
      source: c.source ?? '',
      address: c.address ?? {}
    }
  })
}
