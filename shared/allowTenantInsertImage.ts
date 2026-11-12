/**
 * Registry `clients.allowTenantInsertImage`.
 * When true, tenant marketing can insert and replace images in email templates.
 * Missing/unknown → false. Independent of the Images library (`allowTenantImages`).
 */
export function parseAllowTenantInsertImage(raw: unknown): boolean {
  return raw === true
}
