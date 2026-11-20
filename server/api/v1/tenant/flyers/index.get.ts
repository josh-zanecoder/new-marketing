import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import { requireMarketingFlyersPermission } from '@server/utils/flyer/requireMarketingFlyersPermission'
import { serializeFlyer } from '@server/utils/flyer/flyerSerialize'
import { MARKETING_FLYERS_READ_PERMISSION } from '~~/shared/constants/marketingFlyersPermissions'
import { ACTIVE_FLYER_FILTER } from '~~/shared/utils/flyerActive'

export default defineEventHandler(async (event) => {
  requireMarketingFlyersPermission(event, MARKETING_FLYERS_READ_PERMISSION)

  const conn = await getTenantConnectionFromEvent(event)
  const { Flyer, EmailTemplateCategory } = getTenantClientModels(conn)
  const flyerModel = Flyer as FlyerModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await flyerModel.find(ACTIVE_FLYER_FILTER).sort({ createdAt: -1 }).lean()
  const categoryIds = docs.map((doc) => categoryIdToString(doc.categoryId))
  const nameMap = await loadCategoryNameMap(categoryModel, categoryIds)

  return {
    flyers: docs.map((doc) => {
      const categoryId = categoryIdToString(doc.categoryId)
      return serializeFlyer(doc, categoryId ? nameMap.get(categoryId) ?? null : null)
    })
  }
})
