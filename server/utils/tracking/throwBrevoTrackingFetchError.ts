import { isBrevoRateLimitErrorMessage } from '@server/services/brevo.service'

/**
 * Map Brevo fetch failures to H3 errors.
 * Rate limits become 429 (not 502) so clients can retry without treating it as a hard failure.
 */
export function throwBrevoTrackingFetchError(error: string): never {
  console.error('[CampaignTracking] provider sync failed', { providerError: error })

  if (isBrevoRateLimitErrorMessage(error)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Tracking is temporarily busy. Please try again in a moment.',
      message: 'Tracking is temporarily busy. Please try again in a moment.'
    })
  }
  throw createError({
    statusCode: 502,
    message: 'We could not refresh campaign tracking right now. Please contact your administrator.'
  })
}
