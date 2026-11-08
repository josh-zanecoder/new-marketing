import { describe, expect, it } from 'vitest'
import {
  emailTemplateApprovalApiPayload,
  emailTemplateApprovalFieldsOnCreate,
  emailTemplateApprovalFieldsOnUpdate,
  emailTemplateLibraryExcludePendingFilter,
  isEmailTemplateApprovalEnabled
} from '@server/utils/emailTemplate/emailTemplateApproval'
import {
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_PENDING
} from '~~/shared/emailTemplateApproval'

const loAuth = {
  type: 'tenantApiKey' as const,
  role: 'tenant' as const,
  dbName: 'demo_db',
  tenantName: 'Demo',
  tenantUserEmail: 'lo@example.com',
  tenantUserRole: 'broker',
  contactOwnerScope: ['lo@example.com'],
  allowTenantLoRecipientLists: true as const
}

const omAuth = {
  ...loAuth,
  tenantUserEmail: 'om@example.com',
  tenantUserRole: 'operations-manager',
  tenantWideContacts: true as const,
  contactOwnerScope: [] as string[]
}

const marketingAuth = {
  ...omAuth,
  tenantUserEmail: 'mkt@example.com',
  tenantUserRole: 'marketing'
}

const flagOffAuth = {
  type: 'tenantApiKey' as const,
  role: 'tenant' as const,
  dbName: 'demo_db',
  tenantName: 'Demo',
  tenantUserEmail: 'lo@example.com',
  tenantUserRole: 'broker',
  contactOwnerScope: ['lo@example.com']
}

describe('isEmailTemplateApprovalEnabled', () => {
  it('is on only when LO recipient-lists flag is on the session', () => {
    expect(isEmailTemplateApprovalEnabled(loAuth)).toBe(true)
    expect(isEmailTemplateApprovalEnabled(flagOffAuth)).toBe(false)
  })
})

describe('emailTemplateLibraryExcludePendingFilter', () => {
  it('excludes pending for OM/Marketing when flag is ON', () => {
    expect(emailTemplateLibraryExcludePendingFilter(omAuth)).toEqual({
      approvalStatus: { $ne: EMAIL_TEMPLATE_APPROVAL_PENDING }
    })
    expect(emailTemplateLibraryExcludePendingFilter(marketingAuth)).toEqual({
      approvalStatus: { $ne: EMAIL_TEMPLATE_APPROVAL_PENDING }
    })
  })

  it('does not exclude pending for LO or when flag is OFF', () => {
    expect(emailTemplateLibraryExcludePendingFilter(loAuth)).toBeNull()
    expect(emailTemplateLibraryExcludePendingFilter(flagOffAuth)).toBeNull()
  })
})

describe('emailTemplateApprovalFieldsOnCreate', () => {
  it('returns nothing when flag is OFF', () => {
    expect(emailTemplateApprovalFieldsOnCreate(flagOffAuth)).toEqual({})
  })

  it('sets pending for LO when flag is ON', () => {
    const fields = emailTemplateApprovalFieldsOnCreate(loAuth)
    expect(fields.approvalStatus).toBe(EMAIL_TEMPLATE_APPROVAL_PENDING)
    expect(fields.approvalSubmittedAt).toBeInstanceOf(Date)
  })

  it('sets approved for OM and Marketing when flag is ON', () => {
    expect(emailTemplateApprovalFieldsOnCreate(omAuth).approvalStatus).toBe(
      EMAIL_TEMPLATE_APPROVAL_APPROVED
    )
    expect(emailTemplateApprovalFieldsOnCreate(marketingAuth).approvalStatus).toBe(
      EMAIL_TEMPLATE_APPROVAL_APPROVED
    )
  })
})

describe('emailTemplateApprovalFieldsOnUpdate', () => {
  it('ignores non-material updates', () => {
    expect(emailTemplateApprovalFieldsOnUpdate(loAuth, ['categoryId'])).toEqual({})
  })

  it('resets LO material edits to pending', () => {
    const fields = emailTemplateApprovalFieldsOnUpdate(loAuth, ['subject', 'htmlTemplate'])
    expect(fields.approvalStatus).toBe(EMAIL_TEMPLATE_APPROVAL_PENDING)
    expect(fields.approvalSubmittedAt).toBeInstanceOf(Date)
    expect(fields.approvalRejectionReason).toBe('')
  })

  it('keeps OM material edits approved', () => {
    expect(emailTemplateApprovalFieldsOnUpdate(omAuth, ['htmlTemplate']).approvalStatus).toBe(
      EMAIL_TEMPLATE_APPROVAL_APPROVED
    )
  })
})

describe('approve / reject field helpers', () => {
  it('stamps reviewer on approve and reject', async () => {
    const { emailTemplateApprovalFieldsOnApprove, emailTemplateApprovalFieldsOnReject } =
      await import('@server/utils/emailTemplate/emailTemplateApproval')
    const approved = emailTemplateApprovalFieldsOnApprove(omAuth)
    expect(approved.approvalStatus).toBe(EMAIL_TEMPLATE_APPROVAL_APPROVED)
    expect(approved.approvalReviewedBy).toBeTruthy()
    expect(approved.approvalRejectionReason).toBe('')

    const rejected = emailTemplateApprovalFieldsOnReject(omAuth, 'Fix subject')
    expect(rejected.approvalStatus).toBe('rejected')
    expect(rejected.approvalRejectionReason).toBe('Fix subject')
  })
})

describe('emailTemplateApprovalApiPayload', () => {
  it('returns null when flag is OFF', () => {
    expect(
      emailTemplateApprovalApiPayload({ approvalStatus: 'pending_approval' }, flagOffAuth)
    ).toBeNull()
  })

  it('exposes status and canApprove for OM', () => {
    const payload = emailTemplateApprovalApiPayload(
      {
        approvalStatus: 'pending_approval',
        approvalSubmittedAt: new Date('2026-01-01T00:00:00.000Z')
      },
      omAuth
    )
    expect(payload?.approvalStatus).toBe(EMAIL_TEMPLATE_APPROVAL_PENDING)
    expect(payload?.canApprove).toBe(true)
    expect(payload?.approvalSubmittedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('treats missing status as approved for LO sessions', () => {
    const payload = emailTemplateApprovalApiPayload({}, loAuth)
    expect(payload?.approvalStatus).toBe(EMAIL_TEMPLATE_APPROVAL_APPROVED)
    expect(payload?.canApprove).toBe(false)
  })
})
