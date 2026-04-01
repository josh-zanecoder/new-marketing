import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'

function serialize(
  f: {
    _id: unknown
    name: string
    contactType: string
    property?: string
    propertyType?: string | null
    propertyValue?: string
    enabled: boolean
    createdAt?: Date
    updatedAt?: Date
  },
  tenantId: string
) {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(f)
  return {
    id: String(f._id),
    tenantId,
    name: f.name,
    contactType: f.contactType,
    property,
    propertyType,
    propertyValue: f.propertyValue ?? '',
    enabled: f.enabled,
    createdAt: f.createdAt?.toISOString?.() ?? null,
    updatedAt: f.updatedAt?.toISOString?.() ?? null
  }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const raw = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(raw).trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant id' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { RecipientFilter: Model } = getTenantClientModels(tenantConn)
  const docs = await Model.find({})
    .sort({ updatedAt: -1 })
    .lean()
    .exec()

  return {
    filters: docs.map((d) =>
      serialize(
        d as unknown as Parameters<typeof serialize>[0],
        tenantId
      )
    )
  }
})
