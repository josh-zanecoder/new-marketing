/**
 * Registry `clients.allowTenantTemplateApproval`.
 * When true, tenant marketing runs the email template approval workflow:
 * pending/approved/rejected status, Template approvals page, and send guards.
 * Missing/unknown → false.
 */
export function parseAllowTenantTemplateApproval(raw: unknown): boolean {
  return raw === true
}
