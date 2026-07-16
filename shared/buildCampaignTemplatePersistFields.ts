import { campaignTemplateHtmlSourceFromMode } from './campaignTemplateSource'
import type { CampaignTemplateMode } from './campaignTemplateSource'

export type CampaignTemplatePersistInput = {
  templateMode: CampaignTemplateMode
  selectedTemplateId: string
  templateDesignModified: boolean
  linkedEmailTemplateId?: string
  savedTemplateHtml: string | null
  saveHtmlToLibrary: boolean
}

export type CampaignTemplatePersistFields =
  | { emailTemplateId: string }
  | {
      templateHtml: string
      templateHtmlSource: 'editor' | 'upload' | 'custom'
      saveHtmlToLibrary: boolean
    }

/** Prefer linking library templates; only send HTML when the design was changed. */
export function buildCampaignTemplatePersistFields(
  input: CampaignTemplatePersistInput
): CampaignTemplatePersistFields {
  if (!input.templateDesignModified) {
    const fromPick =
      input.templateMode === 'existing' && input.selectedTemplateId.trim()
        ? input.selectedTemplateId.trim()
        : ''
    const linkId = fromPick || String(input.linkedEmailTemplateId ?? '').trim()
    if (linkId && /^[a-f0-9]{24}$/i.test(linkId)) {
      return { emailTemplateId: linkId }
    }
  }

  return {
    templateHtml: input.savedTemplateHtml ?? '',
    templateHtmlSource: campaignTemplateHtmlSourceFromMode(input.templateMode),
    saveHtmlToLibrary: input.templateMode === 'custom' ? false : input.saveHtmlToLibrary
  }
}
