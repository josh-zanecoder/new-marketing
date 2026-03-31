import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext
} from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'

function serialize(v: {
  _id: unknown
  key: string
  label: string
  description?: string
  contactPath: string
  scopes?: string[]
  enabled: boolean
  sortOrder: number
  fallbackValue?: string
  requiredForSend: boolean
  sourceType?: string
}) {
  const st =
    v.sourceType === 'user' || v.sourceType === 'recipient' ? v.sourceType : 'recipient'
  return {
    id: String(v._id),
    key: v.key,
    label: v.label,
    description: v.description ?? '',
    contactPath: v.contactPath,
    scopes: (Array.isArray(v.scopes) && v.scopes.length
      ? v.scopes
      : ['subject', 'body']) as Array<'subject' | 'body'>,
    enabled: !!v.enabled,
    sortOrder: Number.isFinite(v.sortOrder) ? v.sortOrder : 0,
    fallbackValue: v.fallbackValue ?? '',
    requiredForSend: !!v.requiredForSend,
    sourceType: st
  }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (isAdminAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Admin sessions cannot use this route; open the editor in a tenant context'
    })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { EmailDynamicVariable: Model } = getTenantClientModels(tenantConn)
  const docs = await Model.find({})
    .sort({ sortOrder: 1, label: 1, key: 1 })
    .lean()
    .exec()

  return {
    variables: docs.map((d) =>
      serialize(d as unknown as Parameters<typeof serialize>[0])
    )
  }
})
