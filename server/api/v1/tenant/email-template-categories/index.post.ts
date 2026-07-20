import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  categoryNameFromBody,
  serializeCategory
} from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const name = categoryNameFromBody(body.name)
  const description = String(body.description ?? '').trim()
  const sortOrder = typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
    ? body.sortOrder
    : 0

  if (!name) {
    throw createError({ statusCode: 400, message: 'Category name is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplateCategory as EmailTemplateCategoryModel

  const duplicate = await model
    .findOne({ name })
    .collation({ locale: 'en', strength: 2 })
    .select('_id')
    .lean()
  if (duplicate) {
    throw createError({ statusCode: 409, message: 'A category with this name already exists' })
  }

  try {
    const doc = await model.create({ name, description, sortOrder })
    return { ok: true, category: serializeCategory(doc) }
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? Number((e as { code: number }).code) : 0
    if (code === 11000) {
      throw createError({ statusCode: 409, message: 'A category with this name already exists' })
    }
    throw e
  }
})
