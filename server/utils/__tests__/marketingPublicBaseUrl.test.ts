import { describe, expect, it, afterEach } from 'vitest'
import { getMarketingPublicBaseUrl } from '../marketingPublicBaseUrl'

describe('getMarketingPublicBaseUrl', () => {
  const prevPublic = process.env.NUXT_PUBLIC_MARKETING_BASE_URL
  const prevAlt = process.env.MARKETING_PUBLIC_BASE_URL
  const prevApp = process.env.MARKETING_APP_URL

  afterEach(() => {
    if (prevPublic === undefined) delete process.env.NUXT_PUBLIC_MARKETING_BASE_URL
    else process.env.NUXT_PUBLIC_MARKETING_BASE_URL = prevPublic
    if (prevAlt === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL
    else process.env.MARKETING_PUBLIC_BASE_URL = prevAlt
    if (prevApp === undefined) delete process.env.MARKETING_APP_URL
    else process.env.MARKETING_APP_URL = prevApp
  })

  it('uses MARKETING_PUBLIC_BASE_URL first', () => {
    process.env.MARKETING_PUBLIC_BASE_URL = 'https://marketing-from-env.example.com/'
    process.env.NUXT_PUBLIC_MARKETING_BASE_URL = 'https://nuxt-public.example.com'
    process.env.MARKETING_APP_URL = 'https://app.example.com/'
    expect(getMarketingPublicBaseUrl()).toBe('https://marketing-from-env.example.com')
  })

  it('falls back to MARKETING_APP_URL', () => {
    delete process.env.MARKETING_PUBLIC_BASE_URL
    delete process.env.NUXT_PUBLIC_MARKETING_BASE_URL
    process.env.MARKETING_APP_URL = 'https://marketing-test-980800581325.us-west1.run.app/'
    expect(getMarketingPublicBaseUrl()).toBe(
      'https://marketing-test-980800581325.us-west1.run.app'
    )
  })
})
