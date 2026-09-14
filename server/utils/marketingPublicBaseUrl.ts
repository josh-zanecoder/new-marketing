/** Public marketing app origin (no trailing slash). Same env order as Cloud Tasks. */
export function getMarketingPublicBaseUrl(): string {
  const raw =
    env('MARKETING_PUBLIC_BASE_URL') ||
    env('NUXT_PUBLIC_MARKETING_BASE_URL') ||
    env('MARKETING_APP_URL') ||
    runtimeMarketingBaseUrl()
  return raw.replace(/\/$/, '')
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function runtimeMarketingBaseUrl(): string {
  try {
    return String(useRuntimeConfig().public.marketingBaseUrl ?? '').trim()
  } catch {
    return ''
  }
}
