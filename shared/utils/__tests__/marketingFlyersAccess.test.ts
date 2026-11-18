import { describe, expect, it } from 'vitest'
import {
  MARKETING_FLYERS_ADD_PERMISSION,
  MARKETING_FLYERS_DELETE_PERMISSION,
  MARKETING_FLYERS_READ_PERMISSION,
} from '../../constants/marketingFlyersPermissions'
import { resolveMarketingFlyersAccess } from '../marketingFlyersAccess'

describe('resolveMarketingFlyersAccess', () => {
  it('allows all actions when there is no CRM permission snapshot', () => {
    expect(
      resolveMarketingFlyersAccess({
        hasCrmPermissionSnapshot: false,
        permissions: undefined,
      })
    ).toEqual({
      canReadFlyers: true,
      canAddFlyers: true,
      canDeleteFlyers: true,
    })
  })

  it('gates add and delete independently under CRM handoff permissions', () => {
    expect(
      resolveMarketingFlyersAccess({
        hasCrmPermissionSnapshot: true,
        permissions: [MARKETING_FLYERS_READ_PERMISSION, MARKETING_FLYERS_ADD_PERMISSION],
      })
    ).toEqual({
      canReadFlyers: true,
      canAddFlyers: true,
      canDeleteFlyers: false,
    })

    expect(
      resolveMarketingFlyersAccess({
        hasCrmPermissionSnapshot: true,
        permissions: [MARKETING_FLYERS_READ_PERMISSION, MARKETING_FLYERS_DELETE_PERMISSION],
      })
    ).toEqual({
      canReadFlyers: true,
      canAddFlyers: false,
      canDeleteFlyers: true,
    })
  })

  it('denies read when the CRM snapshot lacks flyers read', () => {
    expect(
      resolveMarketingFlyersAccess({
        hasCrmPermissionSnapshot: true,
        permissions: [],
      }).canReadFlyers
    ).toBe(false)
  })
})
