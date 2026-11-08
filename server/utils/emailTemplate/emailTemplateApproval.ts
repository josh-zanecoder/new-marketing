import {
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_PENDING,
  EMAIL_TEMPLATE_APPROVAL_REJECTED,
  emailTemplateCreatorAutoApproves,
  emailTemplateCreatorRequiresApproval,
  hasEmailTemplateMaterialUpdate,
  isEmailTemplateApprovalStatus,
  resolveEmailTemplateApprovalStatus,
  type EmailTemplateApprovalStatus
} from '~~/shared/emailTemplateApproval'
import {
  isRegisteredTenantAuthContext,
  isTenantApiKeyAuthContext,
  tenantCreatedByFromAuth,
  tenantUserEmailFromAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import { getRegistryConnection } from '@server/lib/mongoose'

/** Approval workflow only when Superadmin LO recipient-lists flag is on the session. */
export function isEmailTemplateApprovalEnabled(auth: unknown): boolean {
  return isTenantApiKeyAuthContext(auth) && auth.allowTenantLoRecipientLists === true
}

function tenantUserRoleFromAuth(auth: unknown): string {
  if (!isTenantApiKeyAuthContext(auth)) return ''
  return typeof auth.tenantUserRole === 'string' ? auth.tenantUserRole.trim() : ''
}

export type EmailTemplateApprovalWriteFields = {
  approvalStatus: EmailTemplateApprovalStatus
  approvalSubmittedAt?: Date | null
  approvalReviewedAt?: Date | null
  approvalReviewedBy?: string
  approvalRejectionReason?: string
}

/**
 * Fields to stamp on create when LO-list flag is ON.
 * Flag OFF → empty (classic template, no approval fields).
 */
export function emailTemplateApprovalFieldsOnCreate(auth: unknown): Partial<EmailTemplateApprovalWriteFields> {
  if (!isEmailTemplateApprovalEnabled(auth)) return {}

  const role = tenantUserRoleFromAuth(auth)
  if (emailTemplateCreatorAutoApproves(role)) {
    return {
      approvalStatus: EMAIL_TEMPLATE_APPROVAL_APPROVED,
      approvalSubmittedAt: null,
      approvalReviewedAt: null,
      approvalReviewedBy: '',
      approvalRejectionReason: ''
    }
  }

  if (emailTemplateCreatorRequiresApproval(role)) {
    return {
      approvalStatus: EMAIL_TEMPLATE_APPROVAL_PENDING,
      approvalSubmittedAt: new Date(),
      approvalReviewedAt: null,
      approvalReviewedBy: '',
      approvalRejectionReason: ''
    }
  }

  return {
    approvalStatus: EMAIL_TEMPLATE_APPROVAL_PENDING,
    approvalSubmittedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: '',
    approvalRejectionReason: ''
  }
}

/**
 * When LO/LOA make a material edit under flag ON → pending again.
 * OM/Marketing material edit → approved (auto).
 * Flag OFF or non-material → no approval patch.
 */
export function emailTemplateApprovalFieldsOnUpdate(
  auth: unknown,
  setKeys: Iterable<string>
): Partial<EmailTemplateApprovalWriteFields> {
  if (!isEmailTemplateApprovalEnabled(auth)) return {}
  if (!hasEmailTemplateMaterialUpdate(setKeys)) return {}

  const role = tenantUserRoleFromAuth(auth)
  if (emailTemplateCreatorAutoApproves(role)) {
    return {
      approvalStatus: EMAIL_TEMPLATE_APPROVAL_APPROVED,
      approvalRejectionReason: '',
      approvalReviewedAt: null,
      approvalReviewedBy: ''
    }
  }

  return {
    approvalStatus: EMAIL_TEMPLATE_APPROVAL_PENDING,
    approvalSubmittedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: '',
    approvalRejectionReason: ''
  }
}

export type EmailTemplateApprovalApiPayload = {
  approvalStatus: EmailTemplateApprovalStatus
  approvalSubmittedAt: string | null
  approvalReviewedAt: string | null
  approvalReviewedBy: string
  approvalRejectionReason: string
  /** True when this session may approve/reject (OM/Marketing + flag ON). */
  canApprove: boolean
}

export function emailTemplateApprovalApiPayload(
  doc: {
    approvalStatus?: unknown
    approvalSubmittedAt?: Date | string | null
    approvalReviewedAt?: Date | string | null
    approvalReviewedBy?: string | null
    approvalRejectionReason?: string | null
  } | null | undefined,
  auth: unknown
): EmailTemplateApprovalApiPayload | null {
  if (!isEmailTemplateApprovalEnabled(auth)) return null

  const toIso = (v: Date | string | null | undefined): string | null => {
    if (!v) return null
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const role = tenantUserRoleFromAuth(auth)
  return {
    approvalStatus: resolveEmailTemplateApprovalStatus(doc?.approvalStatus),
    approvalSubmittedAt: toIso(doc?.approvalSubmittedAt ?? null),
    approvalReviewedAt: toIso(doc?.approvalReviewedAt ?? null),
    approvalReviewedBy: String(doc?.approvalReviewedBy ?? '').trim(),
    approvalRejectionReason: String(doc?.approvalRejectionReason ?? '').trim(),
    canApprove: emailTemplateCreatorAutoApproves(role)
  }
}

/** Reviewer stamp for approve/reject. */
export function emailTemplateApprovalReviewerStamp(auth: unknown): {
  approvalReviewedBy: string
  approvalReviewedAt: Date
} {
  const by =
    tenantCreatedByFromAuth(auth) ||
    tenantUserEmailFromAuth(auth) ||
    ''
  return {
    approvalReviewedBy: by,
    approvalReviewedAt: new Date()
  }
}

export function canApproveEmailTemplates(auth: unknown): boolean {
  if (!isEmailTemplateApprovalEnabled(auth)) return false
  return emailTemplateCreatorAutoApproves(tenantUserRoleFromAuth(auth))
}

/**
 * Library list (Email templates tab / campaign picker) for OM/Marketing:
 * hide pending — those belong on Template approvals only.
 * LO/LOA keep pending in their library so they can track/edit submissions.
 * Flag OFF → null (no extra filter).
 */
export function emailTemplateLibraryExcludePendingFilter(
  auth: unknown
): { approvalStatus: { $ne: typeof EMAIL_TEMPLATE_APPROVAL_PENDING } } | null {
  if (!canApproveEmailTemplates(auth)) return null
  return { approvalStatus: { $ne: EMAIL_TEMPLATE_APPROVAL_PENDING } }
}

/**
 * OM/Marketing + LO recipient-lists flag required for approve/reject / pending queue.
 * Re-reads registry when session flag was omitted.
 */
export async function requireEmailTemplateApprover(
  event: { context: { auth?: unknown } },
  message = 'Only Operations Manager or Marketing can approve templates'
): Promise<{ auth: RegisteredTenantAuthContext }> {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  let gatedAuth: unknown = auth
  if (isTenantApiKeyAuthContext(auth) && auth.allowTenantLoRecipientLists !== true) {
    const registry = await getRegistryConnection()
    const regDoc = await registry.collection('clients').findOne(
      { dbName: auth.dbName },
      { projection: { allowTenantLoRecipientLists: 1 } }
    )
    if (!parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)) {
      throw createError({
        statusCode: 403,
        message: 'Template approval is disabled for this tenant'
      })
    }
    gatedAuth = { ...auth, allowTenantLoRecipientLists: true as const }
  } else if (!isEmailTemplateApprovalEnabled(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Template approval is disabled for this tenant'
    })
  }

  if (!canApproveEmailTemplates(gatedAuth)) {
    throw createError({ statusCode: 403, message })
  }

  return { auth: gatedAuth as RegisteredTenantAuthContext }
}

export function emailTemplateApprovalFieldsOnApprove(auth: unknown): EmailTemplateApprovalWriteFields {
  const reviewer = emailTemplateApprovalReviewerStamp(auth)
  return {
    approvalStatus: EMAIL_TEMPLATE_APPROVAL_APPROVED,
    approvalReviewedAt: reviewer.approvalReviewedAt,
    approvalReviewedBy: reviewer.approvalReviewedBy,
    approvalRejectionReason: ''
  }
}

export function emailTemplateApprovalFieldsOnReject(
  auth: unknown,
  reason: string
): EmailTemplateApprovalWriteFields {
  const reviewer = emailTemplateApprovalReviewerStamp(auth)
  return {
    approvalStatus: EMAIL_TEMPLATE_APPROVAL_REJECTED,
    approvalReviewedAt: reviewer.approvalReviewedAt,
    approvalReviewedBy: reviewer.approvalReviewedBy,
    approvalRejectionReason: reason.trim().slice(0, 2000)
  }
}

export function assertEmailTemplateApprovalStatus(
  value: unknown
): EmailTemplateApprovalStatus {
  if (!isEmailTemplateApprovalStatus(value)) {
    throw createError({ statusCode: 400, message: 'Invalid approval status' })
  }
  return value
}
