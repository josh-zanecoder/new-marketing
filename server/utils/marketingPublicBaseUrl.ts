/** Public marketing app origin (no trailing slash). */
export function getMarketingPublicBaseUrl(): string {
  let fromConfig = ''
  try {
    const config = useRuntimeConfig()
    fromConfig = String(config.public.marketingBaseUrl ?? '').trim()
  } catch {
    fromConfig = ''
  }
  const fromEnv = (
    process.env.NUXT_PUBLIC_MARKETING_BASE_URL ||
    process.env.MARKETING_PUBLIC_BASE_URL ||
    ''
  ).trim()
  // Prefer runtime config when set; always fall through to env (Cloud Run / workers
  // often bake an empty NUXT_PUBLIC_ value at build time).
  return (fromConfig || fromEnv).replace(/\/$/, '')
}
