/**
 * Registry `clients.allowTenantBeefreeBuilder`.
 * When true, the tenant can open the Beefree email builder.
 * Missing/unknown → false.
 */
export function parseAllowTenantBeefreeBuilder(raw: unknown): boolean {
  return raw === true
}
