import mongoose from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { findRegistryTenantByDbName } from '@server/tenant/registry-auth'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { verifyUnsubscribeToken } from '@server/utils/unsubscribeToken'

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
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeHtml(
      'Invalid link',
      'This unsubscribe link is missing required parameters.',
      false
    )
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
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeHtml(
        'Invalid or expired link',
        'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.',
        false
      )
    }
  } catch {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeHtml('Something went wrong', 'Please try again later.', false)
  }

  if (!mongoose.isValidObjectId(contactId)) {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeHtml('Invalid link', 'This unsubscribe link is not valid.', false)
  }

  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    const { Contact, RecipientListMember } = getTenantClientModels(tenantConn)
    const oid = new mongoose.Types.ObjectId(contactId)

    const updated = await Contact.updateOne(
      { _id: oid, deletedAt: null },
      { $set: { isUnsubscribe: true } }
    )

    if (updated.matchedCount === 0) {
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeHtml(
        'Not found',
        'We could not find this contact. You may already be unsubscribed.',
        false
      )
    }

    await RecipientListMember.deleteMany({ contactId: oid })

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeHtml(
      'You are unsubscribed',
      'You will no longer receive marketing emails from us at this address.',
      true
    )
  } catch {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeHtml('Something went wrong', 'Please try again later.', false)
  }
})
