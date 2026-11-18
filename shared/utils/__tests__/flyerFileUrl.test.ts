import { describe, expect, it } from 'vitest'
import { buildFlyerFileUrl } from '../flyerFileUrl'

describe('buildFlyerFileUrl', () => {
  it('builds an encoded same-origin file path', () => {
    expect(buildFlyerFileUrl('abc123')).toBe('/api/v1/tenant/flyers/abc123/file')
  })

  it('returns empty for blank ids', () => {
    expect(buildFlyerFileUrl('')).toBe('')
    expect(buildFlyerFileUrl('   ')).toBe('')
  })
})
