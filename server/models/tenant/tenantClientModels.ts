import type { Connection, Model } from 'mongoose'
import { campaignSchema } from './Campaign'
import { campaignRecipientSchema } from './CampaignRecipient'
import { contactSchema } from './Contact'
import { emailTemplateSchema } from './EmailTemplate'
import { manualRecipientSchema } from './ManualRecipients'
import { recipientListSchema } from './RecipientList'
import { recipientListMemberSchema } from './RecipientListMember'

export type TenantClientModels = {
  Campaign: Model<any>
  CampaignRecipient: Model<any>
  ManualRecipient: Model<any>
  EmailTemplate: Model<any>
  Contact: Model<any>
  RecipientList: Model<any>
  RecipientListMember: Model<any>
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
      conn.models.EmailTemplate || conn.model('EmailTemplate', emailTemplateSchema),
    Contact: conn.models.Contact || conn.model('Contact', contactSchema),
    RecipientList:
      conn.models.RecipientList ||
      conn.model('RecipientList', recipientListSchema),
    RecipientListMember:
      conn.models.RecipientListMember ||
      conn.model('RecipientListMember', recipientListMemberSchema)
  } as TenantClientModels
}
