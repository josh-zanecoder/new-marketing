import { getRegistryConnection } from '../../../../../../lib/mongoose'
import { getRecipientFilterModel } from '../../../../../../models/registry/RecipientFilter'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import { canonicalRecipientFilterFieldsFromDoc } from '../../../../../../utils/recipientFilterValidation'

function serialize(f: {
  _id: unknown
  tenantId: string
  name: string
  contactType: string
  property?: string
  propertyType?: string | null
  propertyValue?: string
  enabled: boolean
  createdAt?: Date
  updatedAt?: Date
}) {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(f)
  return {
    id: String(f._id),
    tenantId: f.tenantId,
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

  const registryConn = await getRegistryConnection()
  const Model = getRecipientFilterModel(registryConn)
  const docs = await Model.find({ tenantId })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()

  return {
    filters: docs.map(serialize)
  }
})
