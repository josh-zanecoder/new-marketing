import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid template id' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplate } = getTenantClientModels(conn)

  const existing = await (EmailTemplate as EmailTemplateModel).findById(rawId).select('_id').lean()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  const set: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) set.name = body.name.trim()
  if (typeof body.subject === 'string' && body.subject.trim()) set.subject = body.subject.trim()
  if (typeof body.description === 'string') set.description = body.description.trim()
  if (typeof body.htmlTemplate === 'string' && body.htmlTemplate.trim()) {
    set.htmlTemplate = body.htmlTemplate.trim()
  }
  if (body.htmlSource === 'upload' || body.htmlSource === 'editor') {
    set.htmlSource = body.htmlSource
  }
  if (typeof body.saveToLibrary === 'boolean') set.saveToLibrary = body.saveToLibrary

  if (!Object.keys(set).length) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const doc = await (EmailTemplate as EmailTemplateModel).findByIdAndUpdate(
    rawId,
    { $set: set },
    { new: true }
  )

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Email template not found' })
  }

  return {
    ok: true,
    template: {
      id: String(doc._id),
      name: doc.name,
      subject: doc.subject ?? '',
      description: doc.description ?? '',
      htmlTemplate: doc.htmlTemplate ?? '',
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    }
  }
})
