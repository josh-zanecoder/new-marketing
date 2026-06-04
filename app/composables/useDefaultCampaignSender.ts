import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'

export type TenantMeCampaignSender = {
  defaultCampaignSenderName?: string
  defaultCampaignSenderEmail?: string
}

/** `/api/v1/tenant/me` returns `{ me: { ... } }`. */
export function unwrapTenantMePayload(payload: unknown): TenantMeCampaignSender | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const nested = obj.me
  if (nested && typeof nested === 'object') {
    return nested as TenantMeCampaignSender
  }
  return obj as TenantMeCampaignSender
}

export function useDefaultCampaignSender() {
  const marketingApi = useTenantMarketingApi()
  const defaultSenderName = ref(DEFAULT_CAMPAIGN_SENDER_NAME)
  const defaultSenderEmail = ref(DEFAULT_CAMPAIGN_SENDER_EMAIL)
  const loaded = ref(false)

  async function loadDefaultCampaignSender() {
    try {
      const res = await marketingApi.fetchTenantMe()
      const me = unwrapTenantMePayload(res)
      if (me?.defaultCampaignSenderName?.trim()) {
        defaultSenderName.value = me.defaultCampaignSenderName.trim()
      }
      if (me?.defaultCampaignSenderEmail?.trim()) {
        defaultSenderEmail.value = me.defaultCampaignSenderEmail.trim()
      }
    } catch {
      // Keep shared fallbacks when /tenant/me is unavailable.
    } finally {
      loaded.value = true
    }
  }

  return { defaultSenderName, defaultSenderEmail, loaded, loadDefaultCampaignSender }
}
