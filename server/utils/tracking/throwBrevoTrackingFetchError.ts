import { isBrevoRateLimitErrorMessage } from '@server/services/brevo.service'

/**
 * Map Brevo fetch failures to H3 errors.
 * Rate limits become 429 (not 502) so clients can retry without treating it as a hard failure.
 */
export function throwBrevoTrackingFetchError(error: string): never {
  if (isBrevoRateLimitErrorMessage(error)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Brevo rate limit — please retry in a moment',
      message: error
    })
  }
  throw createError({ statusCode: 502, statusMessage: error })
}
