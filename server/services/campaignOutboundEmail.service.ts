import {
  sendCampaignBatchWithMessageVersions,
  sendEmail as sendBrevoEmail,
  type SendEmailParams,
  type CampaignBatchMessageVersion
} from './brevo.service'
import { TENANT_EMAIL_PROVIDER_ZC_MAIL } from '@server/constants/emailProvider'
import { buildCampaignZcMailTags } from '@server/utils/zcmail/campaignZcMailTags'
import { registerEmailMessageRouting } from '@server/utils/zcmail/emailMessageRouting'
import {
  alignZcMailBulkResultsToRecipients,
  sendZcMailBulk
} from '@server/utils/zcmail/sendZcMailBulk'
import { sendZcMailEmail, ZcMailSendError } from '@server/utils/zcmail/sendZcMailEmail'
import {
  requireZcMailSendConfig,
  resolveTenantEmailSendConfig
} from '@server/utils/zcmail/resolveTenantEmailSendConfig'
import { formatZcMailFromAddress } from '@server/utils/zcmail/zcMailFromAddress'

export type CampaignOutboundBatchParams = {
  sender: SendEmailParams['sender']
  replyTo?: SendEmailParams['replyTo']
  messageVersions: CampaignBatchMessageVersion[]
  tags?: string[]
  tenantId?: string
  dbName?: string
  user?: string
  apiKey?: string
  idempotencyKey?: string
}

function extractCampaignIdFromTags(tags?: string[]): string | undefined {
  if (!tags?.length) return undefined
  for (const t of tags) {
    if (t.toLowerCase().startsWith('campaign:')) {
      const id = t.slice('campaign:'.length).trim()
      if (id) return id
    }
  }
  return undefined
}

async function sendCampaignBatchViaZcMail(
  params: CampaignOutboundBatchParams
): Promise<{ messageIds: (string | null)[]; error?: string; provider: string }> {
  const resolved = await resolveTenantEmailSendConfig(params.dbName)
  let config
  try {
    config = requireZcMailSendConfig(resolved)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { messageIds: [], error: message, provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  }

  if (params.messageVersions.length === 0) {
    return { messageIds: [], provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  }

  const campaignId = extractCampaignIdFromTags(params.tags)
  const source = params.tags?.includes('test-email')
    ? 'new-marketing-test'
    : 'new-marketing-campaign'
  const from = formatZcMailFromAddress(params.sender.email, params.sender.name)

  const recipients = params.messageVersions.map((version) => {
    const to = version.to[0]?.email?.trim() || ''
    const replyTo = version.replyTo?.email?.trim() || params.replyTo?.email?.trim() || ''
    return {
      to,
      subject: String(version.subject ?? '').trim() || '(No subject)',
      html: String(version.htmlContent ?? '').trim() || '<p></p>',
      ...(replyTo ? { replyTo } : {}),
      tags: buildCampaignZcMailTags({
        dbName: params.dbName,
        tenantId: params.tenantId,
        campaignId,
        user: params.user,
        source
      })
    }
  })

  try {
    const job = await sendZcMailBulk({
      baseUrl: config.zcMailBaseUrl,
      apiKey: config.apiKey,
      tenant: config.zcMailTenant,
      from,
      archive: config.zcMailArchive,
      recipients
    })
    const messageIds = alignZcMailBulkResultsToRecipients(
      params.messageVersions.length,
      job.results
    )
    const dbName = params.dbName?.trim()
    if (dbName) {
      const userEmail = String(params.user || '')
        .trim()
        .toLowerCase()
      const routing = messageIds
        .filter((id): id is string => Boolean(id && String(id).trim()))
        .map((messageId) => ({
          messageId: String(messageId).trim(),
          dbName,
          campaignId,
          ...(userEmail.includes('@') ? { userEmail } : {})
        }))
      if (routing.length) {
        try {
          await registerEmailMessageRouting(routing)
        } catch (err) {
          console.warn('[zcMail] message routing register failed', {
            dbName,
            count: routing.length,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }
    }
    return { messageIds, provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  } catch (e: unknown) {
    const err =
      e instanceof ZcMailSendError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e)
    console.error('[zcMail] Campaign batch send failed:', err)
    return { messageIds: [], error: err, provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  }
}

/**
 * Routes campaign batch sends to Brevo or zcMail based on tenant email provider.
 */
export async function sendCampaignOutboundBatch(
  params: CampaignOutboundBatchParams
): Promise<{ messageIds: (string | null)[]; error?: string; provider: string }> {
  const config = await resolveTenantEmailSendConfig(params.dbName)
  if (config.provider === TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    return sendCampaignBatchViaZcMail(params)
  }
  const result = await sendCampaignBatchWithMessageVersions(params)
  return { ...result, provider: config.provider }
}

export async function sendCampaignOutboundEmail(
  params: SendEmailParams
): Promise<{ messageId?: string; error?: string; provider: string }> {
  const resolved = await resolveTenantEmailSendConfig(params.dbName)
  if (resolved.provider !== TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    const result = await sendBrevoEmail(params)
    return { ...result, provider: resolved.provider }
  }

  let config
  try {
    config = requireZcMailSendConfig(resolved)
  } catch (e: unknown) {
    return {
      error: e instanceof Error ? e.message : String(e),
      provider: TENANT_EMAIL_PROVIDER_ZC_MAIL
    }
  }

  const to = params.to.map((r) => r.email).filter(Boolean)
  const campaignId = extractCampaignIdFromTags(params.tags)
  const source = params.tags?.includes('test-email')
    ? 'new-marketing-test'
    : 'new-marketing-campaign'

  try {
    const result = await sendZcMailEmail({
      baseUrl: config.zcMailBaseUrl,
      apiKey: config.apiKey,
      tenant: config.zcMailTenant,
      to,
      subject: params.subject,
      html: params.htmlContent,
      archive: config.zcMailArchive,
      from: formatZcMailFromAddress(params.sender.email, params.sender.name),
      replyTo: params.replyTo?.email?.trim() || null,
      tags: buildCampaignZcMailTags({
        dbName: params.dbName,
        tenantId: params.tenantId,
        campaignId,
        user: params.user,
        source
      })
    })
    const messageId = result.messageId || undefined
    const dbName = params.dbName?.trim()
    if (dbName && messageId) {
      const userEmail = String(params.user || '')
        .trim()
        .toLowerCase()
      try {
        await registerEmailMessageRouting([
          {
            messageId,
            dbName,
            campaignId,
            ...(userEmail.includes('@') ? { userEmail } : {})
          }
        ])
      } catch (err) {
        console.warn('[zcMail] message routing register failed', {
          dbName,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
    return { messageId, provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  } catch (e: unknown) {
    const err =
      e instanceof ZcMailSendError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e)
    console.error('[zcMail] Send failed:', err)
    return { error: err, provider: TENANT_EMAIL_PROVIDER_ZC_MAIL }
  }
}
