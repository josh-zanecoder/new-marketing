/**
 * CORS for CRM-hosted unsubscribe page (`fetch` with Accept: application/json).
 * When the CRM uses same-origin `/marketing-api` proxy, CORS is not needed.
 * Set `MARKETING_UNSUBSCRIBE_CORS_ORIGINS` when `VITE_MARKETING_API_URL` points at Marketing directly.
 */
function parseAllowedOrigins(): Set<string> {
  const raw = String(process.env.MARKETING_UNSUBSCRIBE_CORS_ORIGINS ?? '').trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  )
}

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/v1/unsubscribe')) return

  const allowed = parseAllowedOrigins()
  const origin = String(getHeader(event, 'origin') ?? '').trim()
  if (!origin || !allowed.has(origin)) return

  setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
  appendResponseHeader(event, 'Vary', 'Origin')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Accept, Content-Type')

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
