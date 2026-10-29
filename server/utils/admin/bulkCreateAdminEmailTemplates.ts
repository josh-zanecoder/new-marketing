import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import {
  parseOptionalCategoryId,
  resolveCategoryObjectId
} from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'
import { normalizeUploadedEmailHtml } from '~~/shared/utils/uploadedEmailHtml'

export type BulkAdminEmailTemplateInput = {
  name: string
  subject?: string
  htmlTemplate: string
  description?: string
  categoryId?: string | null
}

export type BulkAdminEmailTemplateCreated = {
  id: string
  name: string
  subject: string
  categoryId: string | null
  categoryName: string | null
  unsubscribeFooterAppended: boolean
}

export type BulkAdminEmailTemplateError = {
  index: number
  name: string
  message: string
}

export type BulkCreateAdminEmailTemplatesResult = {
  totalSubmitted: number
  createdCount: number
  errorCount: number
  created: BulkAdminEmailTemplateCreated[]
  errors: BulkAdminEmailTemplateError[]
}

function ownershipFields(createdBy: string): {
  createdBy?: string
  metadata: { ownerEmail: string }
} {
  return {
    ...(createdBy ? { createdBy } : {}),
    // Admin bulk uploads are shared library templates (not owner-scoped).
    metadata: { ownerEmail: '' }
  }
}

/**
 * Creates many email templates in a tenant DB (admin bulk upload).
 * Continues past per-row validation errors; returns created + errors.
 */
export async function bulkCreateAdminEmailTemplates(
  tenantConn: Connection,
  templates: BulkAdminEmailTemplateInput[],
  createdBy = ''
): Promise<BulkCreateAdminEmailTemplatesResult> {
  const { EmailTemplate, EmailTemplateCategory } = getTenantClientModels(tenantConn)
  const model = EmailTemplate as EmailTemplateModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel
  const ownership = ownershipFields(createdBy.trim())

  const created: BulkAdminEmailTemplateCreated[] = []
  const errors: BulkAdminEmailTemplateError[] = []
  const categoryIdsForLookup: string[] = []

  for (let index = 0; index < templates.length; index++) {
    const row = templates[index]!
    const name = String(row.name ?? '').trim()
    const subject = String(row.subject ?? '').trim() || name
    const description = String(row.description ?? '').trim()
    const categoryIdRaw = parseOptionalCategoryId(row.categoryId)

    if (!name) {
      errors.push({ index, name: '', message: 'Template name is required' })
      continue
    }

    let htmlTemplate: string
    try {
      htmlTemplate = normalizeUploadedEmailHtml(String(row.htmlTemplate ?? ''))
    } catch (e) {
      errors.push({
        index,
        name,
        message: e instanceof Error ? e.message : 'Invalid HTML'
      })
      continue
    }

    if (!subject) {
      errors.push({ index, name, message: 'Default subject is required' })
      continue
    }

    try {
      const unsubscribeCheck = ensureEmailTemplateUnsubscribe(htmlTemplate)
      const categoryId = await resolveCategoryObjectId(categoryModel, categoryIdRaw)
      const doc = await model.create({
        name,
        subject,
        description,
        htmlTemplate: unsubscribeCheck.html,
        htmlSource: 'upload',
        saveToLibrary: true,
        categoryId: categoryId ?? null,
        ...ownership
      })
      const idStr = categoryIdToString(doc.categoryId)
      if (idStr) categoryIdsForLookup.push(idStr)
      created.push({
        id: String(doc._id),
        name: doc.name,
        subject: doc.subject ?? '',
        categoryId: idStr,
        categoryName: null,
        unsubscribeFooterAppended: unsubscribeCheck.footerAppended
      })
    } catch (e) {
      errors.push({
        index,
        name,
        message: e instanceof Error ? e.message : 'Failed to create template'
      })
    }
  }

  if (categoryIdsForLookup.length) {
    const nameById = await loadCategoryNameMap(categoryModel, categoryIdsForLookup)
    for (const row of created) {
      if (row.categoryId) {
        row.categoryName = nameById.get(row.categoryId) ?? null
      }
    }
  }

  return {
    totalSubmitted: templates.length,
    createdCount: created.length,
    errorCount: errors.length,
    created,
    errors
  }
}
