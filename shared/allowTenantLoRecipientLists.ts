/**
 * Registry `clients.allowTenantLoRecipientLists`.
 * When true, tenant marketing may create/manage LO-scoped recipient lists.
 * Missing/unknown → false (existing recipient-list behavior only).
 * Hosted images use the separate `allowTenantImages` toggle.
 */
export function parseAllowTenantLoRecipientLists(raw: unknown): boolean {
  return raw === true
}
