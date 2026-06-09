export const MIN_CONTACT_SEARCH_LENGTH = 2

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Sanitize user input for MongoDB `$text` (drop quotes). */
export function sanitizeTextSearchQuery(search: string): string {
  return search.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** True when the query is likely an email or email-prefix lookup. */
export function looksLikeEmailQuery(search: string): boolean {
  const q = search.trim()
  if (q.includes('@')) return true
  return /^[a-z0-9._+-]+$/i.test(q) && q.length >= 3
}

export function buildContactSearchText(doc: {
  firstName?: unknown
  lastName?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  company?: unknown
  contactType?: unknown
  address?: { street?: unknown; city?: unknown; state?: unknown; county?: unknown } | unknown
}): string {
  const addr =
    doc.address && typeof doc.address === 'object'
      ? (doc.address as Record<string, unknown>)
      : {}
  const typeArr = Array.isArray(doc.contactType) ? doc.contactType : []
  const parts = [
    doc.firstName,
    doc.lastName,
    doc.name,
    doc.email,
    doc.phone,
    doc.company,
    addr.street,
    addr.city,
    addr.state,
    addr.county,
    ...typeArr
  ]
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildLegacySearchRegexFilter(re: RegExp): Record<string, unknown> {
  return {
    $or: [
      { firstName: re },
      { lastName: re },
      { email: re },
      { phone: re },
      { company: re },
      { 'address.street': re },
      { 'address.city': re },
      { 'address.state': re },
      { 'address.county': re },
      { contactType: re }
    ]
  }
}

/** List/search API filter without `$text` (no text index required). */
export function buildContactListSearchFilter(search: string): Record<string, unknown> | null {
  const q = search.trim()
  if (q.length < MIN_CONTACT_SEARCH_LENGTH) return null

  if (looksLikeEmailQuery(q)) {
    return { email: new RegExp(`^${escapeRegex(q)}`, 'i') }
  }

  return buildLegacySearchRegexFilter(new RegExp(escapeRegex(q), 'i'))
}

/** Server-side contact search clause, or `null` when search is too short. */
export function buildContactSearchFilter(search: string): Record<string, unknown> | null {
  const q = search.trim()
  if (q.length < MIN_CONTACT_SEARCH_LENGTH) return null

  if (looksLikeEmailQuery(q)) {
    return { email: new RegExp(`^${escapeRegex(q)}`, 'i') }
  }

  const textQ = sanitizeTextSearchQuery(q)
  if (textQ.length < MIN_CONTACT_SEARCH_LENGTH) return null

  const re = new RegExp(escapeRegex(q), 'i')
  return {
    $or: [
      { $text: { $search: textQ } },
      {
        $and: [
          {
            $or: [{ searchText: { $exists: false } }, { searchText: null }, { searchText: '' }]
          },
          buildLegacySearchRegexFilter(re)
        ]
      }
    ]
  }
}

export function encodeContactListCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

export function decodeContactListCursor(
  raw: string
): { updatedAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const pipe = decoded.lastIndexOf('|')
    if (pipe <= 0) return null
    const updatedAt = new Date(decoded.slice(0, pipe))
    const id = decoded.slice(pipe + 1)
    if (Number.isNaN(updatedAt.getTime()) || !id) return null
    return { updatedAt, id }
  } catch {
    return null
  }
}

export function appendKeysetAfterFilter(
  filter: Record<string, unknown>,
  after: { updatedAt: Date; id: string }
): Record<string, unknown> {
  const keyset = {
    $or: [{ updatedAt: { $lt: after.updatedAt } }, { updatedAt: after.updatedAt, _id: { $lt: after.id } }]
  }
  if (filter.$and && Array.isArray(filter.$and)) {
    return { $and: [...filter.$and, keyset] }
  }
  return { $and: [filter, keyset] }
}
