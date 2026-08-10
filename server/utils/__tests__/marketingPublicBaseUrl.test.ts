import { describe, expect, it, afterEach } from 'vitest'
import { getMarketingPublicBaseUrl } from '../marketingPublicBaseUrl'

describe('getMarketingPublicBaseUrl', () => {
  const prevPublic = process.env.NUXT_PUBLIC_MARKETING_BASE_URL
  const prevAlt = process.env.MARKETING_PUBLIC_BASE_URL

  afterEach(() => {
    if (prevPublic === undefined) delete process.env.NUXT_PUBLIC_MARKETING_BASE_URL
    else process.env.NUXT_PUBLIC_MARKETING_BASE_URL = prevPublic
    if (prevAlt === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL
    else process.env.MARKETING_PUBLIC_BASE_URL = prevAlt
  })

  it('reads MARKETING_PUBLIC_BASE_URL from env when runtime config is unavailable', () => {
    delete process.env.NUXT_PUBLIC_MARKETING_BASE_URL
    process.env.MARKETING_PUBLIC_BASE_URL = 'https://marketing-from-env.example.com/'
    expect(getMarketingPublicBaseUrl()).toBe('https://marketing-from-env.example.com')
  })
})
