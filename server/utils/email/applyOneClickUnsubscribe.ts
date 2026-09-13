import { applyMarketingUnsubscribePreference } from '@server/utils/applyMarketingUnsubscribePreference'
import { resolveUnsubscribeContext } from '@server/utils/unsubscribeRequest'
import {
  claimUnsubscribeTokenResponse,
  releaseUnsubscribeTokenClaim
} from '@server/utils/unsubscribeTokenResponse'

/**
 * RFC 8058 one-click: unsubscribe immediately. Invalid tokens are ignored
 * so mailbox providers always receive 200.
 */
export async function applyOneClickUnsubscribe(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) return

  const ctx = await resolveUnsubscribeContext(trimmed)
  if (!ctx) return
  if (ctx.contact.isUnsubscribe === true) return

  const claim = await claimUnsubscribeTokenResponse({
    dbName: ctx.dbName,
    token: trimmed,
    contactId: ctx.contactId,
    marketing: false
  })
  if (!claim.claimed) return

  const result = await applyMarketingUnsubscribePreference({
    dbName: ctx.dbName,
    contactId: ctx.contactId,
    marketing: false
  })
  if (!result.ok) {
    await releaseUnsubscribeTokenClaim({ dbName: ctx.dbName, token: trimmed }).catch(() => {})
  }
}
