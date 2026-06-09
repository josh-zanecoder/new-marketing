export interface CampaignTestEmailDraftPayload {
  subject: string
  senderName: string
  senderEmail: string
  templateHtml: string
  recipientsType: 'list' | 'manual'
  recipientsListId?: string
  recipientsManual?: string[]
}

export function useCampaignTestEmail() {
  const marketingApi = useTenantMarketingApi()
  const open = ref(false)
  const recipient = ref('')
  const sending = ref(false)
  const error = ref('')
  const successModalOpen = ref(false)
  const sentToRecipient = ref('')

  function openModal(defaultRecipient?: string) {
    error.value = ''
    successModalOpen.value = false
    sentToRecipient.value = ''
    recipient.value = defaultRecipient?.trim() ?? ''
    open.value = true
  }

  function closeModal() {
    if (sending.value) return
    open.value = false
    error.value = ''
    recipient.value = ''
  }

  function closeSuccessModal() {
    successModalOpen.value = false
    sentToRecipient.value = ''
    recipient.value = ''
  }

  function extractErrorMessage(e: unknown): string {
    const data =
      e && typeof e === 'object' && 'data' in e
        ? (e as { data?: { message?: string; statusMessage?: string } }).data
        : undefined
    const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
    return typeof raw === 'string' && raw.trim() ? raw : 'Failed to send test email'
  }

  function handleSendSuccess(to: string) {
    sentToRecipient.value = to
    recipient.value = ''
    open.value = false
    error.value = ''
    successModalOpen.value = true
  }

  async function sendForCampaign(campaignId: string) {
    const to = recipient.value.trim()
    if (!to) {
      error.value = 'Enter a recipient email address'
      return
    }
    sending.value = true
    error.value = ''
    try {
      await marketingApi.sendTestEmail({ recipient: to, campaignId })
      handleSendSuccess(to)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      sending.value = false
    }
  }

  async function sendForDraft(draft: CampaignTestEmailDraftPayload) {
    const to = recipient.value.trim()
    if (!to) {
      error.value = 'Enter a recipient email address'
      return
    }
    sending.value = true
    error.value = ''
    try {
      await marketingApi.sendTestEmail({
        recipient: to,
        subject: draft.subject,
        senderName: draft.senderName,
        senderEmail: draft.senderEmail,
        templateHtml: draft.templateHtml,
        recipientsType: draft.recipientsType,
        recipientsListId: draft.recipientsListId,
        recipientsManual: draft.recipientsManual
      })
      handleSendSuccess(to)
    } catch (e: unknown) {
      error.value = extractErrorMessage(e)
    } finally {
      sending.value = false
    }
  }

  return {
    open,
    recipient,
    sending,
    error,
    successModalOpen,
    sentToRecipient,
    openModal,
    closeModal,
    closeSuccessModal,
    sendForCampaign,
    sendForDraft
  }
}
