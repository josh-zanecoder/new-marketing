import { campaignTemplateHtmlSourceFromMode } from './campaignTemplateSource'
import { normalizeEmailTemplateForStorage } from './utils/emailEditorHtml'

/** Campaign wizard → API: always a full HTML document for DB and send. */
export function prepareCampaignTemplateHtml(
  html: string,
  templateMode: 'scratch' | 'existing' | 'upload'
): string {
  return normalizeEmailTemplateForStorage(
    html,
    campaignTemplateHtmlSourceFromMode(templateMode)
  )
}
