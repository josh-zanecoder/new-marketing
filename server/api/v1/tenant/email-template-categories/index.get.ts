import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { serializeCategory } from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { EmailTemplateCategory } = getTenantClientModels(conn)
  const model = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await model.find().sort({ sortOrder: 1, name: 1 }).lean()

  return {
    categories: docs.map((doc) => serializeCategory(doc))
  }
})
