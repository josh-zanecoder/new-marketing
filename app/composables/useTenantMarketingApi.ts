import type { SendStatus } from '~/types/campaign'
import type {
  TenantRecipientListDetailPayload,
  TenantRecipientListMemberRow,
  TenantRecipientListResourcePayload
} from '~/types/tenantContact'

/** Response from GET `/api/v1/tenant/campaigns/:id` */
export interface TenantCampaignDetail {
  id: string
  name: string
  sender: { name: string; email: string }
  recipientsType: 'manual' | 'list'
  recipientsListId?: string
  subject: string
  status: string
  /** ISO 8601 when status is `Scheduled` (or after reschedule). */
  scheduledAt?: string
  recipients: Array<{
    email: string
    contactId?: string
    name?: string
    status?: string
    sentAt?: string
    error?: string
  }>
  emailTemplate?: { name: string; html: string }
  templateHtml?: string | null
  mergeUserSnapshot?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** @deprecated Use `TenantRecipientListResourcePayload` from `~/types/tenantContact`. */
export type TenantRecipientListResponse = TenantRecipientListResourcePayload

/** @deprecated Use `TenantRecipientListMemberRow` from `~/types/tenantContact`. */
export type TenantRecipientListMemberItem = TenantRecipientListMemberRow

/** @deprecated Use `TenantRecipientListDetailPayload` from `~/types/tenantContact`. */
export type TenantRecipientListDetailResponse = TenantRecipientListDetailPayload

export interface TenantDynamicVariableItem {
  id?: string
  key: string
  label: string
  sourceType?: 'recipient' | 'user'
  scopes?: Array<'subject' | 'body'>
  enabled?: boolean
}

export interface TenantEmailTemplateRow {
  id: string
  name: string
  htmlTemplate: string
  subject?: string
}

export interface TenantDashboardStats {
  totalCampaigns: number
  sentThisMonth: number
  scheduledCampaigns: number
  recipientLists: number
  contacts: number
  /** Share of sends that reached `sent` vs `failed` (excludes `pending`). Null when none finished. */
  deliveryRatePercent: number | null
  emailsDeliveredTotal: number
  emailsFailedTotal: number
  emailsPendingTotal: number
}

export interface TenantDashboardRecentCampaign {
  id: string
  name: string
  subject: string
  status: string
  scheduledAt?: string
  updatedAt: string
}

export interface TenantDashboardResponse {
  stats: TenantDashboardStats
  statusBreakdown: Record<string, number>
  recentCampaigns: TenantDashboardRecentCampaign[]
}

export type EmailMergeContextBody =
  | { campaignId: string }
  | {
      recipientsType: 'manual' | 'list'
      recipientsListId?: string
      recipientsManual?: string[]
    }

/**
 * Tenant marketing API: SSR cookie forwarding + `credentials: 'include'` on the client.
 */
export function useTenantMarketingApi() {
  function serverAuthHeaders(): { headers?: HeadersInit } {
    if (!import.meta.server) return {}
    try {
      return { headers: useRequestHeaders(['cookie']) as HeadersInit }
    } catch {
      return {}
    }
  }

  function tenantFetchInit(init?: Record<string, unknown>): Record<string, unknown> {
    return {
      credentials: 'include' as RequestCredentials,
      ...serverAuthHeaders(),
      ...init
    }
  }

  async function fetchCampaignById(campaignId: string) {
    return $fetch<{ campaign: TenantCampaignDetail }>(
      `/api/v1/tenant/campaigns/${campaignId}`,
      tenantFetchInit()
    )
  }

  async function fetchEmailMergeContext(body: EmailMergeContextBody) {
    return $fetch<{ mergeRoot: Record<string, unknown> }>(
      '/api/v1/tenant/email/merge-context',
      tenantFetchInit({ method: 'POST', body })
    )
  }

  async function fetchEmailMergeContextOrEmpty(body: EmailMergeContextBody): Promise<Record<string, unknown>> {
    try {
      const r = await fetchEmailMergeContext(body)
      return r.mergeRoot ?? {}
    } catch {
      return {}
    }
  }

  async function fetchRecipientListResource() {
    return $fetch<TenantRecipientListResponse>('/api/v1/tenant/recipient-list', tenantFetchInit())
  }

  async function fetchRecipientListById(listId: string, opts?: { page?: number; limit?: number }) {
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50))
    const page = Math.max(1, opts?.page ?? 1)
    return $fetch<TenantRecipientListDetailResponse>(
      `/api/v1/tenant/recipient-list/${encodeURIComponent(listId)}`,
      tenantFetchInit({ query: { page, limit } })
    )
  }

  async function fetchDynamicVariables() {
    return $fetch<{ variables?: TenantDynamicVariableItem[] }>(
      '/api/v1/tenant/dynamic-variables',
      tenantFetchInit()
    )
  }

  async function fetchEmailTemplates() {
    return $fetch<{ templates: TenantEmailTemplateRow[] }>(
      '/api/v1/tenant/email-templates',
      tenantFetchInit()
    )
  }

  async function fetchTenantMe() {
    return $fetch<unknown>('/api/v1/tenant/me', tenantFetchInit())
  }

  async function fetchDashboard() {
    return $fetch<TenantDashboardResponse>('/api/v1/tenant/dashboard', tenantFetchInit())
  }

  async function fetchSendCampaignStatus(campaignId: string) {
    return $fetch<SendStatus>(`/api/v1/tenant/send-campaign/status/${campaignId}`, {
      timeout: 60000,
      ...tenantFetchInit()
    })
  }

  async function createCampaign(body: Record<string, unknown>) {
    return $fetch<{ id: string }>('/api/v1/tenant/campaigns', tenantFetchInit({ method: 'POST', body }))
  }

  async function updateCampaign(campaignId: string, body: Record<string, unknown>) {
    return $fetch(`/api/v1/tenant/campaigns/${campaignId}`, tenantFetchInit({ method: 'PUT', body }))
  }

  async function scheduleCampaignSend(campaignId: string, scheduledAt: string) {
    return $fetch<{ ok: boolean; campaignId: string; scheduledAt: string }>(
      '/api/v1/tenant/send-campaign/schedule',
      tenantFetchInit({
        method: 'POST',
        body: { campaignId, scheduledAt },
        timeout: 30000
      })
    )
  }

  async function unscheduleCampaignSend(campaignId: string) {
    return $fetch<{ ok: boolean; campaignId: string }>(
      `/api/v1/tenant/send-campaign/schedule/${campaignId}`,
      tenantFetchInit({ method: 'DELETE', timeout: 15000 })
    )
  }

  return {
    serverAuthHeaders,
    tenantFetchInit,
    fetchCampaignById,
    fetchEmailMergeContext,
    fetchEmailMergeContextOrEmpty,
    fetchRecipientListResource,
    fetchRecipientListById,
    fetchDynamicVariables,
    fetchEmailTemplates,
    fetchTenantMe,
    fetchDashboard,
    fetchSendCampaignStatus,
    createCampaign,
    updateCampaign,
    scheduleCampaignSend,
    unscheduleCampaignSend
  }
}
