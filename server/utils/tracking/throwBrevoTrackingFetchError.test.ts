import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(() => {
  vi.stubGlobal(
    'createError',
    (input: { statusCode: number; statusMessage?: string; message?: string }) => {
      return Object.assign(new Error(input.statusMessage || input.message || 'error'), input)
    }
  )
})

describe('isBrevoRateLimitErrorMessage', () => {
  it('detects Brevo SDK and plain 429 messages', async () => {
    const { isBrevoRateLimitErrorMessage } = await import('@server/services/brevo.service')
    expect(isBrevoRateLimitErrorMessage('Status code: 429')).toBe(true)
    expect(isBrevoRateLimitErrorMessage('Too Many Requests')).toBe(true)
    expect(isBrevoRateLimitErrorMessage('Brevo rate limit exceeded')).toBe(true)
    expect(isBrevoRateLimitErrorMessage('Status code: 502')).toBe(false)
  })
})

describe('throwBrevoTrackingFetchError', () => {
  it('maps rate limits to 429 instead of 502', async () => {
    const { throwBrevoTrackingFetchError } = await import('./throwBrevoTrackingFetchError')
    expect(() => throwBrevoTrackingFetchError('Status code: 429')).toThrow(
      expect.objectContaining({ statusCode: 429 })
    )
  })

  it('maps other Brevo failures to 502', async () => {
    const { throwBrevoTrackingFetchError } = await import('./throwBrevoTrackingFetchError')
    expect(() => throwBrevoTrackingFetchError('Status code: 500')).toThrow(
      expect.objectContaining({ statusCode: 502 })
    )
  })
})
