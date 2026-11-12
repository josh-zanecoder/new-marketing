/**
 * Registry `clients.allowTenantGrapesBuilder`.
 * When true, the tenant can open the GrapesJS email editor.
 * Missing/unknown → false.
 */
export function parseAllowTenantGrapesBuilder(raw: unknown): boolean {
  return raw === true
}
