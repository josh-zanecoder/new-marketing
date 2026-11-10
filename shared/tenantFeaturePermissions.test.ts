import { describe, expect, it } from 'vitest'
import {
  groupTenantFeaturePermissions,
  tenantFeaturePermissionStateFrom
} from './tenantFeaturePermissions'

describe('tenant feature permissions', () => {
  it('groups each flag under its own resource', () => {
    const groups = groupTenantFeaturePermissions()
    expect(groups.map((group) => group.key)).toEqual(['campaigns', 'recipient-lists', 'images'])
    expect(groups.find((group) => group.key === 'images')?.permissions.map((permission) => permission.key)).toEqual([
      'allowTenantImages',
      'allowTenantInsertImage'
    ])
  })

  it('reads only exact true values from a tenant row', () => {
    expect(
      tenantFeaturePermissionStateFrom({
        allowTenantEditSender: true,
        allowTenantImages: false
      })
    ).toEqual({
      allowTenantEditSender: true,
      allowTenantLoRecipientLists: false,
      allowTenantImages: false,
      allowTenantInsertImage: false
    })
  })
})
