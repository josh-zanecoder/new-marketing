import { createHmac, timingSafeEqual } from 'node:crypto'
import { ZC_MAIL_WEBHOOK_SIGNATURE_HEADER } from '@server/constants/zcMailWebhook'
import { applyBrevoTrackingWebhook } from '@server/utils/tracking/applyBrevoTrackingWebhook'
import {
  parseZcMailEmailStatusWebhookPayload,
  zcMailWebhookToBrevoBody
} from '@server/utils/tracking/parseZcMailEmailStatusWebhookPayload'
import { findDbNameByMessageId } from '@server/utils/zcmail/emailMessageRouting'
import {
  resolveDbNameFromBrevoTags,
  resolveTenantIdFromBrevoTags
} from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'
import { getRegistryConnection } from '@server/lib/mongoose'
import { findRegistryTenantByTenantId } from '@server/tenant/registry-auth'

function verifyZcMailSignature(rawBody: string, headerValue: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const got = String(headerValue || '').trim()
  if (!got || got.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  } catch {
    return false
  }
}

function webhookSecretFromEnv(): string {
  return String(process.env.ZC_MAIL_WEBHOOK_SECRET || '').trim()
}

/**
 * zcMail `email.status` webhook → tenant `brevo_tracking_events` (same store as Brevo).
 *
 * Configure zcMail tenant webhookUrl:
 *   POST {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/zc-mail/email-status
 *
 * Auth: HMAC `X-ZC-Mail-Signature: sha256=…` with `ZC_MAIL_WEBHOOK_SECRET`,
 * or `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED=true` for local only.
 */
export default defineEventHandler(async (event) => {
  const expectedSecret = webhookSecretFromEnv()
  const allowUnsigned =
    String(process.env.ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED || '').toLowerCase() === 'true'

  if (!expectedSecret && !allowUnsigned) {
    throw createError({
      statusCode: 503,
      statusMessage: 'zcMail webhook is not configured'
    })
  }

  const rawBody = (await readRawBody(event)) ?? ''
  if (expectedSecret) {
    const signature = getHeader(event, ZC_MAIL_WEBHOOK_SIGNATURE_HEADER) || ''
    const bodyForSig = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    if (!verifyZcMailSignature(bodyForSig, signature, expectedSecret)) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid webhook signature' })
    }
  }

  let body: unknown
  try {
    const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    body = text ? JSON.parse(text) : await readBody(event)
  } catch {
    body = await readBody(event)
  }

  const parsed = parseZcMailEmailStatusWebhookPayload(body)
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unrecognized zcMail webhook payload'
    })
  }

  let dbName = resolveDbNameFromBrevoTags(parsed.tags)
  if (!dbName) {
    const tenantId = resolveTenantIdFromBrevoTags(parsed.tags)
    if (tenantId) {
      const registry = await getRegistryConnection()
      const row = await findRegistryTenantByTenantId(registry, tenantId)
      dbName = row?.dbName?.trim() || null
    }
  }
  if (!dbName) {
    dbName = await findDbNameByMessageId(parsed.messageId)
  }
  if (!dbName) {
    console.warn('[zcMail-webhook] no tenant for message id', {
      messageId: parsed.messageId,
      event: parsed.event
    })
    setResponseStatus(event, 202)
    return { accepted: true, updated: 0 }
  }

  const brevoBody = zcMailWebhookToBrevoBody(parsed)
  if (!resolveDbNameFromBrevoTags(parsed.tags)) {
    brevoBody.tags = [...parsed.tags, `db:${dbName}`]
  }

  const result = await applyBrevoTrackingWebhook(brevoBody)
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      statusMessage: result.message
    })
  }

  setResponseStatus(event, 200)
  return {
    success: true,
    accepted: true,
    dbName: result.dbName,
    upserted: result.upserted,
    messageId: result.messageId,
    event: result.event
  }
})
