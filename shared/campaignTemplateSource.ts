/** How campaign email HTML was produced (affects editor behavior, not send merge). */
export type CampaignTemplateHtmlSource = 'editor' | 'upload'

export function campaignTemplateHtmlSourceFromMode(
  templateMode: 'scratch' | 'existing' | 'upload'
): CampaignTemplateHtmlSource {
  return templateMode === 'upload' ? 'upload' : 'editor'
}
