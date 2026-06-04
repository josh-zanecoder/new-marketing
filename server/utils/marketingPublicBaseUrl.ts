/** Public marketing app origin (no trailing slash). Source: `runtimeConfig.public.marketingBaseUrl` in nuxt.config. */
export function getMarketingPublicBaseUrl(): string {
  let raw = ''
  try {
    const config = useRuntimeConfig()
    raw = String(config.public.marketingBaseUrl ?? '')
  } catch {
    raw =
      process.env.NUXT_PUBLIC_MARKETING_BASE_URL ||
      process.env.MARKETING_PUBLIC_BASE_URL ||
      ''
  }
  return raw.trim().replace(/\/$/, '')
}
