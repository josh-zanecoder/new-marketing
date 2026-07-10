import type { Campaign } from '~/types/campaign'

export type AdminCampaign = Campaign & {
  tenantDbName: string
  tenantName: string
}

export function adminCampaignKey(c: { tenantDbName: string; id: string }): string {
  return `${c.tenantDbName}:${c.id}`
}

export type { CampaignSendRecipientReport, SendStatus } from '~/types/campaign'

/** @deprecated Use `AdminCampaign` from this file. */
export type AdminCampaignSendRow = {
  tenantDbName: string
  tenantId: string | null
  tenantName: string
  campaignId: string
  campaignName: string
  status: string
  subject: string
  scheduledAt?: string
  createdAt: string
  updatedAt: string
  progress: {
    pending: number
    sent: number
    failed: number
    aborted: number
    total: number
    done: boolean
  } | null
}

export type AdminCampaignSendView = 'active' | 'history' | 'all'

export type AdminCampaignSendListResponse = {
  items: AdminCampaignSendRow[]
}

export type AdminCampaignSendRecipientReport = import('~/types/campaign').CampaignSendRecipientReport

export type { CampaignSendRecipientReportStatus } from '~/types/campaign'
