import {
  maskEmail,
  marketingSubscribedFromContact,
  resolveUnsubscribeContext,
  resolveUnsubscribeFailure,
  unsubscribeFailureCopy,
  wantsJsonResponse
} from '@server/utils/unsubscribeRequest'
import {
  unsubscribePreviewHtml,
  unsubscribeResultPayload,
  unsubscribeStatusHtml
} from '@server/utils/unsubscribeResponses'

export default defineEventHandler(async (event) => {
  const token = String(getQuery(event).token ?? '').trim()
  const json = wantsJsonResponse(event)

  if (!token) {
    const copy = unsubscribeFailureCopy('missing_token')
    if (json) {
      return unsubscribeResultPayload({
        ok: false,
        title: copy.title,
        message: copy.message
      })
    }
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return unsubscribeStatusHtml(copy.title, copy.message, false)
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
      return unsubscribePreviewHtml({
        token,
        emailMasked: '***',
        marketingSubscribed: true,
        errorTitle: copy.title,
        errorMessage: copy.message
      })
    }

    const marketing = marketingSubscribedFromContact(ctx.contact)
    const emailMasked = maskEmail(String(ctx.contact.email ?? ''))

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
