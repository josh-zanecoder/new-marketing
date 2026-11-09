/**
 * Registry `clients.allowTenantImages`.
 * When true, tenant marketing shows the Images library: sidebar item,
 * upload and delete hosted images, and insert or replace them in email templates.
 * Missing/unknown → false.
 */
export function parseAllowTenantImages(raw: unknown): boolean {
  return raw === true
}
