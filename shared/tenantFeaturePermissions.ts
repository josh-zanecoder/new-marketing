/**
 * Superadmin feature flags for one marketing tenant.
 * These are tenant-wide switches, not per-role CRM permissions.
 */
export const TENANT_FEATURE_PERMISSION_KEYS = [
  'allowTenantEditSender',
  'allowTenantLoRecipientLists',
  'allowTenantTemplateApproval',
  'allowTenantImages',
  'allowTenantInsertImage',
  'allowTenantReplaceImage',
  'allowTenantGrapesBuilder',
  'allowTenantBeefreeBuilder',
  'allowTenantTemplateBuilder',
  'allowTenantEditText',
  'allowTenantResizeImage'
] as const

export type TenantFeaturePermissionKey = (typeof TENANT_FEATURE_PERMISSION_KEYS)[number]

export type TenantFeaturePermissionState = Record<TenantFeaturePermissionKey, boolean>

export type TenantFeaturePermission = {
  key: TenantFeaturePermissionKey
  code: string
  label: string
  description: string
  group: string
  groupLabel: string
  /** Admin PATCH path under `/api/v1/admin/tenants/db/:dbName/`. */
  patchPath: string
}

export const TENANT_FEATURE_PERMISSIONS: readonly TenantFeaturePermission[] = [
  {
    key: 'allowTenantEditSender',
    code: 'campaigns:edit-sender',
    label: 'Edit campaign sender',
    description: 'Tenant can change the From name and email on campaigns.',
    group: 'campaigns',
    groupLabel: 'Campaigns',
    patchPath: 'allow-tenant-edit-sender'
  },
  {
    key: 'allowTenantLoRecipientLists',
    code: 'recipient-lists:lo',
    label: 'LO recipient lists',
    description:
      'Tenant can create loan-officer recipient lists, search members, and remove them in bulk.',
    group: 'recipient-lists',
    groupLabel: 'Recipient lists',
    patchPath: 'allow-tenant-lo-recipient-lists'
  },
  {
    key: 'allowTenantTemplateApproval',
    code: 'email-templates:approval',
    label: 'Template approval',
    description:
      'Requires email templates to be approved before send. Shows Template approvals for OM / Marketing.',
    group: 'email-templates',
    groupLabel: 'Email templates',
    patchPath: 'allow-tenant-template-approval'
  },
  {
    key: 'allowTenantImages',
    code: 'images:library',
    label: 'Images library',
    description: 'Shows the Images page. Tenant can upload and delete hosted images.',
    group: 'images',
    groupLabel: 'Images',
    patchPath: 'allow-tenant-images'
  },
  {
    key: 'allowTenantInsertImage',
    code: 'images:insert',
    label: 'Insert image',
    description: 'Tenant can insert new images into email templates.',
    group: 'images',
    groupLabel: 'Images',
    patchPath: 'allow-tenant-insert-image'
  },
  {
    key: 'allowTenantReplaceImage',
    code: 'images:replace',
    label: 'Replace images',
    description: 'Tenant can replace images already in email templates, in the HTML editor and the template builder.',
    group: 'images',
    groupLabel: 'Images',
    patchPath: 'allow-tenant-replace-image'
  },
  {
    key: 'allowTenantGrapesBuilder',
    code: 'email-builder:grapes',
    label: 'Grapes editor',
    description: 'Tenant can open the GrapesJS email editor.',
    group: 'email-builder',
    groupLabel: 'Email builder',
    patchPath: 'allow-tenant-grapes-builder'
  },
  {
    key: 'allowTenantBeefreeBuilder',
    code: 'email-builder:beefree',
    label: 'Beefree editor',
    description: 'Tenant can open the Beefree email builder.',
    group: 'email-builder',
    groupLabel: 'Email builder',
    patchPath: 'allow-tenant-beefree-builder'
  },
  {
    key: 'allowTenantTemplateBuilder',
    code: 'email-builder:template',
    label: 'Template builder',
    description: 'Tenant can edit campaign emails and saved templates in the visual template builder.',
    group: 'email-builder',
    groupLabel: 'Email builder',
    patchPath: 'allow-tenant-template-builder'
  },
  {
    key: 'allowTenantEditText',
    code: 'email-builder:edit-text',
    label: 'Edit text',
    description: 'Tenant can change the words in the visual template builder.',
    group: 'email-builder',
    groupLabel: 'Email builder',
    patchPath: 'allow-tenant-edit-text'
  },
  {
    key: 'allowTenantResizeImage',
    code: 'email-builder:resize',
    label: 'Resize photos',
    description: 'Tenant can resize photos in the visual template builder.',
    group: 'email-builder',
    groupLabel: 'Email builder',
    patchPath: 'allow-tenant-resize-image'
  }
]

export type TenantFeaturePermissionGroup = {
  key: string
  label: string
  permissions: TenantFeaturePermission[]
}

export function emptyTenantFeaturePermissionState(): TenantFeaturePermissionState {
  return {
    allowTenantEditSender: false,
    allowTenantLoRecipientLists: false,
    allowTenantTemplateApproval: false,
    allowTenantImages: false,
    allowTenantInsertImage: false,
    allowTenantReplaceImage: false,
    allowTenantGrapesBuilder: false,
    allowTenantBeefreeBuilder: false,
    allowTenantTemplateBuilder: false,
    allowTenantEditText: false,
    allowTenantResizeImage: false
  }
}

export function tenantFeaturePermissionStateFrom(
  raw: Partial<TenantFeaturePermissionState> | null | undefined
): TenantFeaturePermissionState {
  const base = emptyTenantFeaturePermissionState()
  if (!raw) return base
  for (const key of TENANT_FEATURE_PERMISSION_KEYS) {
    base[key] = raw[key] === true
  }
  return base
}

export function groupTenantFeaturePermissions(
  permissions: readonly TenantFeaturePermission[] = TENANT_FEATURE_PERMISSIONS
): TenantFeaturePermissionGroup[] {
  const groups: TenantFeaturePermissionGroup[] = []
  for (const permission of permissions) {
    const existing = groups.find((group) => group.key === permission.group)
    if (existing) existing.permissions.push(permission)
    else {
      groups.push({
        key: permission.group,
        label: permission.groupLabel,
        permissions: [permission]
      })
    }
  }
  return groups
}
