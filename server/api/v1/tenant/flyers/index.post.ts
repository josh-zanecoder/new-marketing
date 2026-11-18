import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateCategoryModel } from '@server/types/tenant/emailTemplateCategory.model'
import type { FlyerModel } from '@server/types/tenant/flyer.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import {
  parseOptionalCategoryId,
  resolveCategoryObjectId
} from '@server/utils/emailTemplate/emailTemplateCategoryHelpers'
import { requireMarketingFlyersPermission } from '@server/utils/flyer/requireMarketingFlyersPermission'
import { serializeFlyer } from '@server/utils/flyer/flyerSerialize'
import { uploadFlyerDataUrlToGcs } from '@server/utils/flyer/uploadFlyerFileToGcs'
import { hostedImageOwnershipFromAuth } from '@server/utils/hostedImage/hostedImageAccessFromAuth'
import { MARKETING_FLYERS_ADD_PERMISSION } from '~~/shared/constants/marketingFlyersPermissions'
import { normalizeFlyerName } from '~~/shared/utils/normalizeFlyerName'
import { sanitizeFlyerOriginalFileName } from '~~/shared/utils/sanitizeFlyerOriginalFileName'

export default defineEventHandler(async (event) => {
  requireMarketingFlyersPermission(event, MARKETING_FLYERS_ADD_PERMISSION)

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const name = normalizeFlyerName(String(body.name ?? ''))
  if (!name) {
    throw createError({ statusCode: 400, message: 'Flyer name is required' })
  }

  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : ''
  if (!dataUrl) {
    throw createError({ statusCode: 400, message: 'dataUrl is required' })
  }

  const categoryIdRaw = parseOptionalCategoryId(body.categoryId)
  const conn = await getTenantConnectionFromEvent(event)
  const { Flyer, EmailTemplateCategory } = getTenantClientModels(conn)
  const flyerModel = Flyer as FlyerModel
  const categoryModel = EmailTemplateCategory as EmailTemplateCategoryModel

  const categoryObjectId = await resolveCategoryObjectId(categoryModel, categoryIdRaw)
  let categoryName: string | null = null
  if (categoryObjectId) {
    const category = await categoryModel.findById(categoryObjectId).select('name').lean()
    categoryName = category?.name ?? null
  }

  const auth = event.context.auth
  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const uploaded = await uploadFlyerDataUrlToGcs({
    tenantName,
    dataUrl,
    ownership: hostedImageOwnershipFromAuth(auth)
  })

  const originalFileName = sanitizeFlyerOriginalFileName(body.originalFileName)
  const doc = await flyerModel.create({
    name,
    categoryId: categoryObjectId ?? null,
    imageUrl: uploaded.url,
    objectPath: uploaded.objectPath,
    fileName: originalFileName || uploaded.objectPath.split('/').pop() || '',
    contentType: uploaded.contentType,
    size: uploaded.size
  })

  return {
    ok: true,
    flyer: serializeFlyer(doc, categoryName)
  }
})
