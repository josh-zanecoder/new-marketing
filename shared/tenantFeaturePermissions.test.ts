import { describe, expect, it } from 'vitest'
import {
  groupTenantFeaturePermissions,
  tenantFeaturePermissionStateFrom
} from './tenantFeaturePermissions'

describe('tenant feature permissions', () => {
  it('groups each flag under its own resource', () => {
    const groups = groupTenantFeaturePermissions()
    expect(groups.map((group) => group.key)).toEqual([
      'campaigns',
      'recipient-lists',
      'email-templates',
      'images',
      'email-builder',
      'integrations'
    ])
    expect(
      groups.find((group) => group.key === 'integrations')?.permissions.map((permission) => permission.key)
    ).toEqual(['allowTenantLendingQbStatus'])
    expect(
      groups.find((group) => group.key === 'campaigns')?.permissions.map((permission) => permission.key)
    ).toEqual(['allowTenantEditSender', 'allowTenantAdvancedRecipientFiltering'])
    expect(
      groups.find((group) => group.key === 'email-builder')?.permissions.map((permission) => permission.key)
    ).toEqual([
      'allowTenantGrapesBuilder',
      'allowTenantBeefreeBuilder',
      'allowTenantTemplateBuilder',
      'allowTenantEditText',
      'allowTenantResizeImage'
    ])
    expect(
      groups.find((group) => group.key === 'email-templates')?.permissions.map((permission) => permission.key)
    ).toEqual(['allowTenantTemplateApproval'])
    expect(groups.find((group) => group.key === 'images')?.permissions.map((permission) => permission.key)).toEqual([
      'allowTenantImages',
      'allowTenantInsertImage',
      'allowTenantReplaceImage'
    ])
  })

  it('reads only exact true values from a tenant row', () => {
    expect(
      tenantFeaturePermissionStateFrom({
        allowTenantEditSender: true,
        allowTenantAdvancedRecipientFiltering: true,
        allowTenantImages: false
      })
    ).toEqual({
      allowTenantEditSender: true,
      allowTenantAdvancedRecipientFiltering: true,
      allowTenantLoRecipientLists: false,
      allowTenantTemplateApproval: false,
      allowTenantImages: false,
      allowTenantInsertImage: false,
      allowTenantReplaceImage: false,
      allowTenantGrapesBuilder: false,
      allowTenantBeefreeBuilder: false,
      allowTenantTemplateBuilder: false,
      allowTenantEditText: false,
      allowTenantResizeImage: false,
      allowTenantLendingQbStatus: false
    })
    expect(tenantFeaturePermissionStateFrom({ allowTenantLendingQbStatus: true }).allowTenantLendingQbStatus).toBe(true)
  })
})
