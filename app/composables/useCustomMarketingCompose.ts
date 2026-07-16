import {
  CUSTOM_MARKETING_DEFAULT_BODY,
  CUSTOM_MARKETING_DEFAULT_SUBJECT,
  isCustomMarketingBodyReady,
  plainTextToCustomMarketingHtml
} from '~~/shared/customMarketingEmail'
import { useCampaignStore } from '~/store/campaignStore'

interface RecipientListOption {
  id: string
  name: string
}

export function useCustomMarketingCompose() {
  const marketingApi = useTenantMarketingApi()
  const campaignStore = useCampaignStore()
  const { defaultSenderName, defaultSenderEmail, loadDefaultCampaignSender } =
    useDefaultCampaignSender()

  const subject = ref(CUSTOM_MARKETING_DEFAULT_SUBJECT)
  const body = ref(CUSTOM_MARKETING_DEFAULT_BODY)
  const recipientsListId = ref('')
  const recipientLists = ref<RecipientListOption[]>([])
  const recipientListsPending = ref(false)
  const recipientListsError = ref('')
  const saveError = ref<string | null>(null)
  const isSending = ref(false)

  const senderName = computed(() => defaultSenderName.value)
  const senderEmail = computed(() => defaultSenderEmail.value)

  const selectedListName = computed(() => {
    const id = recipientsListId.value.trim()
    if (!id) return ''
    return recipientLists.value.find((l) => l.id === id)?.name ?? ''
  })

  const canSend = computed(
    () =>
      !!recipientsListId.value.trim()
      && subject.value.trim().length > 0
      && isCustomMarketingBodyReady(body.value)
      && !isSending.value
  )

  async function loadRecipientLists(): Promise<void> {
    recipientListsPending.value = true
    recipientListsError.value = ''
    try {
      const res = await marketingApi.fetchRecipientListResource()
      recipientLists.value = (res.lists ?? []).map((l) => ({
        id: l.id,
        name: l.name
      }))
    } catch {
      recipientListsError.value = 'Could not load recipient lists.'
      recipientLists.value = []
    } finally {
      recipientListsPending.value = false
    }
  }

  async function bootstrap(): Promise<void> {
    subject.value = CUSTOM_MARKETING_DEFAULT_SUBJECT
    body.value = CUSTOM_MARKETING_DEFAULT_BODY
    await Promise.all([loadDefaultCampaignSender(), loadRecipientLists()])
  }

  async function sendCustomMarketing(): Promise<void> {
    saveError.value = null
    if (!canSend.value) {
      saveError.value = 'Select a recipient list and fill in subject and message.'
      return
    }
    isSending.value = true
    try {
      const html = plainTextToCustomMarketingHtml(body.value)
      const listName = selectedListName.value || 'recipients'
      const name = `Custom Marketing — ${listName}`.slice(0, 120)
      const created = await marketingApi.createCampaign({
        name,
        senderName: senderName.value,
        senderEmail: senderEmail.value,
        subject: subject.value.trim(),
        recipientsType: 'list',
        recipientsListId: recipientsListId.value.trim(),
        recipientsManual: [],
        templateHtml: html,
        templateHtmlSource: 'custom',
        saveHtmlToLibrary: false
      })
      const campaignId = created.id
      const sendResult = await campaignStore.sendCampaign({
        id: campaignId,
        name,
        sender: { name: senderName.value, email: senderEmail.value },
        recipientsType: 'list',
        recipientsListId: recipientsListId.value.trim(),
        subject: subject.value.trim(),
        status: 'Draft',
        recipients: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      if (sendResult.poll) {
        campaignStore.startSendStatusPolling(campaignId, async () => {
          await navigateTo(`/tenant/campaigns/${campaignId}`)
        })
      }
      await navigateTo(`/tenant/campaigns/${campaignId}`)
    } catch (e) {
      const data =
        e && typeof e === 'object' && 'data' in e
          ? (e as { data?: { message?: string; statusMessage?: string } }).data
          : undefined
      const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
      saveError.value = typeof raw === 'string' ? raw : 'Failed to send custom marketing'
    } finally {
      isSending.value = false
    }
  }

  return {
    subject,
    body,
    senderName,
    senderEmail,
    recipientsListId,
    recipientLists,
    recipientListsPending,
    recipientListsError,
    saveError,
    isSending,
    canSend,
    bootstrap,
    sendCustomMarketing
  }
}
