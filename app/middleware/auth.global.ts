import {
  ADMIN_PATH_PREFIX,
  PUBLIC_AUTH_PATHS,
  TENANT_PATH_PREFIX,
  TENANTS_PATH_PREFIX
} from '~/constants/authRoutes'

export default defineNuxtRouteMiddleware((to) => {
  const host = useTenantHostContext()
  if (to.path.startsWith(TENANTS_PATH_PREFIX)) {
    const nextPath = `${TENANT_PATH_PREFIX}${to.path.slice(TENANTS_PATH_PREFIX.length)}`
    return navigateTo(nextPath || '/tenant/dashboard')
  }
  if (host.isTenantHost && to.path.startsWith('/auth/admin-login')) return navigateTo('/auth/tenant-login')
  if (host.isAdminHost && to.path.startsWith('/auth/tenant-login')) return navigateTo('/auth/admin-login')
  if (host.isTenantHost && to.path.startsWith(ADMIN_PATH_PREFIX)) return navigateTo('/tenant/dashboard')
  if (host.isAdminHost && to.path.startsWith(TENANT_PATH_PREFIX)) return navigateTo('/admin/dashboard')
  if (PUBLIC_AUTH_PATHS.some((path) => to.path.startsWith(path))) return

  const token = useCookie<string | null>('marketing_token')
  if (!token.value) {
    return navigateTo(host.isTenantHost ? '/auth/tenant-login' : '/auth/admin-login')
  }
})
