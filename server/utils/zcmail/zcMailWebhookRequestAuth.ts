import { createHmac, timingSafeEqual } from 'node:crypto'
import { ZC_MAIL_WEBHOOK_SIGNATURE_HEADER } from '@server/constants/zcMailWebhook'
import { resolveZcMailWebhookSecret } from '@server/utils/zcmail/resolveZcMailWebhookSecret'

export type ZcMailWebhookAuthResult =
  | { ok: true }
  | { ok: false; statusCode: number; message: string }

export function verifyZcMailSignature(
  rawBody: string,
  headerValue: string,
  secret: string
): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const got = String(headerValue || '').trim()
  if (!got || got.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Verify HMAC `X-ZC-Mail-Signature` using per-tenant secret (or env fallback).
 * Local only: `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED=true` skips the check.
 */
export async function verifyZcMailWebhookRequestAuth(params: {
  rawBody: string
  signatureHeader: string
  dbName: string | null
}): Promise<ZcMailWebhookAuthResult> {
  const expectedSecret = await resolveZcMailWebhookSecret(params.dbName)
  const allowUnsigned =
    String(process.env.ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED || '').toLowerCase() === 'true'

  if (!expectedSecret) {
    if (!allowUnsigned) {
      return { ok: false, statusCode: 503, message: 'zcMail webhook is not configured' }
    }
    console.warn('[zcMail-webhook] auth bypassed (ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED, no secret)')
    return { ok: true }
  }

  if (!params.signatureHeader.trim() && allowUnsigned) {
    console.warn('[zcMail-webhook] auth bypassed (ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED)')
    return { ok: true }
  }

  if (!verifyZcMailSignature(params.rawBody, params.signatureHeader, expectedSecret)) {
    return { ok: false, statusCode: 401, message: 'Invalid webhook signature' }
  }

  return { ok: true }
}

export { ZC_MAIL_WEBHOOK_SIGNATURE_HEADER }
