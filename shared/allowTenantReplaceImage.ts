/**
 * Registry `clients.allowTenantReplaceImage`.
 * When true, the tenant can replace images already in email templates.
 * Missing → the tenant keeps the access it had before Replace had its own switch:
 * on when Insert image or the template builder is on.
 */
export function parseAllowTenantReplaceImage(doc: {
  allowTenantReplaceImage?: unknown
  allowTenantInsertImage?: unknown
  allowTenantTemplateBuilder?: unknown
} | null | undefined): boolean {
  const raw = doc?.allowTenantReplaceImage
  if (typeof raw === 'boolean') return raw
  return doc?.allowTenantInsertImage === true || doc?.allowTenantTemplateBuilder === true
}

/** True once Replace has its own stored value, so other switches no longer change it. */
export function hasStoredAllowTenantReplaceImage(doc: { allowTenantReplaceImage?: unknown } | null | undefined): boolean {
  return typeof doc?.allowTenantReplaceImage === 'boolean'
}

/**
 * Extra `$set` fields for a PATCH that changes Insert image or the template builder:
 * stores the current Replace value first so flipping those switches cannot change it.
 */
export function pinAllowTenantReplaceImage(doc: Parameters<typeof parseAllowTenantReplaceImage>[0]): {
  allowTenantReplaceImage?: boolean
} {
  if (hasStoredAllowTenantReplaceImage(doc)) return {}
  return { allowTenantReplaceImage: parseAllowTenantReplaceImage(doc) }
}
