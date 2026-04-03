export interface CampaignSender {
  name: string
  email: string
}

export interface CampaignRecipient {
  email: string
  /** Present when audience rows reference CRM contacts (manual / list snapshots). */
  contactId?: string
  name?: string
  status?: string
  sentAt?: string
  error?: string
}

export type CampaignRecipientsType = 'manual' | 'list'
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Failed'

export interface Campaign {
  id: string
  name: string
  sender: CampaignSender
  recipientsType: CampaignRecipientsType
  recipientsListId?: string
  subject: string
  status: CampaignStatus | string
  /** ISO 8601; set when the campaign is scheduled to send later. */
  scheduledAt?: string
  recipients: CampaignRecipient[]
  createdAt: string
  updatedAt: string
}
export interface SendStatus {
  campaignId?: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  total: number
  done: boolean
}

