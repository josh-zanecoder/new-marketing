const SEND_CAMPAIGN_PREFIX = '/api/v1/tenant/send-campaign'

const ADMIN_PROXY_ALLOWED_SEND_POST = new Set([
  `${SEND_CAMPAIGN_PREFIX}/pause`,
  `${SEND_CAMPAIGN_PREFIX}/stop`,
  `${SEND_CAMPAIGN_PREFIX}/resume`,
  `${SEND_CAMPAIGN_PREFIX}/restart`,
  `${SEND_CAMPAIGN_PREFIX}/stop-all`
])

/** Superadmin tenant proxy: read + send control only (no campaign authoring or send initiation). */
export function adminTenantProxyBlocksRequest(method: string, path: string): boolean {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false

  const pathOnly = path.split('?')[0] ?? path

  if (pathOnly.startsWith('/api/v1/tenant/campaigns')) return true

  if (!pathOnly.startsWith(SEND_CAMPAIGN_PREFIX)) return false

  if (m === 'POST' && ADMIN_PROXY_ALLOWED_SEND_POST.has(pathOnly)) return false
  if (m === 'DELETE' && pathOnly.startsWith(`${SEND_CAMPAIGN_PREFIX}/schedule/`)) return false

  return true
}
