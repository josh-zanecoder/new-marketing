import type {
  AdminCampaignSendRecipientReport,
  AdminCampaignSendRow,
  SendStatus
} from '~/types/adminCampaign'
import type { CampaignSendRecipientReportStatus } from '~/types/campaign'

function encDbName(dbName: string) {
  return encodeURIComponent(dbName)
}

function scheduleRemainingUntil(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = t - nowMs
  if (diff <= 0) return 'Send time reached'
  const minTotal = Math.floor(diff / 60000)
  const day = Math.floor(minTotal / 1440)
  const hr = Math.floor((minTotal % 1440) / 60)
  const min = minTotal % 60
  if (day >= 1) return `in ${day} day${day === 1 ? '' : 's'}`
  if (hr >= 1) return `in ${hr} hour${hr === 1 ? '' : 's'}${min > 0 ? ` ${min} min` : ''}`
  if (min >= 1) return `in ${min} min`
  return 'in less than a minute'
}

/** Card subtitle for admin campaigns list (mirrors tenant campaigns page). */
export function adminCampaignSubtitle(
  row: AdminCampaignSendRow,
  nowMs: number
): string {
  const tenant = row.tenantName ? `${row.tenantName} · ` : ''
  if (row.status === 'Scheduled' && row.scheduledAt) {
    const d = new Date(row.scheduledAt)
    if (Number.isNaN(d.getTime())) return `${tenant}Scheduled`
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const when = `Sending ${md} • ${t}`
    const rem = scheduleRemainingUntil(row.scheduledAt, nowMs)
    return tenant + (rem && rem !== 'Send time reached' ? `${when} • ${rem}` : when)
  }
  if (row.status === 'Sending') {
    const p = row.progress
    if (p && p.total > 0) {
      return `${tenant}Sending in progress · ${p.sent + p.failed + p.aborted} of ${p.total}`
    }
    return `${tenant}Sending in progress`
  }
  if (row.status === 'Paused') return `${tenant}Paused — resume pending recipients or send again to everyone`
  if (row.status === 'Stopped') {
    return `${tenant}Stopped — resume pending recipients or send again to everyone`
  }
  if (row.status === 'Sent') {
    const raw = row.updatedAt || row.createdAt
    if (!raw) return `${tenant}Sent`
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${tenant}Sent ${md}`
  }
  if (row.status === 'Failed') {
    const raw = row.updatedAt || row.createdAt
    if (!raw) return `${tenant}Failed`
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${tenant}Failed ${md}`
  }
  return tenant + row.status
}

export function useAdminCampaignsApi() {
  async function fetchCampaignDetail(dbName: string, campaignId: string) {
    return $fetch<{ campaign: import('~/composables/useTenantMarketingApi').TenantCampaignDetail }>(
      `/api/v1/admin/campaigns/${encDbName(dbName)}/${encodeURIComponent(campaignId)}`
    )
  }

  async function fetchCampaigns(params?: {
    tenantDbName?: string
    search?: string
    status?: string
  }) {
    return $fetch<{ campaigns: import('~/types/adminCampaign').AdminCampaign[] }>(
      '/api/v1/admin/campaigns',
      {
        query: {
          tenantDbName: params?.tenantDbName || undefined,
          search: params?.search || undefined,
          status: params?.status || undefined
        }
      }
    )
  }

  async function stopAllCampaignSendsGlobal() {
    return $fetch('/api/v1/admin/campaigns/stop-all', { method: 'POST' })
  }

  async function fetchSendStatus(dbName: string, campaignId: string): Promise<SendStatus> {
    return $fetch(
      `/api/v1/admin/campaigns/${encDbName(dbName)}/${encodeURIComponent(campaignId)}/status`
    )
  }

  async function fetchSendRecipients(
    dbName: string,
    campaignId: string,
    params?: {
      status?: CampaignSendRecipientReportStatus
      page?: number
      limit?: number
      search?: string
    }
  ): Promise<AdminCampaignSendRecipientReport> {
    return $fetch(
      `/api/v1/admin/campaigns/${encDbName(dbName)}/${encodeURIComponent(campaignId)}/recipients`,
      {
        query: {
          status: params?.status ?? 'all',
          page: params?.page ?? 1,
          limit: params?.limit ?? 50,
          search: params?.search || undefined
        }
      }
    )
  }

  async function pauseCampaignSend(dbName: string, campaignId: string) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/pause`, {
      method: 'POST',
      body: { campaignId }
    })
  }

  async function stopCampaignSend(dbName: string, campaignId: string) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/stop`, {
      method: 'POST',
      body: { campaignId }
    })
  }

  async function stopAllTenantCampaignSends(dbName: string) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/stop-all`, {
      method: 'POST'
    })
  }

  async function resumeCampaignSend(dbName: string, campaignId: string) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/resume`, {
      method: 'POST',
      body: { campaignId }
    })
  }

  async function restartCampaignSend(dbName: string, campaignId: string) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/restart`, {
      method: 'POST',
      body: { campaignId }
    })
  }

  async function abortCampaignRecipients(
    dbName: string,
    campaignId: string,
    emails: string[]
  ) {
    return $fetch(`/api/v1/admin/campaigns/${encDbName(dbName)}/recipients/abort`, {
      method: 'POST',
      body: { campaignId, emails }
    })
  }

  return {
    fetchCampaigns,
    fetchCampaignDetail,
    stopAllCampaignSendsGlobal,
    fetchSendStatus,
    fetchSendRecipients,
    pauseCampaignSend,
    stopCampaignSend,
    stopAllTenantCampaignSends,
    resumeCampaignSend,
    restartCampaignSend,
    abortCampaignRecipients
  }
}

export function canAdminPauseSend(status: string) {
  return status === 'Sending'
}

export function canAdminStopSend(status: string) {
  return status === 'Sending'
}

export function canAdminResumeSend(status: string) {
  return status === 'Paused' || status === 'Stopped'
}

export function adminCampaignStatusBadgeClass(status: string): string {
  if (status === 'Draft') return 'bg-amber-50 text-amber-700 ring-amber-200/80'
  if (status === 'Scheduled' || status === 'Sending') {
    return 'bg-sky-50 text-sky-700 ring-sky-200/80'
  }
  if (status === 'Paused') return 'bg-violet-50 text-violet-700 ring-violet-200/80'
  if (status === 'Stopped') return 'bg-orange-50 text-orange-700 ring-orange-200/80'
  if (status === 'Sent') return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
  if (status === 'Failed') return 'bg-red-50 text-red-700 ring-red-200/80'
  return 'bg-slate-100 text-slate-600 ring-slate-200/80'
}
