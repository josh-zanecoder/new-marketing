import { applyOneClickUnsubscribe } from '@server/utils/email/applyOneClickUnsubscribe'

/**
 * Gmail/Yahoo one-click unsubscribe (RFC 8058).
 * POST body is typically `List-Unsubscribe=One-Click`; the token is on the query string.
 */
export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '').trim()
  if (token) {
    try {
      await applyOneClickUnsubscribe(token)
    } catch {
      /* always 200 — do not leak token validity to mailbox providers */
    }
  }
  setResponseStatus(event, 200)
  return { ok: true }
})
