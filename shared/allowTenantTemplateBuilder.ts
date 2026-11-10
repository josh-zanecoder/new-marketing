/**
 * Registry `clients.allowTenantTemplateBuilder`.
 * When true, the tenant can open the template builder and replace images.
 * Missing/unknown → false.
 */
export function parseAllowTenantTemplateBuilder(raw: unknown): boolean {
  return raw === true
}
