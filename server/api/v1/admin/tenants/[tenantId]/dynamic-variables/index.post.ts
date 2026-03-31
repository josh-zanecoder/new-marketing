import { getTenantClientModels } from '../../../../../../models/tenant/tenantClientModels'
import type { EmailDynamicVariableDoc } from '../../../../../../types/tenant/emailDynamicVariable.model'
import { isAdminAuthContext } from '../../../../../../tenant/registry-auth'
import { getTenantConnectionByTenantId } from '../../../../../../tenant/connection'

function normalizeScopes(input: unknown): Array<'subject' | 'body'> {
  const values = Array.isArray(input) ? input : []
  const next: Array<'subject' | 'body'> = []
  for (const raw of values) {
    const v = String(raw ?? '').trim().toLowerCase()
    if ((v === 'subject' || v === 'body') && !next.includes(v)) {
      next.push(v)
    }
  }
  return next.length ? next : ['subject', 'body']
}

function normalizeSourceType(input: unknown): 'recipient' | 'user' {
  const v = String(input ?? '').trim().toLowerCase()
  return v === 'user' ? 'user' : 'recipient'
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

  const body = await readBody<{
    key?: string
    label?: string
    description?: string
    contactPath?: string
    sourceType?: unknown
    scopes?: unknown
    enabled?: boolean
    sortOrder?: number
    fallbackValue?: string
    requiredForSend?: boolean
  }>(event)

  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  const contactPath =
    typeof body?.contactPath === 'string' ? body.contactPath.trim() : ''
  if (!key || !label || !contactPath) {
    throw createError({
      statusCode: 400,
      message: 'key, label, and contactPath are required'
    })
  }

  const description =
    typeof body?.description === 'string' ? body.description.trim() : ''
  const fallbackValue =
    typeof body?.fallbackValue === 'string' ? body.fallbackValue : ''
  const sortOrder = Number.isFinite(body?.sortOrder)
    ? Number(body?.sortOrder)
    : 0
  const sourceType = normalizeSourceType(body?.sourceType)
  const scopes = normalizeScopes(body?.scopes)
  const enabled = body?.enabled !== false
  const requiredForSend = body?.requiredForSend === true

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { EmailDynamicVariable: Model } = getTenantClientModels(tenantConn)
  try {
    const doc = await Model.create({
      key,
      label,
      description,
      contactPath,
      sourceType,
      scopes,
      enabled,
      sortOrder,
      fallbackValue,
      requiredForSend
    })
    const saved = doc.toObject() as unknown as EmailDynamicVariableDoc
    return {
      variable: {
        id: String(saved._id),
        key: saved.key,
        label: saved.label,
        description: saved.description ?? '',
        contactPath: saved.contactPath,
        sourceType: saved.sourceType ?? 'recipient',
        scopes: saved.scopes,
        enabled: saved.enabled,
        sortOrder: saved.sortOrder,
        fallbackValue: saved.fallbackValue ?? '',
        requiredForSend: saved.requiredForSend
      }
    }
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code?: number }).code === 11000
    ) {
      throw createError({
        statusCode: 409,
        message: 'A variable with this key already exists for this tenant'
      })
    }
    throw e
  }
})
