import mongoose from 'mongoose'
import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { findRegistryTenantByDbName } from '@server/tenant/registry-auth'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { onContactUnsubscribed } from '@server/utils/contact/contactSubscriptionEffects'
import { verifyUnsubscribeToken } from '@server/utils/unsubscribeToken'

type UnsubscribePayload = { ok: boolean; title: string; message: string }

function wantsJsonResponse(event: H3Event): boolean {
  const accept = String(getHeader(event, 'accept') ?? '').toLowerCase()
  const format = String(getQuery(event).format ?? '').toLowerCase()
  return accept.includes('application/json') || format === 'json'
}

function respondUnsubscribe(event: H3Event, payload: UnsubscribePayload): UnsubscribePayload | string {
  if (wantsJsonResponse(event)) {
    setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
    return payload
  }
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return unsubscribeHtml(payload.title, payload.message, payload.ok)
}

function unsubscribeHtml(title: string, message: string, ok: boolean): string {
  const accent = ok ? '#059669' : '#b45309'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; }
    .card { max-width: 28rem; padding: 2rem 2.25rem; background: #fff; border-radius: 1rem; box-shadow: 0 10px 40px rgba(15,23,42,.08); border: 1px solid #e2e8f0; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .75rem; color: ${accent}; }
    p { margin: 0; line-height: 1.55; color: #475569; font-size: .9375rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}

export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '').trim()
  if (!token) {
    return respondUnsubscribe(event, {
      ok: false,
      title: 'Invalid link',
      message: 'This unsubscribe link is missing required parameters.'
    })
  }

  let payload: ReturnType<typeof verifyUnsubscribeToken> = null
  let dbName = ''
  let contactId = ''

  try {
    const registry = await getRegistryConnection()
    const peekDb = (() => {
      try {
        const dot = token.lastIndexOf('.')
        if (dot <= 0) return ''
        const p = token.slice(0, dot)
        const pad = '='.repeat((4 - (p.length % 4)) % 4)
        const json = JSON.parse(
          Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8')
        ) as { db?: string }
        return typeof json.db === 'string' ? json.db.trim() : ''
      } catch {
        return ''
      }
    })()

    if (peekDb) {
      const row = await findRegistryTenantByDbName(registry, peekDb)
      if (row?.clientKeyHash) {
        payload = verifyUnsubscribeToken(token, row.clientKeyHash)
        if (payload) {
          dbName = payload.db
          contactId = payload.c
        }
      }
    }

    if (!payload) {
      return respondUnsubscribe(event, {
        ok: false,
        title: 'Invalid or expired link',
        message:
          'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.'
      })
    }
  } catch {
    return respondUnsubscribe(event, {
      ok: false,
      title: 'Something went wrong',
      message: 'Please try again later.'
    })
  }

  if (!mongoose.isValidObjectId(contactId)) {
    return respondUnsubscribe(event, {
      ok: false,
      title: 'Invalid link',
      message: 'This unsubscribe link is not valid.'
    })
  }

  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    const { Contact } = getTenantClientModels(tenantConn)
    const oid = new mongoose.Types.ObjectId(contactId)

    const updated = await Contact.updateOne(
      { _id: oid, deletedAt: null },
      { $set: { isUnsubscribe: true } }
    )

    if (updated.matchedCount === 0) {
      return respondUnsubscribe(event, {
        ok: false,
        title: 'Not found',
        message: 'We could not find this contact. You may already be unsubscribed.'
      })
    }

    await onContactUnsubscribed(tenantConn, oid)

    return respondUnsubscribe(event, {
      ok: true,
      title: 'You are unsubscribed',
      message: 'You will no longer receive marketing emails from us at this address.'
    })
  } catch {
    return respondUnsubscribe(event, {
      ok: false,
      title: 'Something went wrong',
      message: 'Please try again later.'
    })
  }
})
