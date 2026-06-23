const PENDING_CAMPAIGN_KEY = 'mortdash-pending-campaign'

export function campaignTemplateSessionKey(campaignId: string) {
  return `campaign-template-${campaignId}`
}

export function campaignEmailBuilderDesignSessionKey(campaignId: string) {
  return `campaign-email-builder-design-${campaignId}`
}

export function campaignEmailBuilderEditorUrl(campaignId: string): string {
  return `/tenant/email-editor/email-builder?campaignId=${encodeURIComponent(campaignId)}&token=local`
}

/** Replace staged HTML and discard block design (new upload / template pick). */
export function stageCampaignHtmlForEditor(campaignId: string, html: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(campaignTemplateSessionKey(campaignId), html)
  window.sessionStorage.removeItem(campaignEmailBuilderDesignSessionKey(campaignId))
}

/** Refresh staged HTML when re-opening the editor — keeps saved block design JSON. */
export function updateCampaignHtmlSession(campaignId: string, html: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(campaignTemplateSessionKey(campaignId), html)
}

export function clearEmailBuilderDesignSession(campaignId: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(campaignEmailBuilderDesignSessionKey(campaignId))
}

export function hasStoredEmailBuilderDesign(campaignId: string): boolean {
  if (typeof window === 'undefined') return false
  return !!window.sessionStorage.getItem(campaignEmailBuilderDesignSessionKey(campaignId))
}

export function persistCampaignEditorSession(params: {
  campaignId: string
  html: string
  designJson?: unknown
  pendingForm?: Record<string, unknown>
}) {
  if (typeof window === 'undefined') return
  const { campaignId, html, designJson, pendingForm } = params
  window.sessionStorage.setItem(campaignTemplateSessionKey(campaignId), html)
  if (designJson != null) {
    window.sessionStorage.setItem(
      campaignEmailBuilderDesignSessionKey(campaignId),
      typeof designJson === 'string' ? designJson : JSON.stringify(designJson)
    )
  }
  if (pendingForm) {
    window.sessionStorage.setItem(
      PENDING_CAMPAIGN_KEY,
      JSON.stringify({ form: pendingForm, campaignId })
    )
  }
}

export function campaignEditorReturnUrl(campaignId: string) {
  const isRealId = /^[a-f0-9]{24}$/i.test(campaignId)
  return isRealId
    ? `/tenant/campaigns/edit/${campaignId}?campaignId=${campaignId}&fromEditor=1`
    : `/tenant/campaigns/add?campaignId=${campaignId}&fromEditor=1`
}

export const EMAIL_BUILDER_IFRAME_SRC = '/email-builder-trial/index.html'

export const EMAIL_BUILDER_MESSAGE_PREFIX = 'email-builder:'
