/** OpenAPI `from` is a string; use `Name <email>` when a display name is present. */
export function formatZcMailFromAddress(email: string, name?: string | null): string {
  const addr = email.trim()
  const display = (name || '').trim()
  if (!display) return addr
  const safeName = display.replace(/[\r\n<>"]/g, '')
  return `${safeName} <${addr}>`
}

export function normalizeZcMailBaseUrl(raw: string | null | undefined): string | null {
  const trimmed = String(raw || '')
    .trim()
    .replace(/\/+$/, '')
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw createError({ statusCode: 400, message: 'zcMail base URL must be a valid absolute URL' })
  }
  if (parsed.hostname === '0.0.0.0') {
    throw createError({
      statusCode: 400,
      message:
        'zcMail base URL must be a reachable host (not 0.0.0.0). Use http://host.docker.internal:3003 when Marketing runs in Docker and zcMail is on the host, or http://127.0.0.1:3003 when both run on the host.'
    })
  }
  return trimmed
}
