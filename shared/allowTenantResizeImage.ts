/**
 * Registry `clients.allowTenantResizeImage`.
 * When true, the tenant can resize photos in the visual template builder.
 * Missing/unknown → false.
 */
export function parseAllowTenantResizeImage(raw: unknown): boolean {
  return raw === true
}
