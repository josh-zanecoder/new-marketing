/**
 * Registry `clients.allowTenantImages`.
 * When true, tenant marketing shows the Images library: sidebar item,
 * plus upload and delete hosted images.
 * Inserting images into email templates uses `allowTenantInsertImage`.
 * Missing/unknown → false.
 */
export function parseAllowTenantImages(raw: unknown): boolean {
  return raw === true
}
