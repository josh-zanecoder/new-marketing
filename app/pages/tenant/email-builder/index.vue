<script setup lang="ts">
definePageMeta({ layout: 'default' })

type BeefreeToken = {
  access_token: string
  v2?: boolean
}

type BeefreeEditor = {
  start: (config: Record<string, unknown>, template: Record<string, unknown>) => Promise<unknown>
}

type BeefreeSdkModule = {
  default: new (token: BeefreeToken) => BeefreeEditor
}

const CONTAINER_ID = 'beefree-email-builder'

const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const {
  allowTenantBeefreeBuilder,
  loadDefaultCampaignSender,
  loaded: beefreeFlagLoaded
} = useDefaultCampaignSender()
const toast = useAppToast()
const marketingApi = useTenantMarketingApi()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const saveOpen = ref(false)
const saveName = ref('')
const saveSubject = ref('')
const saveError = ref('')
const savePending = ref(false)
const savedTemplateId = ref<string | null>(null)

let saveHtml = ''
let startToken = 0

function readFetchMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as { data?: { message?: string } }).data
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

async function startEditor() {
  const tokenId = ++startToken
  status.value = 'loading'
  loadError.value = ''
  const mount = document.getElementById(CONTAINER_ID)
  if (mount) mount.replaceChildren()

  try {
    const token = await $fetch<BeefreeToken>('/api/v1/tenant/beefree/token', {
      method: 'POST',
      credentials: 'include'
    })
    if (tokenId !== startToken) return
    if (!token?.access_token) {
      throw new Error('Could not start the email builder')
    }

    const sdk = (await import('@beefree.io/sdk')) as BeefreeSdkModule
    if (tokenId !== startToken) return
    const bee = new sdk.default(token)
    await bee.start(
      {
        container: CONTAINER_ID,
        language: 'en-US',
        onSave: (_pageJson: string, pageHtml: string) => {
          saveHtml = pageHtml
          saveError.value = ''
          if (!saveName.value.trim()) saveName.value = 'Untitled email'
          saveOpen.value = true
        },
        onError: () => {
          toast.error('The email builder hit an error')
        }
      },
      {}
    )
    if (tokenId !== startToken) return
    status.value = 'ready'
  } catch (error) {
    if (tokenId !== startToken) return
    status.value = 'error'
    loadError.value = readFetchMessage(error, 'Could not open the email builder')
  }
}

async function confirmSave() {
  const name = saveName.value.trim()
  const subject = saveSubject.value.trim()
  if (!name) {
    saveError.value = 'Template name is required'
    return
  }
  if (!subject) {
    saveError.value = 'Default subject is required'
    return
  }
  if (!saveHtml.trim()) {
    saveError.value = 'This design has no HTML to save'
    return
  }

  savePending.value = true
  saveError.value = ''
  try {
    const body = {
      name,
      subject,
      htmlTemplate: saveHtml,
      htmlSource: 'editor' as const
    }
    if (savedTemplateId.value) {
      await marketingApi.updateEmailTemplate(savedTemplateId.value, body)
    } else {
      const created = await marketingApi.createEmailTemplate(body)
      savedTemplateId.value = created.template.id
    }
    saveOpen.value = false
    toast.success('Saved to Email templates')
  } catch (error) {
    saveError.value = readFetchMessage(error, 'Could not save this design')
  } finally {
    savePending.value = false
  }
}

function closeSave() {
  if (savePending.value) return
  saveOpen.value = false
}

function onSaveKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeSave()
}

onMounted(async () => {
  window.addEventListener('keydown', onSaveKeydown)
  if (!beefreeFlagLoaded.value) await loadDefaultCampaignSender()
  if (!allowTenantBeefreeBuilder.value) {
    await navigateTo('/tenant/dashboard')
    return
  }
  void startEditor()
})

onBeforeUnmount(() => {
  startToken += 1
  window.removeEventListener('keydown', onSaveKeydown)
})
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold text-slate-900">Email builder</h1>
        <p class="truncate text-xs text-slate-500">
          Design the email here. Save in the editor stores it under Email templates.
        </p>
      </div>
      <NuxtLink
        to="/tenant/email-templates"
        class="shrink-0 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        Email templates
      </NuxtLink>
    </header>

    <div class="relative min-h-0 flex-1">
      <div :id="CONTAINER_ID" class="h-full min-h-0" />

      <div
        v-if="status === 'loading'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100"
      >
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
        <p class="text-sm text-slate-500">Opening the email builder…</p>
      </div>

      <div
        v-else-if="status === 'error'"
        class="absolute inset-0 flex items-center justify-center bg-slate-100 p-6"
      >
        <div class="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p class="text-sm text-slate-700">{{ loadError }}</p>
          <button
            type="button"
            class="mt-4 inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            @click="startEditor"
          >
            Try again
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="saveOpen"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      @click.self="closeSave"
    >
      <form
        class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="beefree-save-title"
        @submit.prevent="confirmSave"
      >
        <h2 id="beefree-save-title" class="text-lg font-semibold text-slate-900">Save to Email templates</h2>
        <p class="mt-1 text-sm text-slate-500">
          This stores the email HTML. Opening it later in Email templates keeps that HTML.
        </p>
        <label class="mt-4 block text-sm font-medium text-slate-700" for="beefree-save-name">Template name</label>
        <input
          id="beefree-save-name"
          v-model="saveName"
          type="text"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
          autocomplete="off"
        >
        <label class="mt-4 block text-sm font-medium text-slate-700" for="beefree-save-subject">Default subject</label>
        <input
          id="beefree-save-subject"
          v-model="saveSubject"
          type="text"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
          autocomplete="off"
        >
        <p v-if="saveError" class="mt-3 text-sm text-rose-600">{{ saveError }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            :disabled="savePending"
            @click="closeSave"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            :disabled="savePending"
          >
            {{ savePending ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
