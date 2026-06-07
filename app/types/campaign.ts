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
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Paused' | 'Sent' | 'Failed' | 'Cancelled'

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

export type CampaignSendRecipientReportStatus = 'all' | 'sent' | 'pending' | 'failed' | 'cancelled'

export interface CampaignSendRecipientReportItem {
  email: string
  status?: string
  sentAt?: string
  error?: string
}

export interface CampaignSendRecipientReport {
  campaignId: string
  campaignStatus: string
  page: number
  limit: number
  total: number
  totalPages: number
  counts: {
    sent: number
    pending: number
    failed: number
    sending: number
    cancelled: number
    total: number
  }
  items: CampaignSendRecipientReportItem[]
}

export type CampaignSendCancelReportRecipient = {
  email: string
  status: string
  sentAt?: string
  error?: string
}

export type CampaignSendCancelReport = {
  tenantDbName: string
  tenantName: string
  campaignId: string
  campaignName: string
  campaignStatus: string
  cancelledAt: string
  counts: {
    sent: number
    notSent: number
    cancelled: number
    pending: number
    failed: number
    sending: number
    total: number
  }
  sentRecipients: CampaignSendCancelReportRecipient[]
  notSentRecipients: CampaignSendCancelReportRecipient[]
}

