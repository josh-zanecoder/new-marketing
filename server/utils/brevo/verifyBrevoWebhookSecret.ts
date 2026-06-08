import type { H3Event } from 'h3'

export const BREVO_WEBHOOK_SECRET_HEADER = 'x-brevo-webhook-secret'

function normalizeSecret(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
}

function bearerTokenFromEvent(event: H3Event): string {
  const authorization = getHeader(event, 'authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return ''
  return normalizeSecret(authorization.slice(7))
}

function secretFromEvent(event: H3Event): string {
  const headerName =
    (getHeader(event, BREVO_WEBHOOK_SECRET_HEADER) && BREVO_WEBHOOK_SECRET_HEADER) ||
    (getHeader(event, 'x-brevo-signature') && 'x-brevo-signature') ||
    (getHeader(event, 'x-brevo-signature-v2') && 'x-brevo-signature-v2') ||
    (getHeader(event, 'x-mailin-custom') && 'x-mailin-custom') ||
    null

  if (headerName) {
    return normalizeSecret(getHeader(event, headerName) || '')
  }

  // Brevo outbound webhook "Token" auth sends Authorization: Bearer <token>.
  return bearerTokenFromEvent(event)
}

export function verifyBrevoWebhookSecret(event: H3Event): { ok: true } | { ok: false; statusCode: number; message: string } {
  const config = useRuntimeConfig()
  const expected = normalizeSecret(config.brevoWebhookSecret)
  if (!expected) {
    return { ok: false, statusCode: 503, message: 'Brevo webhook is not configured' }
  }

  const got = secretFromEvent(event)
  const allowUnsigned = config.brevoWebhookAllowUnsigned === true

  if (!got && allowUnsigned) {
    return { ok: true }
  }
  if (got !== expected) {
    return { ok: false, statusCode: 401, message: 'Unauthorized' }
  }
  return { ok: true }
}
