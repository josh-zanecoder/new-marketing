import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { BREVO_WEBHOOK_SECRET_HEADERS } from '@server/constants/brevoWebhookTask'
import { resolveBrevoWebhookSecret } from '@server/utils/brevo/resolveBrevoWebhookSecret'
import type { ParsedBrevoTransactionalWebhook } from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'

export type BrevoWebhookAuthResult =
  | { ok: true; dbName: string | null }
  | { ok: false; statusCode: number; message: string }

function normalizeSecret(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
}

function readBearerOrBasicSecret(event: H3Event): string {
  const auth = getHeader(event, 'authorization')?.trim() || ''
  if (!auth) return ''

  const bearer = /^Bearer\s+(.+)$/i.exec(auth)
  if (bearer?.[1]) return normalizeSecret(bearer[1])

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

export function readBrevoWebhookSecretFromEvent(event: H3Event): string {
  for (const name of BREVO_WEBHOOK_SECRET_HEADERS) {
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

export async function verifyBrevoWebhookRequestAuth(
  event: H3Event,
  dbName: string | null
): Promise<BrevoWebhookAuthResult> {
  const expected = normalizeSecret(await resolveBrevoWebhookSecret(dbName))
  const got = readBrevoWebhookSecretFromEvent(event)
  const allowUnsigned =
    String(process.env.BREVO_WEBHOOK_ALLOW_UNSIGNED || '').toLowerCase() === 'true'

  if (!expected) {
    if (!allowUnsigned) {
      return { ok: false, statusCode: 503, message: 'Brevo webhook is not configured' }
    }
    console.warn('[brevo-webhook] auth bypassed (BREVO_WEBHOOK_ALLOW_UNSIGNED, no secret)')
    return { ok: true, dbName }
  }

  if (!got && allowUnsigned) {
    console.warn('[brevo-webhook] auth bypassed (BREVO_WEBHOOK_ALLOW_UNSIGNED)')
    return { ok: true, dbName }
  }

  if (!got || !secretsEqual(got, expected)) {
    return { ok: false, statusCode: 401, message: 'Unauthorized' }
  }

  return { ok: true, dbName }
}

export type { ParsedBrevoTransactionalWebhook }
