import { describe, expect, it } from 'vitest'
import {
  MARKETING_FLYERS_ADD_PERMISSION,
  MARKETING_FLYERS_DELETE_PERMISSION,
  MARKETING_FLYERS_PERMISSIONS,
  MARKETING_FLYERS_READ_PERMISSION,
} from '../marketingFlyersPermissions'

describe('marketingFlyersPermissions', () => {
  it('exposes CRM handoff codes for read, add, and delete', () => {
    expect(MARKETING_FLYERS_READ_PERMISSION).toBe('marketing:flyers:read')
    expect(MARKETING_FLYERS_ADD_PERMISSION).toBe('marketing:flyers:add')
    expect(MARKETING_FLYERS_DELETE_PERMISSION).toBe('marketing:flyers:delete')
    expect([...MARKETING_FLYERS_PERMISSIONS]).toEqual([
      'marketing:flyers:read',
      'marketing:flyers:add',
      'marketing:flyers:delete',
    ])
  })
})
