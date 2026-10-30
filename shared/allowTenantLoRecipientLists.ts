/**
 * Registry `clients.allowTenantLoRecipientLists`.
 * When true, tenant marketing may create/manage LO-scoped recipient lists
 * and upload hosted images into email templates.
 * Missing/unknown → false (existing recipient-list / template behavior only).
 */
export function parseAllowTenantLoRecipientLists(raw: unknown): boolean {
  return raw === true
}
