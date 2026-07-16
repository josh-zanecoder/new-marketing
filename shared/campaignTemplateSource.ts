/** How campaign email HTML was produced (affects editor behavior, not send merge). */
export type CampaignTemplateHtmlSource = 'editor' | 'upload' | 'custom'

export type CampaignTemplateMode = 'scratch' | 'existing' | 'upload' | 'custom'

export function campaignTemplateHtmlSourceFromMode(
  templateMode: CampaignTemplateMode
): CampaignTemplateHtmlSource {
  if (templateMode === 'upload') return 'upload'
  if (templateMode === 'custom') return 'custom'
  return 'editor'
}

export function campaignTemplateModeFromHtmlSource(
  htmlSource: CampaignTemplateHtmlSource | string | null | undefined
): CampaignTemplateMode | null {
  if (htmlSource === 'upload') return 'upload'
  if (htmlSource === 'custom') return 'custom'
  if (htmlSource === 'editor') return 'scratch'
  return null
}

export function resolveCampaignTemplateHtmlSource(
  raw: string | null | undefined
): CampaignTemplateHtmlSource {
  if (raw === 'upload') return 'upload'
  if (raw === 'custom') return 'custom'
  return 'editor'
}
