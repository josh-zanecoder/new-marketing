import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByTenantId } from '@server/tenant/connection'
import {
  categoryIdToString,
  loadCategoryNameMap
} from '@server/utils/emailTemplate/emailTemplateCategoryLookup'
import { serializeFlyer } from '@server/utils/flyer/flyerSerialize'
import { DELETED_FLYER_FILTER } from '~~/shared/utils/flyerActive'

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

  const { Flyer, EmailTemplateCategory } = getTenantClientModels(tenantConn)
  const flyerModel = Flyer as FlyerModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const docs = await flyerModel.find(DELETED_FLYER_FILTER).sort({ deletedAt: -1 }).lean()
  const categoryIds = docs.map((doc) => categoryIdToString(doc.categoryId))
  const nameMap = await loadCategoryNameMap(categoryModel, categoryIds)

  return {
    flyers: docs.map((doc) => {
      const categoryId = categoryIdToString(doc.categoryId)
      return {
        ...serializeFlyer(doc, categoryId ? nameMap.get(categoryId) ?? null : null),
        deletedAt: doc.deletedAt?.toISOString?.() ?? null
      }
    })
  }
})
