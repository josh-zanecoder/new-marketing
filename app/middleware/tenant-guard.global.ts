export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/auth')) return
  if (import.meta.server) return
  const host = window.location.hostname || ''
  if (host === 'localhost' || host.startsWith('127.')) return
  const { isSuperAdminContext, hasTenantContext } = useTenant()
  if (to.path.startsWith('/admin') && hasTenantContext.value) return navigateTo('/tenant/dashboard')
  if (to.path.startsWith('/tenant') && isSuperAdminContext.value) return navigateTo('/admin/dashboard')
})
