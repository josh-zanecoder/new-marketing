import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { resolveCampaignAudienceSummary } from '@server/utils/campaign/resolveCampaignAudienceCounts'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate } = getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel)
    .findOne(mergeTenantOwnerEmailScopeFilter({ _id: id }, event.context.auth))
    .select(
      '_id name sender recipientsType recipientsListId subject status scheduledAt emailTemplate mergeUserSnapshot replyTo createdAt updatedAt'
    )
    .lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

  const audience = await resolveCampaignAudienceSummary(conn, campaign)

  let emailTemplate: { html: string; name: string } | null = null
  let templateHtml: string | null = null
  let templateHtmlSource: 'editor' | 'upload' = 'editor'
  if (campaign.emailTemplate) {
    const template = await (EmailTemplate as EmailTemplateModel)
      .findById(campaign.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (template) {
      const rawHtml = template.htmlTemplate ?? template.html ?? ''
      emailTemplate = { name: template.name, html: rawHtml }
      templateHtmlSource = template.htmlSource === 'upload' ? 'upload' : 'editor'
      templateHtml = template.css ? `<style>${template.css}</style>${rawHtml}` : rawHtml
    }
  }

  return {
    campaign: {
      id: String(campaign._id),
      name: campaign.name,
      sender: campaign.sender,
      recipientsType: campaign.recipientsType,
      recipientsListId: campaign.recipientsListId,
      subject: campaign.subject,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toISOString()
        : undefined,
      recipientCount: audience.recipientCount,
      recipientStatusCounts: audience.statusCounts ?? undefined,
      recipients: [] as {
        email: string
        contactId?: string
        status?: string
        sentAt?: string
        error?: string
      }[],
      emailTemplate,
      templateHtml,
      templateHtmlSource,
      mergeUserSnapshot: campaign.mergeUserSnapshot,
      replyTo: campaign.replyTo,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    }
  }
})
