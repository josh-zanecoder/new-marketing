import { describe, expect, it } from 'vitest'
import { buildAdminFlyerFileUrl, buildFlyerFileUrl } from '../flyerFileUrl'

describe('buildFlyerFileUrl', () => {
  it('builds an encoded same-origin file path', () => {
    expect(buildFlyerFileUrl('abc123')).toBe('/api/v1/tenant/flyers/abc123/file')
  })

  it('returns empty for blank ids', () => {
    expect(buildFlyerFileUrl('')).toBe('')
    expect(buildFlyerFileUrl('   ')).toBe('')
  })
})

describe('buildAdminFlyerFileUrl', () => {
  it('builds an encoded admin file path', () => {
    expect(buildAdminFlyerFileUrl('tenant-1', 'flyer-1')).toBe(
      '/api/v1/admin/tenants/tenant-1/flyers/flyer-1/file'
    )
  })

  it('returns empty when tenant or flyer id is blank', () => {
    expect(buildAdminFlyerFileUrl('', 'flyer-1')).toBe('')
    expect(buildAdminFlyerFileUrl('tenant-1', '')).toBe('')
  })
})
