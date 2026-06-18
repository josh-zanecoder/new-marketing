import { applyMarketingUnsubscribePreference } from '@server/utils/applyMarketingUnsubscribePreference'
import { resolveUnsubscribeContext, wantsJsonResponse } from '@server/utils/unsubscribeRequest'
import { unsubscribeStatusHtml } from '@server/utils/unsubscribeResponses'

function parseMarketingValue(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

function isConfirmed(raw: unknown): boolean {
  return (
    raw === true ||
    raw === 'true' ||
    raw === 'on' ||
    raw === 1 ||
    raw === '1'
  )
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
  const confirmed = isConfirmed(body?.confirm)

  if (!token) {
    if (json) {
      return {
        ok: false,
        title: 'Invalid link',
        message: 'This unsubscribe link is missing required parameters.'
      }
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
      return {
        ok: false,
        title: 'Invalid request',
        message: 'Marketing preference (true or false) is required.'
      }
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml('Invalid request', 'Marketing preference is required.', false)
  }

  if (!confirmed) {
    if (json) {
      return {
        ok: false,
        title: 'Confirmation required',
        message: 'Please confirm you want to update your email preferences.'
      }
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
      if (json) {
        return {
          ok: false,
          title: 'Invalid or expired link',
          message:
            'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.'
        }
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(
        'Invalid or expired link',
        'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.',
        false
      )
    }

    const result = await applyMarketingUnsubscribePreference({
      dbName: ctx.dbName,
      contactId: ctx.contactId,
      marketing
    })

    if (!result.ok) {
      if (json) {
        return {
          ok: false,
          title: 'Not found',
          message: 'We could not find this contact. You may already be unsubscribed.'
        }
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(
        'Not found',
        'We could not find this contact. You may already be unsubscribed.',
        false
      )
    }

    const successTitle = marketing ? 'Preferences saved' : 'You are unsubscribed'
    const successMessage = marketing
      ? 'You will continue to receive marketing emails from us at this address.'
      : 'You will no longer receive marketing emails from us at this address.'

    if (json) {
      return { ok: true, title: successTitle, message: successMessage, marketing }
    }

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(successTitle, successMessage, true)
  } catch {
    if (json) {
      return { ok: false, title: 'Something went wrong', message: 'Please try again later.' }
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml('Something went wrong', 'Please try again later.', false)
  }
})
