export default defineEventHandler((event) => {
  const opts = { path: '/' as const }
  for (const name of [
    'marketing_tenant_session',
    'marketing_tenant_api_key',
    'marketing_tenant_bridge'
  ] as const) {
    deleteCookie(event, name, opts)
  }
  return { ok: true as const }
})
