import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolveTenantEmailSendConfig } from '@server/utils/zcmail/resolveTenantEmailSendConfig'
import { sendZcMailBulk } from '@server/utils/zcmail/sendZcMailBulk'
import { sendCampaignBatchWithMessageVersions } from './brevo.service'
import { sendCampaignOutboundBatch } from './campaignOutboundEmail.service'

vi.mock('@server/utils/zcmail/resolveTenantEmailSendConfig', () => ({
  resolveTenantEmailSendConfig: vi.fn(),
  requireZcMailSendConfig: vi.fn((config: { provider: string; apiKey?: string; zcMailTenant?: string; zcMailBaseUrl?: string }) => {
    if (config.provider !== 'ZC_MAIL') throw new Error('Expected ZC_MAIL email provider')
    if (!config.apiKey) throw new Error('zcMail API key is not configured for this tenant. Set it in Admin → Tenants.')
    if (!config.zcMailTenant) throw new Error('zcMail tenant is not configured')
    if (!config.zcMailBaseUrl) throw new Error('zcMail base URL is not configured')
    return config
  })
}))

vi.mock('@server/utils/zcmail/sendZcMailBulk', async () => {
  const actual = await vi.importActual<typeof import('@server/utils/zcmail/sendZcMailBulk')>(
    '@server/utils/zcmail/sendZcMailBulk'
  )
  return {
    ...actual,
    sendZcMailBulk: vi.fn()
  }
})

vi.mock('@server/utils/zcmail/emailMessageRouting', () => ({
  registerEmailMessageRouting: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./brevo.service', () => ({
  sendCampaignBatchWithMessageVersions: vi.fn(),
  sendEmail: vi.fn()
}))

const zcMailConfig = {
  provider: 'ZC_MAIL' as const,
  apiKey: 'zcm_test',
  zcMailBaseUrl: 'http://localhost:3003',
  zcMailTenant: 'acme',
  zcMailArchive: true
}

describe('sendCampaignOutboundBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes ZC_MAIL configs to zcMail bulk send', async () => {
    vi.mocked(resolveTenantEmailSendConfig).mockResolvedValue(zcMailConfig)
    vi.mocked(sendZcMailBulk).mockResolvedValue({
      ok: true,
      jobId: 'job-1',
      status: 'completed',
      sent: 1,
      failed: 0,
      results: [{ status: 'sent', sesMessageId: 'ses-1' }]
    })

    const result = await sendCampaignOutboundBatch({
      sender: { name: 'Acme', email: 'from@acme.com' },
      messageVersions: [
        { to: [{ email: 'a@example.com' }], subject: 'Hi', htmlContent: '<p>Hi</p>' }
      ],
      tags: ['campaign:abc'],
      dbName: 'acme_db',
      tenantId: 'tid-1'
    })

    expect(result).toEqual({ messageIds: ['ses-1'], provider: 'ZC_MAIL' })
    expect(sendZcMailBulk).toHaveBeenCalledTimes(1)
    expect(sendCampaignBatchWithMessageVersions).not.toHaveBeenCalled()
  })

  it('routes Brevo configs to the Brevo batch sender', async () => {
    vi.mocked(resolveTenantEmailSendConfig).mockResolvedValue({ provider: 'BREVO' })
    vi.mocked(sendCampaignBatchWithMessageVersions).mockResolvedValue({
      messageIds: ['brevo-1']
    })

    const result = await sendCampaignOutboundBatch({
      sender: { name: 'Acme', email: 'from@acme.com' },
      messageVersions: [
        { to: [{ email: 'a@example.com' }], subject: 'Hi', htmlContent: '<p>Hi</p>' }
      ],
      dbName: 'acme_db'
    })

    expect(result).toEqual({ messageIds: ['brevo-1'], provider: 'BREVO' })
    expect(sendZcMailBulk).not.toHaveBeenCalled()
  })
})
