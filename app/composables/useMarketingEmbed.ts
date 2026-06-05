import { marketingTenantHandoffCookieBase } from '~~/shared/marketingTenantHandoffCookies'

/** True when Marketing runs inside a parent frame (e.g. CRM embed). */
export function isMarketingEmbedded(): boolean {
  if (!import.meta.client) return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function cookieHeaderHasCrmEmbed(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false
  return /(?:^|;\s*)marketing_crm_embed=1(?:\s*;|$)/.test(cookieHeader)
}

/** CRM iframe / handoff embed — works during SSR (cookie + Sec-Fetch-Dest) and on client. */
export function isCrmEmbedSession(): boolean {
  const embedCookie = useCookie<string | null>(
    'marketing_crm_embed',
    marketingTenantHandoffCookieBase()
  )
  if (embedCookie.value === '1') return true

  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie', 'sec-fetch-dest'])
    if (cookieHeaderHasCrmEmbed(typeof headers.cookie === 'string' ? headers.cookie : undefined)) {
      return true
    }
    return headers['sec-fetch-dest'] === 'iframe'
  }

  return isMarketingEmbedded()
}

export function marketingEmbedAuthFallbackPath(): string {
  return isCrmEmbedSession() ? '/auth/tenant-session-expired' : '/auth/login'
}

export function redirectToMarketingEmbedAuthFallback(): void {
  if (!import.meta.client) return
  const path = marketingEmbedAuthFallbackPath()
  if (path === '/auth/login') {
    void navigateTo(path)
    return
  }
  window.location.replace(`${window.location.origin}${path}`)
}

export const MARKETING_SESSION_EXPIRED_MESSAGE = 'marketing:session-expired' as const

/** Let the reconnect screen render before asking CRM to start a new handoff. */
export const MARKETING_SESSION_EXPIRED_NOTIFY_DELAY_MS = 0

export function notifyParentMarketingSessionExpired(): void {
  if (!import.meta.client || !isCrmEmbedSession()) return
  window.setTimeout(() => {
    try {
      window.parent.postMessage({ type: MARKETING_SESSION_EXPIRED_MESSAGE }, '*')
    } catch {
      /* ignore */
    }
  }, MARKETING_SESSION_EXPIRED_NOTIFY_DELAY_MS)
}
