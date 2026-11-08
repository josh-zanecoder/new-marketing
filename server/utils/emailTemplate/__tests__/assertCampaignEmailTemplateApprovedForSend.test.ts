import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_PENDING,
  isEmailTemplateSendableStatus
} from '~~/shared/emailTemplateApproval'
import { EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE } from '@server/utils/emailTemplate/assertCampaignEmailTemplateApprovedForSend'

describe('assertCampaignEmailTemplateApprovedForSend helpers', () => {
  it('exports a stable user-facing block message', () => {
    expect(EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE).toContain('approval')
  })

  it('treats pending as not sendable and approved as sendable', () => {
    expect(isEmailTemplateSendableStatus(EMAIL_TEMPLATE_APPROVAL_PENDING)).toBe(false)
    expect(isEmailTemplateSendableStatus(EMAIL_TEMPLATE_APPROVAL_APPROVED)).toBe(true)
    expect(isEmailTemplateSendableStatus(undefined)).toBe(true)
  })
})
