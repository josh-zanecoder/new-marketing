/**
 * Registry `clients.allowTenantEditText`.
 * When true, the tenant can change words in the visual template builder.
 * Missing/unknown → false.
 */
export function parseAllowTenantEditText(raw: unknown): boolean {
  return raw === true
}
