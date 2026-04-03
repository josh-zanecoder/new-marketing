import type { SendStatus } from '~/types/campaign'

/** Response from GET `/api/v1/tenant/campaigns/:id` */
export interface TenantCampaignDetail {
  id: string
  name: string
  sender: { name: string; email: string }
  recipientsType: 'manual' | 'list'
  recipientsListId?: string
  subject: string
  status: string
  recipients: Array<{
    email: string
    contactId?: string
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

export interface TenantRecipientListResponse {
  lists?: Array<{ id: string; name: string }>
  contacts?: Array<{
    id: string
    name?: string
    email?: string
    company?: string
  }>
  contactsTruncated?: boolean
}

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

  return {
    serverAuthHeaders,
    tenantFetchInit,
    fetchCampaignById,
    fetchEmailMergeContext,
    fetchEmailMergeContextOrEmpty,
    fetchRecipientListResource,
    fetchDynamicVariables,
    fetchEmailTemplates,
    fetchTenantMe,
    fetchSendCampaignStatus,
    createCampaign,
    updateCampaign
  }
}
