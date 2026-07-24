import {
  maskEmail,
  marketingSubscribedFromContact,
  resolveUnsubscribeContext,
  wantsJsonResponse
} from '@server/utils/unsubscribeRequest'
import {
  unsubscribePreviewHtml,
  unsubscribeResultPayload,
  unsubscribeStatusHtml
} from '@server/utils/unsubscribeResponses'
import {
  findUnsubscribeTokenResponse,
  unsubscribePreferenceCopy
} from '@server/utils/unsubscribeTokenResponse'

export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '').trim()
  const json = wantsJsonResponse(event)

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

  if (token === 'preview') {
    if (json) {
      return unsubscribeResultPayload({
        ok: true,
        preview: true,
        title: 'Email preferences',
        message: 'Review your marketing email preferences below.',
        email: 'j***@example.com',
        marketing: true
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribePreviewHtml({
      token: 'preview',
      emailMasked: 'j***@example.com',
      marketingSubscribed: true
    })
  }

  try {
    const ctx = await resolveUnsubscribeContext(token)
    if (!ctx) {
      if (json) {
        return unsubscribeResultPayload({
          ok: false,
          title: 'Invalid or expired link',
          message:
            'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.'
        })
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(
        'Invalid or expired link',
        'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.',
        false
      )
    }

    const emailMasked = maskEmail(String(ctx.contact.email ?? ''))
    const prior = await findUnsubscribeTokenResponse({ dbName: ctx.dbName, token })
    if (prior) {
      const copy = unsubscribePreferenceCopy(prior.marketing)
      if (json) {
        return unsubscribeResultPayload({
          ok: true,
          preview: true,
          alreadyUsed: true,
          title: copy.title,
          message: copy.message,
          email: emailMasked,
          marketing: prior.marketing
        })
      }
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return unsubscribeStatusHtml(copy.title, copy.message, true)
    }

    const marketing = marketingSubscribedFromContact(ctx.contact)

    if (json) {
      return unsubscribeResultPayload({
        ok: true,
        preview: true,
        title: 'Email preferences',
        message: 'Review your marketing email preferences below.',
        email: emailMasked,
        marketing
      })
    }

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribePreviewHtml({
      token,
      emailMasked,
      marketingSubscribed: marketing
    })
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
