/**
 * Email template approval (LO recipient-lists flag path).
 * Flag OFF → classic templates (no approval). Flag ON → LO/LOA pending until OM/Marketing approve.
 */

import {
  isFullAccessMarketingRole,
  isLoanOfficerLikeRole
} from '~~/shared/marketingAudienceAccess'

export const EMAIL_TEMPLATE_APPROVAL_PENDING = 'pending_approval' as const
export const EMAIL_TEMPLATE_APPROVAL_APPROVED = 'approved' as const
export const EMAIL_TEMPLATE_APPROVAL_REJECTED = 'rejected' as const

export const EMAIL_TEMPLATE_APPROVAL_STATUSES = [
  EMAIL_TEMPLATE_APPROVAL_PENDING,
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_REJECTED
] as const

export type EmailTemplateApprovalStatus = (typeof EMAIL_TEMPLATE_APPROVAL_STATUSES)[number]

/** Fields that count as a material edit (LO/LOA → back to pending). */
export const EMAIL_TEMPLATE_MATERIAL_UPDATE_KEYS = [
  'name',
  'subject',
  'htmlTemplate',
  'description'
] as const

export type EmailTemplateMaterialUpdateKey = (typeof EMAIL_TEMPLATE_MATERIAL_UPDATE_KEYS)[number]

export function isEmailTemplateApprovalStatus(value: unknown): value is EmailTemplateApprovalStatus {
  return (
    value === EMAIL_TEMPLATE_APPROVAL_PENDING ||
    value === EMAIL_TEMPLATE_APPROVAL_APPROVED ||
    value === EMAIL_TEMPLATE_APPROVAL_REJECTED
  )
}

/**
 * Effective status for API/UI when flag is ON.
 * Missing/legacy → approved (do not block existing templates).
 */
export function resolveEmailTemplateApprovalStatus(
  raw: unknown
): EmailTemplateApprovalStatus {
  if (isEmailTemplateApprovalStatus(raw)) return raw
  return EMAIL_TEMPLATE_APPROVAL_APPROVED
}

export function isEmailTemplateSendableStatus(raw: unknown): boolean {
  return resolveEmailTemplateApprovalStatus(raw) === EMAIL_TEMPLATE_APPROVAL_APPROVED
}

/** True when this role must submit for approval (LO / LOA). */
export function emailTemplateCreatorRequiresApproval(
  tenantUserRole: string | null | undefined
): boolean {
  if (isFullAccessMarketingRole(tenantUserRole)) return false
  // LO/LOA always; unknown roles stay pending when flag is ON (safe default).
  if (isLoanOfficerLikeRole(tenantUserRole)) return true
  return true
}

export function emailTemplateCreatorAutoApproves(
  tenantUserRole: string | null | undefined
): boolean {
  return isFullAccessMarketingRole(tenantUserRole)
}

export function hasEmailTemplateMaterialUpdate(
  setKeys: Iterable<string>
): boolean {
  const material = new Set<string>(EMAIL_TEMPLATE_MATERIAL_UPDATE_KEYS)
  for (const key of setKeys) {
    if (material.has(key)) return true
  }
  return false
}
