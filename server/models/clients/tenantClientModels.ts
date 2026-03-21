import type { Connection, Model } from 'mongoose'
import { campaignSchema } from './Campaign'
import { campaignRecipientSchema } from './CampaignRecipient'
import { emailTemplateSchema } from './EmailTemplate'
import { manualRecipientSchema } from './ManualRecipients'

export type TenantClientModels = {
  Campaign: Model<any>
  CampaignRecipient: Model<any>
  ManualRecipient: Model<any>
  EmailTemplate: Model<any>
}

export function getTenantClientModels(conn: Connection): TenantClientModels {
  return {
    Campaign: conn.models.Campaign || conn.model('Campaign', campaignSchema),
    CampaignRecipient:
      conn.models.CampaignRecipient ||
      conn.model('CampaignRecipient', campaignRecipientSchema),
    ManualRecipient:
      conn.models.ManualRecipient ||
      conn.model('ManualRecipient', manualRecipientSchema),
    EmailTemplate:
      conn.models.EmailTemplate || conn.model('EmailTemplate', emailTemplateSchema)
  } as TenantClientModels
}
