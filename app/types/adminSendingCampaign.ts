export type AdminSendingCampaignRow = {
  tenantDbName: string
  tenantName: string
  campaignId: string
  campaignName: string
  subject: string
  senderEmail: string
  startedAt?: string
  updatedAt?: string
  counts: {
    sent: number
    notSent: number
    cancelled: number
    pending: number
    failed: number
    sending: number
    total: number
  }
}

export type AdminStoppedCampaignRow = AdminSendingCampaignRow & {
  campaignStatus: string
  ownerEmail: string
  ownerName: string
  ownerId: string
}

export type AdminCampaignCancelReportRecipient = {
  email: string
  status: string
  sentAt?: string
  error?: string
}

export type AdminCampaignCancelReportCampaignDetails = {
  subject: string
  senderEmail: string
  senderName: string
  ownerEmail: string
  ownerId: string
  ownerName: string
  createdBy: string
  updatedAt?: string
}

export type AdminCampaignCancelReport = {
  tenantDbName: string
  tenantName: string
  campaignId: string
  campaignName: string
  campaignStatus: string
  cancelledAt: string
  counts: AdminSendingCampaignRow['counts']
  campaign: AdminCampaignCancelReportCampaignDetails
  sentRecipients: AdminCampaignCancelReportRecipient[]
  notSentRecipients: AdminCampaignCancelReportRecipient[]
}

export type AdminCampaignReportRecipientFilter =
  | 'all'
  | 'sent'
  | 'notSent'
  | 'pending'
  | 'failed'
  | 'cancelled'

export type AdminCampaignReportRecipientsPage = {
  campaignId: string
  filter: AdminCampaignReportRecipientFilter
  page: number
  limit: number
  total: number
  totalPages: number
  counts: AdminSendingCampaignRow['counts']
  items: AdminCampaignCancelReportRecipient[]
}

export type AdminCampaignListPage<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export type AdminStoppedCampaignStatusFilter = 'all' | 'Paused' | 'Cancelled'
