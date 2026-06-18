import {
  maskEmail,
  marketingSubscribedFromContact,
  resolveUnsubscribeContext,
  wantsJsonResponse
} from '@server/utils/unsubscribeRequest'
import {
  unsubscribePreviewHtml,
  unsubscribeStatusHtml
} from '@server/utils/unsubscribeResponses'

export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '').trim()

  if (!token) {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(
      'Invalid link',
      'This unsubscribe link is missing required parameters.',
      false
    )
  }

  if (token === 'preview') {
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
      if (wantsJsonResponse(event)) {
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

    const marketing = marketingSubscribedFromContact(ctx.contact)
    const emailMasked = maskEmail(String(ctx.contact.email ?? ''))

    if (wantsJsonResponse(event)) {
      return {
        ok: true,
        preview: true,
        title: 'Email preferences',
        message: 'Review your marketing email preferences below.',
        email: emailMasked,
        marketing
      }
    }

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribePreviewHtml({
      token,
      emailMasked,
      marketingSubscribed: marketing
    })
  } catch {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml('Something went wrong', 'Please try again later.', false)
  }
})
