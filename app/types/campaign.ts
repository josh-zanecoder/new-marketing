export interface CampaignSender {
  name: string
  email: string
}

export interface CampaignRecipient {
  email: string
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

