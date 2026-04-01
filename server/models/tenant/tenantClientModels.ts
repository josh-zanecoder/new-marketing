import type { Connection, Model } from 'mongoose'
import { campaignSchema } from './Campaign'
import { campaignRecipientSchema } from './CampaignRecipient'
import { contactTypeSchema } from './ContactType'
import { contactSchema } from './Contact'
import { emailDynamicVariableSchema } from './EmailDynamicVariable'
import { emailTemplateSchema } from './EmailTemplate'
import { manualRecipientSchema } from './ManualRecipients'
import { recipientFilterSchema } from './RecipientFilter'
import { recipientListSchema } from './RecipientList'
import { recipientListMemberSchema } from './RecipientListMember'

export type TenantClientModels = {
  Campaign: Model<unknown>
  CampaignRecipient: Model<unknown>
  ManualRecipient: Model<unknown>
  EmailTemplate: Model<unknown>
  EmailDynamicVariable: Model<unknown>
  ContactType: Model<unknown>
  RecipientFilter: Model<unknown>
  Contact: Model<unknown>
  RecipientList: Model<unknown>
  RecipientListMember: Model<unknown>
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
    EmailDynamicVariable:
      conn.models.EmailDynamicVariable ||
      conn.model('EmailDynamicVariable', emailDynamicVariableSchema),
    ContactType:
      conn.models.ContactType || conn.model('ContactType', contactTypeSchema),
    RecipientFilter:
      conn.models.RecipientFilter ||
      conn.model('RecipientFilter', recipientFilterSchema),
    Contact: conn.models.Contact || conn.model('Contact', contactSchema),
    RecipientList:
      conn.models.RecipientList ||
      conn.model('RecipientList', recipientListSchema),
    RecipientListMember:
      conn.models.RecipientListMember ||
      conn.model('RecipientListMember', recipientListMemberSchema)
  } as TenantClientModels
}
