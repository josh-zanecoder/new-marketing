/**
 * Registry `clients.allowTenantAdvancedRecipientFiltering`.
 * When true, tenant marketing can filter and select campaign recipients with
 * CRM Contacts filters (assigned LO, borrower status, contact info, contact type,
 * match count, preview, and live membership before send).
 * Missing/unknown → false (classic recipient-list selection only).
 */
export function parseAllowTenantAdvancedRecipientFiltering(raw: unknown): boolean {
  return raw === true
}
