import { marketingTenantHandoffCookieBase } from '~~/shared/marketingTenantHandoffCookies'

export default defineEventHandler((event) => {
  const opts = marketingTenantHandoffCookieBase()
  for (const name of [
    'marketing_tenant_session',
    'marketing_tenant_api_key',
    'marketing_tenant_bridge'
  ] as const) {
    deleteCookie(event, name, opts)
  }
  return { ok: true as const }
})
