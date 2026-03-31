import mongoose from 'mongoose'
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

  const rawTid = getRouterParam(event, 'tenantId') ?? ''
  const tenantId = decodeURIComponent(rawTid).trim()
  const id = getRouterParam(event, 'id') ?? ''
  if (!tenantId || !id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, message: 'Invalid request' })
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

  const patch: Record<string, unknown> = {}

  if (typeof body?.key === 'string') {
    const key = body.key.trim()
    if (!key) throw createError({ statusCode: 400, message: 'key cannot be empty' })
    patch.key = key
  }
  if (typeof body?.label === 'string') {
    const label = body.label.trim()
    if (!label) throw createError({ statusCode: 400, message: 'label cannot be empty' })
    patch.label = label
  }
  if (typeof body?.contactPath === 'string') {
    const contactPath = body.contactPath.trim()
    if (!contactPath) {
      throw createError({ statusCode: 400, message: 'contactPath cannot be empty' })
    }
    patch.contactPath = contactPath
  }
  if (typeof body?.description === 'string') patch.description = body.description.trim()
  if (typeof body?.fallbackValue === 'string') patch.fallbackValue = body.fallbackValue
  if (body?.scopes !== undefined) patch.scopes = normalizeScopes(body.scopes)
  if (body?.sourceType !== undefined) patch.sourceType = normalizeSourceType(body.sourceType)
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body?.requiredForSend === 'boolean') {
    patch.requiredForSend = body.requiredForSend
  }
  if (body?.sortOrder !== undefined) {
    patch.sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const tenantConn = await getTenantConnectionByTenantId(tenantId)
  if (!tenantConn) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const { EmailDynamicVariable: Model } = getTenantClientModels(tenantConn)

  try {
    const doc = await Model.findOneAndUpdate(
      { _id: id },
      { $set: patch },
      { new: true, runValidators: true }
    ).exec()

    if (!doc) {
      throw createError({ statusCode: 404, message: 'Variable not found' })
    }

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
