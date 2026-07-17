import {
  CUSTOM_MARKETING_DEFAULT_BODY_HTML,
  CUSTOM_MARKETING_DEFAULT_SUBJECT,
  isCustomMarketingContentReady,
  resolveCustomMarketingSendHtml,
  type CustomMarketingContentSource
} from '~~/shared/customMarketingEmail'
import {
  customMarketingGmailClipWarning,
  isCustomMarketingHtmlOverGmailClip
} from '~~/shared/customMarketingEmailSize'
import {
  defaultScheduleDatetimeLocal,
  parseDatetimeLocalToIso
} from '~~/shared/datetimeLocal'
import { normalizeUploadedEmailHtml, readUploadedHtmlFile } from '~~/shared/utils/uploadedEmailHtml'
import { useCampaignStore } from '~/store/campaignStore'
import { useMarketingScrollLock } from '~/composables/useMarketingScrollLock'

interface RecipientListOption {
  id: string
  name: string
}

interface FirstRecipientPreview {
  id: string
  name: string
  email: string
}

export function useCustomMarketingCompose() {
  const marketingApi = useTenantMarketingApi()
  const campaignStore = useCampaignStore()
  const { defaultSenderName, defaultSenderEmail, loadDefaultCampaignSender } =
    useDefaultCampaignSender()

  const subject = ref(CUSTOM_MARKETING_DEFAULT_SUBJECT)
  const body = ref(CUSTOM_MARKETING_DEFAULT_BODY_HTML)
  const contentSource = ref<CustomMarketingContentSource>('write')
  const uploadedHtml = ref('')
  const uploadedFileName = ref('')
  const uploadPending = ref(false)
  const uploadError = ref('')
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const recipientsListId = ref('')
  const recipientLists = ref<RecipientListOption[]>([])
  const recipientListsPending = ref(false)
  const recipientListsError = ref('')
  const firstRecipient = ref<FirstRecipientPreview | null>(null)
  const listMemberTotal = ref(0)
  const firstRecipientPending = ref(false)
  const firstRecipientError = ref('')
  const saveError = ref<string | null>(null)
  const isSending = ref(false)
  const scheduleModalOpen = ref(false)
  const scheduleLocal = ref('')
  const scheduleError = ref('')
  const scheduleSubmitting = ref(false)

  useMarketingScrollLock(scheduleModalOpen)

  const senderName = computed(() => defaultSenderName.value)
  const senderEmail = computed(() => defaultSenderEmail.value)

  const selectedListName = computed(() => {
    const id = recipientsListId.value.trim()
    if (!id) return ''
    return recipientLists.value.find((l) => l.id === id)?.name ?? ''
  })

  const firstRecipientLabel = computed(() => {
    const row = firstRecipient.value
    if (!row) return ''
    const name = row.name.trim()
    const email = row.email.trim()
    if (name && email) return `${name} · ${email}`
    return email || name || 'Unknown contact'
  })

  const toEmail = computed(() => firstRecipient.value?.email?.trim() || '')

  const toPlaceholder = computed(() => {
    if (!recipientsListId.value.trim()) return 'Select a recipient list to see the email'
    if (firstRecipientPending.value) return 'Loading recipient email…'
    if (firstRecipientError.value) return 'Could not load recipient email'
    return 'This list has no contacts yet'
  })

  const canSend = computed(
    () =>
      !!recipientsListId.value.trim()
      && subject.value.trim().length > 0
      && isCustomMarketingContentReady({
        contentSource: contentSource.value,
        bodyHtml: body.value,
        uploadedHtml: uploadedHtml.value
      })
      && !isSending.value
      && !scheduleSubmitting.value
      && !uploadPending.value
  )

  const sendBusy = computed(() => isSending.value || scheduleSubmitting.value)

  const uploadPreviewSrcdoc = computed(() => uploadedHtml.value.trim())

  const hasUploadedTemplate = computed(() => uploadedHtml.value.trim().length > 0)

  const sendHtmlPreview = computed(() =>
    resolveCustomMarketingSendHtml({
      contentSource: contentSource.value,
      bodyHtml: body.value,
      uploadedHtml: uploadedHtml.value
    })
  )

  const gmailClipWarning = computed(() => customMarketingGmailClipWarning(sendHtmlPreview.value))
  const previewFullscreenOpen = ref(false)

  function openPreviewFullscreen(): void {
    if (!hasUploadedTemplate.value) return
    previewFullscreenOpen.value = true
  }

  function closePreviewFullscreen(): void {
    previewFullscreenOpen.value = false
  }

  function onPreviewKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && previewFullscreenOpen.value) {
      e.preventDefault()
      closePreviewFullscreen()
    }
  }

  onMounted(() => {
    if (import.meta.client) window.addEventListener('keydown', onPreviewKeydown)
  })

  onUnmounted(() => {
    if (import.meta.client) window.removeEventListener('keydown', onPreviewKeydown)
  })

  watch(previewFullscreenOpen, (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  })

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

  async function loadFirstRecipient(listId: string): Promise<void> {
    const id = listId.trim()
    if (!id) {
      firstRecipient.value = null
      listMemberTotal.value = 0
      firstRecipientError.value = ''
      return
    }
    firstRecipientPending.value = true
    firstRecipientError.value = ''
    try {
      const res = await marketingApi.fetchRecipientListById(id, { page: 1, limit: 1 })
      listMemberTotal.value = res.members?.total ?? 0
      const first = res.members?.items?.[0]
      if (!first) {
        firstRecipient.value = null
        return
      }
      firstRecipient.value = {
        id: first.id,
        name: first.name || '',
        email: first.email || ''
      }
    } catch {
      firstRecipient.value = null
      listMemberTotal.value = 0
      firstRecipientError.value = 'Could not load the first recipient for this list.'
    } finally {
      firstRecipientPending.value = false
    }
  }

  watch(
    recipientsListId,
    (id) => {
      void loadFirstRecipient(id)
    },
    { immediate: true }
  )

  async function bootstrap(): Promise<void> {
    subject.value = CUSTOM_MARKETING_DEFAULT_SUBJECT
    body.value = CUSTOM_MARKETING_DEFAULT_BODY_HTML
    contentSource.value = 'write'
    uploadedHtml.value = ''
    uploadedFileName.value = ''
    uploadError.value = ''
    firstRecipient.value = null
    listMemberTotal.value = 0
    firstRecipientError.value = ''
    await Promise.all([loadDefaultCampaignSender(), loadRecipientLists()])
  }

  function setContentSource(source: CustomMarketingContentSource): void {
    contentSource.value = source
    uploadError.value = ''
    saveError.value = null
  }

  function clearUploadedTemplate(): void {
    uploadedHtml.value = ''
    uploadedFileName.value = ''
    uploadError.value = ''
    previewFullscreenOpen.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }

  function openFilePicker(): void {
    fileInputRef.value?.click()
  }

  async function applyUploadedHtml(html: string, fileName: string): Promise<void> {
    uploadedHtml.value = normalizeUploadedEmailHtml(html)
    uploadedFileName.value = fileName
    contentSource.value = 'upload'
    uploadError.value = ''
  }

  async function onTemplateFileChange(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    uploadPending.value = true
    uploadError.value = ''
    try {
      const html = await readUploadedHtmlFile(file)
      await applyUploadedHtml(html, file.name)
    } catch (e) {
      uploadError.value = e instanceof Error ? e.message : 'Could not read HTML file'
      clearUploadedTemplate()
    } finally {
      uploadPending.value = false
      if (input) input.value = ''
    }
  }

  function catchApiMessage(e: unknown, fallback: string): string {
    const data =
      e && typeof e === 'object' && 'data' in e
        ? (e as { data?: { message?: string; statusMessage?: string } }).data
        : undefined
    const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
    return typeof raw === 'string' ? raw : fallback
  }

  function resolveSendHtmlOrSetError(): string | null {
    const html = resolveCustomMarketingSendHtml({
      contentSource: contentSource.value,
      bodyHtml: body.value,
      uploadedHtml: uploadedHtml.value
    })
    if (isCustomMarketingHtmlOverGmailClip(html)) {
      saveError.value =
        customMarketingGmailClipWarning(html)
        ?? 'Email HTML is too large for Gmail. Remove or shrink photos before sending.'
      return null
    }
    return html
  }

  async function createCustomMarketingCampaign(html: string): Promise<{ id: string; name: string }> {
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
    return { id: created.id, name }
  }

  function openScheduleModal(): void {
    if (!canSend.value) return
    saveError.value = null
    scheduleError.value = ''
    scheduleLocal.value = defaultScheduleDatetimeLocal()
    scheduleModalOpen.value = true
  }

  function closeScheduleModal(): void {
    if (scheduleSubmitting.value) return
    scheduleModalOpen.value = false
    scheduleError.value = ''
  }

  async function confirmScheduleCustomMarketing(): Promise<void> {
    saveError.value = null
    scheduleError.value = ''
    if (!canSend.value) {
      saveError.value = 'Select a recipient list and provide a subject and message or uploaded template.'
      return
    }
    const scheduledIso = parseDatetimeLocalToIso(scheduleLocal.value)
    if (!scheduledIso) {
      scheduleError.value = 'Pick a valid date and time.'
      return
    }
    const html = resolveSendHtmlOrSetError()
    if (!html) return
    scheduleSubmitting.value = true
    try {
      const { id } = await createCustomMarketingCampaign(html)
      try {
        await marketingApi.scheduleCampaignSend(id, scheduledIso)
        scheduleModalOpen.value = false
        const now = new Date().toISOString()
        campaignStore.patchCampaignDetailCache(id, {
          status: 'Scheduled',
          scheduledAt: scheduledIso,
          updatedAt: now
        })
        void campaignStore.fetchCampaigns({ force: true })
        await navigateTo(`/tenant/campaigns/${id}`)
      } catch (e) {
        scheduleError.value = catchApiMessage(e, 'Could not schedule send.')
      }
    } catch (e) {
      saveError.value = catchApiMessage(e, 'Failed to save custom marketing for scheduling')
      scheduleModalOpen.value = false
    } finally {
      scheduleSubmitting.value = false
    }
  }

  async function sendCustomMarketing(): Promise<void> {
    saveError.value = null
    if (!canSend.value) {
      saveError.value = 'Select a recipient list and provide a subject and message or uploaded template.'
      return
    }
    const html = resolveSendHtmlOrSetError()
    if (!html) return
    isSending.value = true
    try {
      const { id: campaignId, name } = await createCustomMarketingCampaign(html)
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
      saveError.value = catchApiMessage(e, 'Failed to send custom marketing')
    } finally {
      isSending.value = false
    }
  }

  return {
    subject,
    body,
    contentSource,
    uploadedHtml,
    uploadedFileName,
    uploadPending,
    uploadError,
    fileInputRef,
    uploadPreviewSrcdoc,
    hasUploadedTemplate,
    previewFullscreenOpen,
    openPreviewFullscreen,
    closePreviewFullscreen,
    senderName,
    senderEmail,
    recipientsListId,
    recipientLists,
    recipientListsPending,
    recipientListsError,
    firstRecipient,
    firstRecipientLabel,
    toEmail,
    toPlaceholder,
    listMemberTotal,
    firstRecipientPending,
    firstRecipientError,
    saveError,
    gmailClipWarning,
    isSending,
    sendBusy,
    canSend,
    scheduleModalOpen,
    scheduleLocal,
    scheduleError,
    scheduleSubmitting,
    openScheduleModal,
    closeScheduleModal,
    confirmScheduleCustomMarketing,
    bootstrap,
    setContentSource,
    clearUploadedTemplate,
    openFilePicker,
    onTemplateFileChange,
    sendCustomMarketing
  }
}
