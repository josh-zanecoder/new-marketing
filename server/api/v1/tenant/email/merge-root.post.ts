import mongoose from 'mongoose'
import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../../../types/tenant/campaign.model'
import type { EmailDynamicVariableModel } from '../../../../types/tenant/emailDynamicVariable.model'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext
} from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import {
  type DraftRecipientContext,
  previewContactForDraft,
  previewContactForSavedCampaign
} from '../../../../utils/emailMerge/campaignAudience'
import {
  composeEmailMergeRoot,
  fetchEnabledEmailDynamicVariableBindings
} from '../../../../utils/emailMerge/composeMergeRoot'
import { tenantUserFieldsFromAuth } from '../../../../utils/emailMerge/tenantUserFromAuth'

type MergeRootBody =
  | { campaignId: string }
  | {
      recipientsType: 'list' | 'manual'
      recipientsListId?: string
      recipientsManual?: string[]
    }

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (isAdminAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Admin sessions cannot use this route; use a tenant context'
    })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  const body = (await readBody(event).catch(() => null)) as MergeRootBody | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid body' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailDynamicVariable } = getTenantClientModels(conn)
  const dynModel = EmailDynamicVariable as EmailDynamicVariableModel
  const dynamicVariableBindings = await fetchEnabledEmailDynamicVariableBindings(dynModel)

  const authSnap = tenantUserFieldsFromAuth(auth)

  if ('campaignId' in body && typeof body.campaignId === 'string' && body.campaignId.trim()) {
    const campaignId = body.campaignId.trim()
    if (!mongoose.isValidObjectId(campaignId)) {
      throw createError({ statusCode: 400, message: 'Invalid campaignId' })
    }
    const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
    if (!campaign) {
      throw createError({ statusCode: 404, message: 'Campaign not found' })
    }
    const contact = await previewContactForSavedCampaign(conn, campaignId)
    const userSnapshot = authSnap ?? campaign.mergeUserSnapshot
    const mergeRoot = composeEmailMergeRoot(userSnapshot, contact ?? null, dynamicVariableBindings)
    return { mergeRoot }
  }

  const recipientsType = (body as { recipientsType?: string }).recipientsType
  if (recipientsType !== 'list' && recipientsType !== 'manual') {
    throw createError({
      statusCode: 400,
      message: 'Provide campaignId or recipientsType (list | manual) for draft merge'
    })
  }

  const draft: DraftRecipientContext = {
    recipientsType: recipientsType as DraftRecipientContext['recipientsType'],
    recipientsListId:
      typeof (body as { recipientsListId?: string }).recipientsListId === 'string'
        ? (body as { recipientsListId: string }).recipientsListId
        : undefined,
    recipientsManual: Array.isArray((body as { recipientsManual?: unknown }).recipientsManual)
      ? ((body as { recipientsManual: string[] }).recipientsManual as string[])
      : undefined
  }

  const contact = await previewContactForDraft(conn, draft)
  const mergeRoot = composeEmailMergeRoot(authSnap ?? {}, contact ?? null, dynamicVariableBindings)
  return { mergeRoot }
})
