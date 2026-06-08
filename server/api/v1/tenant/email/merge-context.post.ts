import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { EmailDynamicVariableModel } from '@server/types/tenant/emailDynamicVariable.model'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext,
  findRegistryTenantByDbName
} from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import {
  type DraftRecipientContext,
  previewContactForDraft,
  previewContactForSavedCampaign
} from '@server/utils/emailMerge/campaignAudience'
import {
  applyDefaultUnsubscribeMergeValue,
  composeEmailMergeRoot,
  fetchEnabledEmailDynamicVariableBindings
} from '@server/utils/emailMerge/composeMergeRoot'
import {
  mergeUserSnapshotForContact,
  tenantUserFieldsFromAuth
} from '@server/utils/emailMerge/tenantUserFromAuth'
import { getMarketingPublicBaseUrl } from '@server/utils/marketingPublicBaseUrl'

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
  const dbName = conn.db?.databaseName ?? ''
  const { Campaign, EmailDynamicVariable } = getTenantClientModels(conn)
  const dynModel = EmailDynamicVariable as EmailDynamicVariableModel
  const dynamicVariableBindings = await fetchEnabledEmailDynamicVariableBindings(dynModel)

  let clientKeyHash: string | undefined
  let crmAppUrl: string | undefined
  if (dbName) {
    try {
      const registry = await getRegistryConnection()
      const row = await findRegistryTenantByDbName(registry, dbName)
      if (row?.clientKeyHash) clientKeyHash = row.clientKeyHash
      if (row?.crmAppUrl) crmAppUrl = row.crmAppUrl
    } catch {
      /* preview only */
    }
  }

  const marketingBase = getMarketingPublicBaseUrl()
  const previewUnsubscribePlaceholder = crmAppUrl
    ? `${crmAppUrl}/marketing/unsubscribe?token=preview`
    : marketingBase
      ? `${marketingBase}/api/v1/unsubscribe?token=preview`
      : undefined

  const authSnap = tenantUserFieldsFromAuth(auth)

  if ('campaignId' in body && typeof body.campaignId === 'string' && body.campaignId.trim()) {
    const campaignId = body.campaignId.trim()
    if (!mongoose.isValidObjectId(campaignId)) {
      throw createError({ statusCode: 400, message: 'Invalid campaignId' })
    }
    const campaign = await (Campaign as CampaignModel)
      .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth))
      .lean<CampaignLean | null>()
    if (!campaign) {
      throw createError({ statusCode: 404, message: 'Campaign not found' })
    }
    const contact = await previewContactForSavedCampaign(conn, campaignId)
    const userSnapshot = mergeUserSnapshotForContact(
      contact,
      campaign.mergeUserSnapshot,
      authSnap
    )
    const mergeRoot = composeEmailMergeRoot(userSnapshot, contact ?? null, dynamicVariableBindings)
    applyDefaultUnsubscribeMergeValue(mergeRoot, {
      dbName,
      contactId: contact?._id ? String(contact._id) : undefined,
      clientKeyHash,
      crmAppUrl,
      previewPlaceholder: previewUnsubscribePlaceholder
    })
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
  const userSnapshot = mergeUserSnapshotForContact(contact, authSnap)
  const mergeRoot = composeEmailMergeRoot(userSnapshot, contact ?? null, dynamicVariableBindings)
  applyDefaultUnsubscribeMergeValue(mergeRoot, {
    dbName,
    contactId: contact?._id ? String(contact._id) : undefined,
    clientKeyHash,
    crmAppUrl,
    previewPlaceholder: previewUnsubscribePlaceholder
  })
  return { mergeRoot }
})
