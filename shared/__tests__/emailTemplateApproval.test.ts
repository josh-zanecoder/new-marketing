import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_PENDING,
  EMAIL_TEMPLATE_APPROVAL_REJECTED,
  emailTemplateCreatorAutoApproves,
  emailTemplateCreatorRequiresApproval,
  hasEmailTemplateMaterialUpdate,
  isEmailTemplateSendableStatus,
  resolveEmailTemplateApprovalStatus
} from '~~/shared/emailTemplateApproval'

describe('emailTemplateApproval shared helpers', () => {
  it('treats missing legacy status as approved / sendable', () => {
    expect(resolveEmailTemplateApprovalStatus(undefined)).toBe(EMAIL_TEMPLATE_APPROVAL_APPROVED)
    expect(resolveEmailTemplateApprovalStatus('')).toBe(EMAIL_TEMPLATE_APPROVAL_APPROVED)
    expect(isEmailTemplateSendableStatus(undefined)).toBe(true)
    expect(isEmailTemplateSendableStatus(EMAIL_TEMPLATE_APPROVAL_PENDING)).toBe(false)
    expect(isEmailTemplateSendableStatus(EMAIL_TEMPLATE_APPROVAL_REJECTED)).toBe(false)
    expect(isEmailTemplateSendableStatus(EMAIL_TEMPLATE_APPROVAL_APPROVED)).toBe(true)
  })

  it('requires approval for LO / LOA and auto-approves OM / Marketing', () => {
    expect(emailTemplateCreatorRequiresApproval('broker')).toBe(true)
    expect(emailTemplateCreatorRequiresApproval('loan-officer-assistant')).toBe(true)
    expect(emailTemplateCreatorAutoApproves('operations-manager')).toBe(true)
    expect(emailTemplateCreatorAutoApproves('marketing')).toBe(true)
    expect(emailTemplateCreatorAutoApproves('broker')).toBe(false)
  })

  it('detects material update keys', () => {
    expect(hasEmailTemplateMaterialUpdate(['categoryId'])).toBe(false)
    expect(hasEmailTemplateMaterialUpdate(['name'])).toBe(true)
    expect(hasEmailTemplateMaterialUpdate(['subject', 'htmlTemplate'])).toBe(true)
  })
})
