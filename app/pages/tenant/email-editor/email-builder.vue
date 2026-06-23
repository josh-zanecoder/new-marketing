<script setup lang="ts">
import {
  campaignEditorReturnUrl,
  campaignEmailBuilderDesignSessionKey,
  campaignTemplateSessionKey,
  EMAIL_BUILDER_IFRAME_SRC,
  EMAIL_BUILDER_MESSAGE_PREFIX,
  persistCampaignEditorSession
} from '~/composables/useCampaignEmailEditorExit'
import { ensureEmailHtmlDocument } from '~~/shared/utils/emailEditorHtml'

definePageMeta({
  layout: false
})

useHead({
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover'
    }
  ]
})

const route = useRoute()
const marketingApi = useTenantMarketingApi()
const frameRef = ref<HTMLIFrameElement | null>(null)
const editorReady = ref(false)
const saving = ref(false)
const loadError = ref('')

function queryParamString(q: unknown): string {
  if (q == null) return ''
  if (Array.isArray(q)) return typeof q[0] === 'string' ? q[0] : ''
  return typeof q === 'string' ? q : String(q)
}

const campaignId = computed(() => queryParamString(route.query.campaignId))
const builderId = computed(() => queryParamString(route.query.builderId))

function readStoredDesign(): unknown | null {
  const cid = campaignId.value
  if (!cid || typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(campaignEmailBuilderDesignSessionKey(cid))
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function postToEditor(type: string, payload?: unknown) {
  const frame = frameRef.value?.contentWindow
  if (!frame) return
  frame.postMessage({ type: `${EMAIL_BUILDER_MESSAGE_PREFIX}${type}`, payload }, window.location.origin)
}

function readStoredHtml(): string | null {
  const cid = campaignId.value
  if (!cid || typeof window === 'undefined') return null
  return window.sessionStorage.getItem(campaignTemplateSessionKey(cid))
}

function loadStoredDesignIntoEditor() {
  const document = readStoredDesign()
  const html = readStoredHtml()?.trim()

  // Prefer saved design JSON (exact per-block state) when available after Save and exit.
  if (document) {
    postToEditor('load', { document })
    return
  }

  if (html) {
    postToEditor('load', { html })
  }
}

async function sendDynamicVariablesToEditor() {
  try {
    const res = await marketingApi.fetchDynamicVariables()
    const variables = (res.variables ?? []).map((v) => ({
      key: v.key,
      label: v.label || v.key,
      scopes: v.scopes,
      enabled: v.enabled
    }))
    postToEditor('set-dynamic-variables', { variables })
  } catch {
    postToEditor('set-dynamic-variables', { variables: [] })
  }
}

function onWindowMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  const data = event.data
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return
  if (!data.type.startsWith(EMAIL_BUILDER_MESSAGE_PREFIX)) return

  if (data.type === `${EMAIL_BUILDER_MESSAGE_PREFIX}ready`) {
    editorReady.value = true
    loadStoredDesignIntoEditor()
    void sendDynamicVariablesToEditor()
    return
  }

  if (data.type === `${EMAIL_BUILDER_MESSAGE_PREFIX}request-dynamic-variables`) {
    void sendDynamicVariablesToEditor()
    return
  }

  if (data.type === `${EMAIL_BUILDER_MESSAGE_PREFIX}export` && saving.value) {
    const payload = data.payload as { html?: string; document?: unknown } | undefined
    const pageHtml = payload?.html ?? ''
    if (!pageHtml.trim()) {
      loadError.value = 'Nothing to save — add content in the editor first.'
      saving.value = false
      return
    }

    try {
      const html = ensureEmailHtmlDocument(pageHtml)
      let targetId = campaignId.value
      if (!targetId && builderId.value) {
        targetId = `temp-${Date.now()}`
      }
      if (!targetId) {
        loadError.value = 'Missing campaign id — open the editor from the campaign wizard.'
        saving.value = false
        return
      }

      persistCampaignEditorSession({
        campaignId: targetId,
        html,
        designJson: payload?.document,
        pendingForm: !campaignId.value && builderId.value
          ? {
              name: '',
              senderName: '',
              senderEmail: '',
              subject: '',
              recipientsMode: 'list',
              recipientsListId: '',
              recipientsManual: [],
              templateMode: 'scratch',
              selectedTemplateId: '',
              saveHtmlToLibrary: false
            }
          : undefined
      })

      void navigateTo(campaignEditorReturnUrl(targetId))
    } catch {
      loadError.value = 'Could not save — try again.'
      saving.value = false
    }
  }
}

function handleSaveAndExit() {
  if (!editorReady.value || saving.value) return
  saving.value = true
  loadError.value = ''
  postToEditor('request-export')
}

onMounted(() => {
  window.addEventListener('message', onWindowMessage)
  void sendDynamicVariablesToEditor()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage)
})
</script>

<template>
  <ClientOnly>
    <div class="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-slate-100 supports-[height:100dvh]:h-[100dvh]">
      <header
        class="flex shrink-0 flex-col gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-3 lg:px-8"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white md:text-base lg:text-lg">
            EmailBuilder.js
          </p>
          <p class="mt-0.5 max-w-2xl text-xs leading-snug text-slate-400 md:text-sm">
            Open-source drag-and-drop block email builder.
          </p>
        </div>
        <div class="flex w-full shrink-0 md:w-auto">
          <button
            type="button"
            class="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50 md:w-auto md:px-5 md:py-2 lg:px-6"
            :disabled="!editorReady || saving"
            @click="handleSaveAndExit"
          >
            {{ saving ? 'Saving…' : 'Save and exit' }}
          </button>
        </div>
      </header>

      <p
        v-if="loadError"
        class="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-6 lg:px-8"
        role="alert"
      >
        {{ loadError }}
      </p>

      <iframe
        ref="frameRef"
        :src="EMAIL_BUILDER_IFRAME_SRC"
        title="EmailBuilder.js editor"
        class="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>

    <template #fallback>
      <div class="flex h-[100dvh] items-center justify-center bg-slate-100">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    </template>
  </ClientOnly>
</template>
