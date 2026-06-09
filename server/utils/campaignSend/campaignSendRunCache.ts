import type { CampaignLean } from '../../types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../../types/tenant/emailTemplate.model'
import type { EmailDynamicVariableModel } from '../../types/tenant/emailDynamicVariable.model'
import type { TenantClientModels } from '../../models/tenant/tenantClientModels'
import { getRegistryConnection } from '../../lib/mongoose'
import { findRegistryTenantByDbName } from '../../tenant/registry-auth'
import {
  fetchEnabledEmailDynamicVariableBindings,
  type EmailDynamicVariableBinding
} from '../emailMerge/composeMergeRoot'
import { campaignRequiresPerRecipientMerge } from './campaignBatchSize'

export type CampaignSendRegistryMeta = {
  tenantDbName?: string
  brevoTenantTagValue?: string
  unsubscribeSigningSecret?: string
  unsubscribeCrmAppUrl?: string
}

export type CampaignSendRunContext = {
  templateHtml: string | null
  dynamicVariableBindings: EmailDynamicVariableBinding[]
  registry: CampaignSendRegistryMeta
  requiresPerRecipientMerge: boolean
}

type CacheEntry = {
  fullVersionKey: string
  context: CampaignSendRunContext
  cachedAt: number
}

const G = globalThis as typeof globalThis & {
  __campaignSendRunCache?: Map<string, CacheEntry>
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 64

function cacheMap(): Map<string, CacheEntry> {
  if (!G.__campaignSendRunCache) {
    G.__campaignSendRunCache = new Map()
  }
  return G.__campaignSendRunCache
}

function templateStamp(template: EmailTemplateDoc | null): number {
  if (!template || !('updatedAt' in template) || !(template.updatedAt instanceof Date)) {
    return 0
  }
  return template.updatedAt.getTime()
}

function buildFullVersionKey(campaign: CampaignLean, template: EmailTemplateDoc | null): string {
  const templateId = campaign.emailTemplate ? String(campaign.emailTemplate) : ''
  const campaignStamp =
    campaign.updatedAt instanceof Date ? campaign.updatedAt.getTime() : 0
  return `${templateId}|${templateStamp(template)}|${campaignStamp}|${campaign.subject ?? ''}`
}

function pruneCache(map: Map<string, CacheEntry>): void {
  const now = Date.now()
  for (const [key, entry] of map) {
    if (now - entry.cachedAt > CACHE_TTL_MS) map.delete(key)
  }
  while (map.size > CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next().value
    if (oldest == null) break
    map.delete(oldest)
  }
}

async function loadTemplateHtml(
  EmailTemplate: EmailTemplateModel,
  campaign: CampaignLean
): Promise<{ templateHtml: string | null; template: EmailTemplateDoc | null }> {
  if (!campaign.emailTemplate) return { templateHtml: null, template: null }
  const template = await EmailTemplate.findById(campaign.emailTemplate).lean<EmailTemplateDoc | null>()
  if (!template) return { templateHtml: null, template: null }
  const rawHtml = template.htmlTemplate ?? template.html ?? null
  const templateHtml =
    rawHtml && template.css?.trim() ? `<style>${template.css}</style>${rawHtml}` : rawHtml
  return { templateHtml, template }
}

async function loadRegistryMeta(tenantDbName: string | undefined): Promise<CampaignSendRegistryMeta> {
  if (!tenantDbName) return {}
  const meta: CampaignSendRegistryMeta = { tenantDbName, brevoTenantTagValue: tenantDbName }
  try {
    const registry = await getRegistryConnection()
    const row = await findRegistryTenantByDbName(registry, tenantDbName)
    const tid = row?.tenantId?.trim()
    if (tid) meta.brevoTenantTagValue = tid
    if (row?.clientKeyHash) meta.unsubscribeSigningSecret = row.clientKeyHash
    if (row?.crmAppUrl) meta.unsubscribeCrmAppUrl = row.crmAppUrl
  } catch {
    // Non-fatal — send can proceed with db name tag only.
  }
  return meta
}

async function isCacheStillValid(
  EmailTemplate: EmailTemplateModel,
  campaign: CampaignLean,
  entry: CacheEntry
): Promise<boolean> {
  if (Date.now() - entry.cachedAt >= CACHE_TTL_MS) return false
  if (!campaign.emailTemplate) {
    return buildFullVersionKey(campaign, null) === entry.fullVersionKey
  }
  const template = await EmailTemplate.findById(campaign.emailTemplate)
    .select('updatedAt')
    .lean<Pick<EmailTemplateDoc, 'updatedAt'> | null>()
  return buildFullVersionKey(campaign, template as EmailTemplateDoc | null) === entry.fullVersionKey
}

/**
 * In-process memo for template, dynamic-variable bindings, and registry metadata.
 * Invalidates when campaign or template `updatedAt` / subject / template id changes.
 */
export async function getCampaignSendRunContext(
  models: TenantClientModels,
  campaign: CampaignLean,
  sendRunId: string,
  tenantDbName: string | undefined
): Promise<CampaignSendRunContext> {
  const runKey = `${sendRunId}|${String(campaign._id)}`
  const map = cacheMap()
  pruneCache(map)

  const { EmailTemplate, EmailDynamicVariable } = models
  const cached = map.get(runKey)
  if (cached && (await isCacheStillValid(EmailTemplate as EmailTemplateModel, campaign, cached))) {
    return cached.context
  }

  const [{ templateHtml, template }, dynamicVariableBindings, registry] = await Promise.all([
    loadTemplateHtml(EmailTemplate as EmailTemplateModel, campaign),
    fetchEnabledEmailDynamicVariableBindings(EmailDynamicVariable as EmailDynamicVariableModel),
    loadRegistryMeta(tenantDbName)
  ])

  const context: CampaignSendRunContext = {
    templateHtml,
    dynamicVariableBindings,
    registry,
    requiresPerRecipientMerge: campaignRequiresPerRecipientMerge(
      campaign.subject || '',
      templateHtml,
      dynamicVariableBindings
    )
  }

  map.set(runKey, {
    fullVersionKey: buildFullVersionKey(campaign, template),
    context,
    cachedAt: Date.now()
  })
  return context
}

export function clearCampaignSendRunCache(sendRunId: string, campaignId: string): void {
  cacheMap().delete(`${sendRunId}|${campaignId}`)
}
