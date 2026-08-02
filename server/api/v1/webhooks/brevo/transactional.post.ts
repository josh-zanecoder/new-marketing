import { timingSafeEqual } from 'node:crypto'
import { resolveBrevoWebhookSecret } from '@server/utils/brevo/resolveBrevoWebhookSecret'
import { applyBrevoTrackingWebhook, resolveTenantDbName } from '@server/utils/tracking/applyBrevoTrackingWebhook'
import { parseBrevoTransactionalWebhookPayload } from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'

const WEBHOOK_SECRET_HEADERS = [
  'x-brevo-webhook-secret',
  'x-brevo-signature',
  'x-brevo-signature-v2',
  'x-mailin-custom'
] as const

function normalizeSecret(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
}

function readBearerOrBasicSecret(event: Parameters<typeof getHeader>[0]): string {
  const auth = getHeader(event, 'authorization')?.trim() || ''
  if (!auth) return ''

  const bearer = /^Bearer\s+(.+)$/i.exec(auth)
  if (bearer?.[1]) return normalizeSecret(bearer[1])

  // Brevo "Basic" auth — treat password (or full user:pass) as the shared secret.
  const basic = /^Basic\s+(.+)$/i.exec(auth)
  if (basic?.[1]) {
    try {
      const decoded = Buffer.from(basic[1], 'base64').toString('utf8')
      const colon = decoded.indexOf(':')
      if (colon >= 0) {
        const password = decoded.slice(colon + 1)
        if (password) return normalizeSecret(password)
      }
      return normalizeSecret(decoded)
    } catch {
      return ''
    }
  }

  return ''
}

function readWebhookSecret(event: Parameters<typeof getHeader>[0]): string {
  for (const name of WEBHOOK_SECRET_HEADERS) {
    const v = getHeader(event, name)
    if (v?.trim()) return normalizeSecret(v)
  }
  return readBearerOrBasicSecret(event)
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Brevo transactional webhook → upsert into tenant `brevo_tracking_events`.
 *
 * Configure in Brevo → Transactional → Settings → Webhook:
 *   URL:  {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/brevo/transactional
 *   Auth: Brevo UI “Token” (Authorization: Bearer …), or custom header
 *         `x-brevo-webhook-secret`, matching the tenant webhook secret / env.
 *
 * Sends must include `db:{dbName}` and/or `tenant:{tenantId}` tags (Marketing already does).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = parseBrevoTransactionalWebhookPayload(body)
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Could not parse Brevo webhook payload'
    })
  }

  const dbName = await resolveTenantDbName(parsed)
  const expected = normalizeSecret(await resolveBrevoWebhookSecret(dbName))
  const got = readWebhookSecret(event)
  const allowUnsigned =
    String(process.env.BREVO_WEBHOOK_ALLOW_UNSIGNED || '').toLowerCase() === 'true'

  if (!expected) {
    if (!allowUnsigned) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Brevo webhook is not configured'
      })
    }
    console.warn('[brevo-webhook] auth bypassed (BREVO_WEBHOOK_ALLOW_UNSIGNED, no secret)')
  } else if (!got && allowUnsigned) {
    console.warn('[brevo-webhook] auth bypassed (BREVO_WEBHOOK_ALLOW_UNSIGNED)')
  } else if (!got || !secretsEqual(got, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const result = await applyBrevoTrackingWebhook(body)

  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      statusMessage: result.message
    })
  }

  setResponseStatus(event, 200)
  return {
    success: true,
    dbName: result.dbName,
    upserted: result.upserted,
    messageId: result.messageId,
    event: result.event
  }
})
