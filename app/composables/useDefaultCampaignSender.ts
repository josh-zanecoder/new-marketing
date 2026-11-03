import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'
import {
  CONTACT_OWNER_SENDER_LABEL,
  formatLoSenderDisplayName
} from '~~/shared/contactOwnerSender'
import { formatPersonDisplayName } from '~~/shared/formatPersonDisplayName'
import {
  MARKETING_AUDIENCE_ACCESS_SELF_ONLY,
  MARKETING_AUDIENCE_ACCESS_TENANT_WIDE,
  resolveMarketingAudienceAccess,
  type MarketingAudienceAccess
} from '~~/shared/marketingAudienceAccess'

export type TenantMeSessionUser = {
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  role?: string
}

export type TenantMeCampaignSender = {
  defaultCampaignSenderName?: string
  defaultCampaignSenderEmail?: string
  allowTenantEditSender?: boolean
  allowTenantLoRecipientLists?: boolean
  audienceAccess?: MarketingAudienceAccess
  canSelectAnyLoanOfficer?: boolean
  sessionUser?: TenantMeSessionUser
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
  /** Superadmin gate; false preserves read-only sender UI. */
  const allowTenantEditSender = ref(false)
  /** Superadmin gate; false preserves classic recipient-list UI. */
  const allowTenantLoRecipientLists = ref(false)
  const sessionUser = ref<TenantMeSessionUser | null>(null)
  const audienceAccess = ref<MarketingAudienceAccess>('owner_scope')
  const loaded = ref(false)

  /** LO first+last from session; used when edit-sender toggle is OFF. */
  const senderDisplayName = computed(() => {
    const session = sessionUser.value
    const fromSession = formatPersonDisplayName({
      firstName: session?.firstName,
      lastName: session?.lastName,
      name: session?.name
    })
    if (fromSession) return fromSession
    const fromParts = formatLoSenderDisplayName(
      session?.firstName,
      session?.lastName,
      session?.email
    )
    if (fromParts) return fromParts
    return CONTACT_OWNER_SENDER_LABEL
  })

  /** OM/Marketing may pick any LO; LO/LOA are locked to self. */
  const canSelectAnyLoanOfficer = computed(
    () => audienceAccess.value === MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
  )
  const isSelfOnlyAudience = computed(
    () => audienceAccess.value === MARKETING_AUDIENCE_ACCESS_SELF_ONLY
  )

  /**
   * Initial sender for new campaigns (when edit-sender toggle is ON).
   * LO/LOA → self. OM/Marketing → admin default (may be empty). Toggle OFF → session label.
   */
  const initialSenderName = computed(() => {
    if (!allowTenantEditSender.value) return senderDisplayName.value
    if (isSelfOnlyAudience.value) return senderDisplayName.value
    return defaultSenderName.value.trim()
  })

  const initialSenderEmail = computed(() => {
    if (!allowTenantEditSender.value) return defaultSenderEmail.value.trim()
    if (isSelfOnlyAudience.value) return String(sessionUser.value?.email || '').trim()
    return defaultSenderEmail.value.trim()
  })

  async function loadDefaultCampaignSender() {
    try {
      const res = await marketingApi.fetchTenantMe()
      const me = unwrapTenantMePayload(res)
      const allow = me?.allowTenantEditSender === true
      allowTenantEditSender.value = allow
      allowTenantLoRecipientLists.value = me?.allowTenantLoRecipientLists === true
      sessionUser.value =
        me?.sessionUser && typeof me.sessionUser === 'object' ? me.sessionUser : null

      // Role-based LO/OM audience only when LO-list feature flag is ON.
      if (allowTenantLoRecipientLists.value) {
        audienceAccess.value =
          me?.audienceAccess ||
          resolveMarketingAudienceAccess({
            tenantUserRole: me?.sessionUser?.role,
            tenantWideContacts: me?.canSelectAnyLoanOfficer === true
          })
      } else if (me?.canSelectAnyLoanOfficer === true) {
        audienceAccess.value = MARKETING_AUDIENCE_ACCESS_TENANT_WIDE
      } else {
        audienceAccess.value = me?.audienceAccess || 'owner_scope'
      }

      const nameFromMe = me?.defaultCampaignSenderName?.trim() || ''
      const emailFromMe = me?.defaultCampaignSenderEmail?.trim() || ''
      if (allow) {
        defaultSenderName.value = nameFromMe
        defaultSenderEmail.value = emailFromMe
      } else {
        defaultSenderName.value = nameFromMe || DEFAULT_CAMPAIGN_SENDER_NAME
        defaultSenderEmail.value = emailFromMe || DEFAULT_CAMPAIGN_SENDER_EMAIL
      }
    } catch {
      allowTenantEditSender.value = false
      allowTenantLoRecipientLists.value = false
      sessionUser.value = null
      audienceAccess.value = 'owner_scope'
      defaultSenderName.value = DEFAULT_CAMPAIGN_SENDER_NAME
      defaultSenderEmail.value = DEFAULT_CAMPAIGN_SENDER_EMAIL
    } finally {
      loaded.value = true
    }
  }

  return {
    defaultSenderName,
    defaultSenderEmail,
    allowTenantEditSender,
    allowTenantLoRecipientLists,
    sessionUser,
    audienceAccess,
    canSelectAnyLoanOfficer,
    isSelfOnlyAudience,
    senderDisplayName,
    initialSenderName,
    initialSenderEmail,
    loaded,
    loadDefaultCampaignSender
  }
}
