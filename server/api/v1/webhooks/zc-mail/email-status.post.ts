import { ZC_MAIL_WEBHOOK_SIGNATURE_HEADER } from '@server/constants/zcMailWebhook'
import { applyBrevoTrackingWebhook } from '@server/utils/tracking/applyBrevoTrackingWebhook'
import {
  parseZcMailEmailStatusWebhookPayload,
  zcMailWebhookToBrevoBody
} from '@server/utils/tracking/parseZcMailEmailStatusWebhookPayload'
import { findDbNameByMessageId, findEmailMessageRoutingMap } from '@server/utils/zcmail/emailMessageRouting'
import {
  resolveDbNameFromBrevoTags,
  resolveTenantIdFromBrevoTags
} from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'
import { getRegistryConnection } from '@server/lib/mongoose'
import { findRegistryTenantByTenantId } from '@server/tenant/registry-auth'
import { verifyZcMailWebhookRequestAuth } from '@server/utils/zcmail/zcMailWebhookRequestAuth'

/**
 * zcMail `email.status` webhook → tenant `brevo_tracking_events` (same store as Brevo).
 *
 * Configure zcMail tenant webhookUrl:
 *   POST {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/zc-mail/email-status
 *
 * Auth: HMAC `X-ZC-Mail-Signature: sha256=…` with per-tenant `clients.zcMailWebhookSecret`
 * (Admin → Tenants) or env `ZC_MAIL_WEBHOOK_SECRET`, or `ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED=true`
 * for local only.
 */
export default defineEventHandler(async (event) => {
  const rawBodyBuf = (await readRawBody(event)) ?? ''
  const rawBody = typeof rawBodyBuf === 'string' ? rawBodyBuf : rawBodyBuf.toString('utf8')

  let body: unknown
  try {
    body = rawBody ? JSON.parse(rawBody) : await readBody(event)
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

  const auth = await verifyZcMailWebhookRequestAuth({
    rawBody,
    signatureHeader: getHeader(event, ZC_MAIL_WEBHOOK_SIGNATURE_HEADER) || '',
    dbName
  })
  if (!auth.ok) {
    throw createError({ statusCode: auth.statusCode, statusMessage: auth.message })
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
  const tags = [...(brevoBody.tags || [])]
  if (!resolveDbNameFromBrevoTags(parsed.tags)) {
    tags.push(`db:${dbName}`)
  }
  const hasUserTag = tags.some((t) => String(t).toLowerCase().startsWith('user:'))
  if (!hasUserTag) {
    try {
      const routing = await findEmailMessageRoutingMap([parsed.messageId])
      const hit =
        routing.get(parsed.messageId) ||
        routing.get(parsed.messageId.replace(/^<|>$/g, '')) ||
        null
      if (hit?.userEmail) tags.push(`user:${hit.userEmail}`)
    } catch {
      // optional enrichment
    }
  }
  brevoBody.tags = tags

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
