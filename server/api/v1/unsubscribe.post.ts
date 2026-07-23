import { applyMarketingUnsubscribePreference } from '@server/utils/applyMarketingUnsubscribePreference'
import {
  resolveUnsubscribeContext,
  resolveUnsubscribeFailure,
  unsubscribeFailureCopy,
  wantsJsonResponse
} from '@server/utils/unsubscribeRequest'
import {
  unsubscribeResultPayload,
  unsubscribeStatusHtml
} from '@server/utils/unsubscribeResponses'
import {
  claimUnsubscribeTokenResponse,
  releaseUnsubscribeTokenClaim,
  unsubscribePreferenceCopy
} from '@server/utils/unsubscribeTokenResponse'

function parseMarketingValue(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

export default defineEventHandler(async (event) => {
  const json = wantsJsonResponse(event)
  const body = (await readBody(event).catch(() => null)) as {
    token?: unknown
    marketing?: unknown
    confirm?: unknown
  } | null

  const token = String(body?.token ?? '').trim()
  const marketing = parseMarketingValue(body?.marketing)
  const confirmed =
    body?.confirm === true ||
    body?.confirm === 'true' ||
    body?.confirm === 'on' ||
    body?.confirm === 1 ||
    body?.confirm === '1'

  if (!token) {
    if (json) {
      return unsubscribeResultPayload({
        ok: false,
        title: 'Invalid link',
        message: 'This unsubscribe link is missing required parameters.'
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(
      'Invalid link',
      'This unsubscribe link is missing required parameters.',
      false
    )
  }

  if (marketing === null) {
    if (json) {
      return unsubscribeResultPayload({
        ok: false,
        title: 'Invalid request',
        message: 'Marketing preference (true or false) is required.'
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(
      'Invalid request',
      'Marketing preference is required.',
      false
    )
  }

  if (!confirmed) {
    if (json) {
      return unsubscribeResultPayload({
        ok: false,
        title: 'Confirmation required',
        message: 'Please confirm you want to update your email preferences.'
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(
      'Confirmation required',
      'Please confirm you want to update your email preferences.',
      false
    )
  }

  try {
    const ctx = await resolveUnsubscribeContext(token)
    if (!ctx) {
      const reason = await resolveUnsubscribeFailure(token)
      const copy = unsubscribeFailureCopy(reason)
      if (json) {
        return unsubscribeResultPayload({
          ok: false,
          title: copy.title,
          message: copy.message,
          reason
        })
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(copy.title, copy.message, false)
    }

    const claim = await claimUnsubscribeTokenResponse({
      dbName: ctx.dbName,
      token,
      contactId: ctx.contactId,
      marketing
    })

    if (!claim.claimed) {
      const copy = unsubscribePreferenceCopy(claim.response.marketing)
      if (json) {
        return unsubscribeResultPayload({
          ok: true,
          alreadyUsed: true,
          title: copy.title,
          message: copy.message,
          marketing: claim.response.marketing
        })
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(copy.title, copy.message, true)
    }

    const result = await applyMarketingUnsubscribePreference({
      dbName: ctx.dbName,
      contactId: ctx.contactId,
      marketing
    })

    if (!result.ok) {
      await releaseUnsubscribeTokenClaim({ dbName: ctx.dbName, token }).catch(() => {})
      if (json) {
        return unsubscribeResultPayload({
          ok: false,
          title: 'Not found',
          message: 'We could not find this contact. You may already be unsubscribed.'
        })
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(
        'Not found',
        'We could not find this contact. You may already be unsubscribed.',
        false
      )
    }

    const copy = unsubscribePreferenceCopy(marketing)

    if (json) {
      return unsubscribeResultPayload({
        ok: true,
        title: copy.title,
        message: copy.message,
        marketing
      })
    }

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(copy.title, copy.message, true)
  } catch {
    if (json) {
      return unsubscribeResultPayload({
        ok: false,
        title: 'Something went wrong',
        message: 'Please try again later.'
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml('Something went wrong', 'Please try again later.', false)
  }
})
