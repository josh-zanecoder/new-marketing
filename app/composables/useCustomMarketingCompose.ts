import {
  CUSTOM_MARKETING_DEFAULT_BODY,
  CUSTOM_MARKETING_DEFAULT_SUBJECT,
  isCustomMarketingContentReady,
  resolveCustomMarketingSendHtml,
  type CustomMarketingContentSource
} from '~~/shared/customMarketingEmail'
import { normalizeUploadedEmailHtml, readUploadedHtmlFile } from '~~/shared/utils/uploadedEmailHtml'
import { useCampaignStore } from '~/store/campaignStore'

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
  const body = ref(CUSTOM_MARKETING_DEFAULT_BODY)
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

  const canSend = computed(
    () =>
      !!recipientsListId.value.trim()
      && subject.value.trim().length > 0
      && isCustomMarketingContentReady({
        contentSource: contentSource.value,
        plainBody: body.value,
        uploadedHtml: uploadedHtml.value
      })
      && !isSending.value
      && !uploadPending.value
  )

  const uploadPreviewSrcdoc = computed(() => uploadedHtml.value.trim())

  const hasUploadedTemplate = computed(() => uploadedHtml.value.trim().length > 0)
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
    body.value = CUSTOM_MARKETING_DEFAULT_BODY
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

  async function sendCustomMarketing(): Promise<void> {
    saveError.value = null
    if (!canSend.value) {
      saveError.value = 'Select a recipient list and provide a subject and message or uploaded template.'
      return
    }
    isSending.value = true
    try {
      const html = resolveCustomMarketingSendHtml({
        contentSource: contentSource.value,
        plainBody: body.value,
        uploadedHtml: uploadedHtml.value
      })
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
    listMemberTotal,
    firstRecipientPending,
    firstRecipientError,
    saveError,
    isSending,
    canSend,
    bootstrap,
    setContentSource,
    clearUploadedTemplate,
    openFilePicker,
    onTemplateFileChange,
    sendCustomMarketing
  }
}
