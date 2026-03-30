const PUBLIC_PATHS = ['/auth/login', '/auth/tenant-callback']

function cookieHeaderAllowsTenantSession(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false
  if (cookieHeader.includes('marketing_tenant_session=')) return true
  return /(?:^|;\s*)marketing_tenant_bridge=1(?:\s*;|$)/.test(cookieHeader)
}

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_PATHS.some((path) => to.path.startsWith(path))) return

  const token = useCookie<string | null>('marketing_token')
  const tenantBridge = useCookie<string | null>('marketing_tenant_bridge')
  if (token.value || tenantBridge.value === '1') return

  if (import.meta.server) {
    const raw = useRequestHeaders(['cookie']).cookie
    if (cookieHeaderAllowsTenantSession(typeof raw === 'string' ? raw : undefined)) return
    if (
      typeof raw === 'string' &&
      raw.includes('marketing_token=')
    ) {
      return
    }
  }

  return navigateTo('/auth/login')
})
