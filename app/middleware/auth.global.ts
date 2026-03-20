const PUBLIC_PATHS = ['/auth/login']

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_PATHS.some((path) => to.path.startsWith(path))) return

  const token = useCookie<string | null>('marketing_token')
  if (!token.value) {
    return navigateTo('/auth/login')
  }
})
