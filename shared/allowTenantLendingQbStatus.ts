/**
 * Per-tenant superadmin toggle: use the LendingQB loan status (synced from the CRM) to drive the
 * marketing borrower-status categories. Missing / anything but `true` keeps the existing
 * keyword-based behavior.
 */
export function parseAllowTenantLendingQbStatus(raw: unknown): boolean {
  return raw === true
}
