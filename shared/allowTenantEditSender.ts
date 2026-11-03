/**
 * Registry `clients.allowTenantEditSender`.
 * When true, the tenant marketing UI may edit campaign sender.
 * Missing/unknown → false (superadmin-only sender, current default).
 */
export function parseAllowTenantEditSender(raw: unknown): boolean {
  return raw === true
}
