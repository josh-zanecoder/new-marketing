import type { EmailDynamicVariableBinding } from '../emailMerge/composeMergeRoot'
import {
  CAMPAIGN_SEND_BATCH_SIZE_MAX,
  CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED_DEFAULT,
  CAMPAIGN_SEND_BATCH_SIZE_UNIFORM_DEFAULT
} from './constants'

/**
 * True when subject/body or recipient-sourced dynamic vars can produce different HTML per contact.
 * Uniform (large) batches are only used when this is false.
 */
export function campaignRequiresPerRecipientMerge(
  subject: string,
  templateHtml: string | null,
  dynamicVariableBindings: EmailDynamicVariableBinding[]
): boolean {
  const text = `${subject}\n${templateHtml ?? ''}`
  if (/\{\{/.test(text)) return true
  return dynamicVariableBindings.some((b) => b.enabled && b.sourceType === 'recipient')
}

function clampBatchSize(n: number): number {
  return Math.max(1, Math.min(CAMPAIGN_SEND_BATCH_SIZE_MAX, Math.floor(n)))
}

export function resolveUniformCampaignBatchSize(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE_UNIFORM)
  if (Number.isFinite(raw) && raw >= 1) return clampBatchSize(raw)
  return CAMPAIGN_SEND_BATCH_SIZE_UNIFORM_DEFAULT
}

export function resolvePersonalizedCampaignBatchSize(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED)
  if (Number.isFinite(raw) && raw >= 1) return clampBatchSize(raw)
  const legacy = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE)
  if (Number.isFinite(legacy) && legacy >= 1) return clampBatchSize(legacy)
  return CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED_DEFAULT
}

export function resolveCampaignSendBatchSizeForContent(
  subject: string,
  templateHtml: string | null,
  dynamicVariableBindings: EmailDynamicVariableBinding[]
): number {
  return campaignRequiresPerRecipientMerge(subject, templateHtml, dynamicVariableBindings)
    ? resolvePersonalizedCampaignBatchSize()
    : resolveUniformCampaignBatchSize()
}
