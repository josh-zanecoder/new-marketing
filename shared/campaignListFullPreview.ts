import { mergeMustacheTemplate } from './utils/emailTemplateMerge'

/** Campaign list card action + modal copy. */
export const CAMPAIGN_LIST_FULL_PREVIEW_ACTION_TITLE = 'Full preview'
export const CAMPAIGN_LIST_FULL_PREVIEW_ARIA_LABEL = 'Full email preview'
export const CAMPAIGN_LIST_FULL_PREVIEW_EMPTY =
  'This campaign has no email content to preview.'
export const CAMPAIGN_LIST_FULL_PREVIEW_LOAD_ERROR =
  'Could not load campaign preview. Try again.'
export const CAMPAIGN_LIST_FULL_PREVIEW_FALLBACK_NAME = 'Campaign'
export const CAMPAIGN_LIST_FULL_PREVIEW_LOG_TAG = '[campaignListFullPreview]'

export type CampaignListFullPreviewSource = {
  name?: string | null
  subject?: string | null
  previewText?: string | null
  templateHtml?: string | null
}

export type CampaignListFullPreviewContent = {
  name: string
  subject: string
  html: string
  previewText: string
  hasHtml: boolean
}

/**
 * Build read-only list preview fields from campaign detail + merge context.
 * Does not mutate the source campaign.
 */
export function buildCampaignListFullPreviewContent(
  source: CampaignListFullPreviewSource,
  mergeRoot: Record<string, unknown> = {}
): CampaignListFullPreviewContent {
  const rawHtml = String(source.templateHtml ?? '').trim()
  const rawSubject = String(source.subject ?? '').trim()
  const rawPreviewText = String(source.previewText ?? '').trim()
  const name =
    String(source.name ?? '').trim() || CAMPAIGN_LIST_FULL_PREVIEW_FALLBACK_NAME

  return {
    name,
    subject: rawSubject ? mergeMustacheTemplate(rawSubject, mergeRoot) : '',
    html: rawHtml ? mergeMustacheTemplate(rawHtml, mergeRoot) : '',
    previewText: rawPreviewText ? mergeMustacheTemplate(rawPreviewText, mergeRoot) : '',
    hasHtml: Boolean(rawHtml)
  }
}
