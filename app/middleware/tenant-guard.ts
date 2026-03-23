export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isSuperAdminContext, hasTenantContext } = useTenant()
  const isAdminRoute = to.path.startsWith('/admin')
  const isTenantRoute = to.path.startsWith('/tenant')
  const isAuthRoute = to.path.startsWith('/auth')

  if (isAuthRoute) return

  const host = window.location?.hostname || ''
  const isPlainLocalhost = host === 'localhost' || host.startsWith('127.')

  if (isPlainLocalhost) return

  if (isAdminRoute && hasTenantContext.value) {
    return navigateTo('/tenant/dashboard')
  }

  if (isTenantRoute && isSuperAdminContext.value) {
    return navigateTo('/admin/dashboard')
  }
})
