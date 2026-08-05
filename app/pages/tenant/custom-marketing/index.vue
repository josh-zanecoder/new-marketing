<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSubjectVariableInsert } from '~/composables/useSubjectVariableInsert'
import { useTenantMarketingApi } from '~/composables/useTenantMarketingApi'
import { resolveCustomMarketingMergeVariables } from '~~/shared/customMarketingMergeVariables'

const {
  subject,
  body,
  contentSource,
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
  toEmail,
  toPlaceholder,
  listMemberTotal,
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
  sendCustomMarketing,
  unsubscribeFooterModalOpen,
  unsubscribeFooterPreviewOpen,
  unsubscribeFooterPreviewHtml,
  unsubscribeFooterModalTitle,
  unsubscribeFooterModalMessage,
  unsubscribeFooterModalConfirm,
  unsubscribeFooterModalPreview,
  closeUnsubscribeFooterModal,
  openUnsubscribeFooterPreview,
  closeUnsubscribeFooterPreview
} = useCustomMarketingCompose()

const marketingApi = useTenantMarketingApi()
const subjectField = computed({
  get: () => subject.value,
  set: (value: string) => {
    subject.value = value
  }
})
const { subjectVariable, subjectInputRef, syncSubjectCaret } = useSubjectVariableInsert(subjectField)
const subjectApiVariables = ref<Array<{ key: string; label: string; scopes?: Array<'subject' | 'body'>; enabled?: boolean }>>([])

const subjectVariableSelectOptions = computed(() => [
  { value: '', label: 'Insert variable' },
  ...resolveCustomMarketingMergeVariables(subjectApiVariables.value, 'subject').map((v) => ({
    value: `{{${v.key}}}`,
    label: v.label || v.key
  }))
])

onMounted(() => {
  void bootstrap()
  void marketingApi.fetchDynamicVariables()
    .then((res) => {
      subjectApiVariables.value = Array.isArray(res.variables) ? res.variables : []
    })
    .catch(() => {
      subjectApiVariables.value = []
    })
})
</script>

<template>
  <div class="mx-auto w-full max-w-5xl antialiased">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Custom Marketing
      </h1>
      <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
        Compose a personal-looking email, or upload an HTML template. Edit before sending in bulk.
      </p>
    </header>

    <div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">From</label>
        <p class="mt-1 text-sm text-slate-800 sm:text-[15px]">
          <span v-if="senderName || senderEmail">{{ senderName }} &lt;{{ senderEmail }}&gt;</span>
          <span v-else class="text-slate-400">Loading sender…</span>
        </p>
      </div>

      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label for="custom-marketing-list" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recipient list
        </label>
        <select
          id="custom-marketing-list"
          v-model="recipientsListId"
          class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-[15px]"
          :disabled="recipientListsPending"
        >
          <option value="">
            {{ recipientListsPending ? 'Loading lists…' : 'Choose a recipient list' }}
          </option>
          <option
            v-for="list in recipientLists"
            :key="list.id"
            :value="list.id"
          >
            {{ list.name }}
          </option>
        </select>
        <p v-if="recipientListsError" class="mt-2 text-sm text-red-600">{{ recipientListsError }}</p>
        <p
          v-else-if="!recipientListsPending && !recipientLists.length"
          class="mt-2 text-sm text-slate-500"
        >
          No recipient lists yet.
          <NuxtLink to="/tenant/recipient-list/add" class="font-semibold text-indigo-600 underline hover:text-indigo-700">
            Create one
          </NuxtLink>
        </p>
        <p v-else-if="recipientsListId && listMemberTotal > 0" class="mt-2 text-xs text-slate-500">
          {{ listMemberTotal }} contact{{ listMemberTotal === 1 ? '' : 's' }} in this list (bulk send)
        </p>
      </div>

      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label for="custom-marketing-to" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          To
        </label>
        <input
          id="custom-marketing-to"
          type="text"
          readonly
          :value="toEmail"
          :placeholder="toPlaceholder"
          class="w-full rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 sm:text-[15px]"
        >
        <p v-if="firstRecipientError" class="mt-2 text-sm text-red-600">{{ firstRecipientError }}</p>
        <p v-else-if="toEmail && listMemberTotal > 1" class="mt-2 text-xs text-slate-500">
          Showing first recipient email. Message will send to all {{ listMemberTotal }} contacts in the list.
        </p>
      </div>
      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label for="custom-marketing-subject" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Subject
        </label>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="custom-marketing-subject"
            ref="subjectInputRef"
            v-model="subject"
            type="text"
            autocomplete="off"
            placeholder="Email subject"
            class="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
            @click="syncSubjectCaret"
            @keyup="syncSubjectCaret"
            @select="syncSubjectCaret"
          >
          <TenantFilterSelect
            id="custom-marketing-subject-variable"
            v-model="subjectVariable"
            label="Insert variable"
            variant="field"
            :options="subjectVariableSelectOptions"
            class="w-full shrink-0 sm:w-44"
            @before-select="syncSubjectCaret"
          />
        </div>
      </div>

      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Content</p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="w-fit max-w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
            :class="contentSource === 'write'
              ? 'border-indigo-300 bg-indigo-50/50 text-slate-900 shadow-sm ring-1 ring-indigo-200/50'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
            @click="setContentSource('write')"
          >
            Write message
            <span class="mt-1 block text-xs font-normal text-slate-500">Rich text personal email</span>
          </button>
          <!-- Hidden for now — re-enable when HTML template upload is needed
          <button
            type="button"
            class="w-fit max-w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
            :class="contentSource === 'upload'
              ? 'border-indigo-300 bg-indigo-50/50 text-slate-900 shadow-sm ring-1 ring-indigo-200/50'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
            @click="setContentSource('upload')"
          >
            Upload HTML template
            <span class="mt-1 block text-xs font-normal text-slate-500">Use a .html file as the email</span>
          </button>
          -->
        </div>
      </div>

      <div v-if="contentSource === 'write'" class="px-5 py-4 sm:px-6 sm:py-5">
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Message
        </label>
        <ClientOnly>
          <TenantCustomMarketingRichTextEditor
            v-model="body"
            :subject="subject"
            :from-name="senderName"
            :from-email="senderEmail"
            :to-email="toEmail"
            :recipient-list-id="recipientsListId"
          />
          <template #fallback>
            <div class="min-h-[18rem] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          </template>
        </ClientOnly>
        <TenantCustomMarketingEditorTips class="mt-3" />
      </div>

      <!-- Upload HTML template UI hidden for now — set v-if to contentSource === 'upload' to restore -->
      <div v-if="false" class="px-5 py-4 sm:px-6 sm:py-5">
        <div class="flex flex-wrap items-center gap-3">
          <input
            ref="fileInputRef"
            type="file"
            accept=".html,.htm,text/html"
            class="sr-only"
            :disabled="uploadPending"
            @change="onTemplateFileChange"
          >
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            :disabled="uploadPending"
            @click="openFilePicker"
          >
            {{ uploadPending ? 'Reading file…' : 'Choose HTML file' }}
          </button>
          <button
            v-if="uploadedFileName"
            type="button"
            class="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            @click="clearUploadedTemplate"
          >
            Clear
          </button>
        </div>
        <p v-if="uploadedFileName" class="mt-3 text-sm text-slate-700">
          Template: <span class="font-medium">{{ uploadedFileName }}</span>
        </p>
        <p v-if="uploadError" class="mt-2 text-sm text-red-600">{{ uploadError }}</p>
        <p class="mt-2 text-xs text-slate-500">
          Uploaded HTML is sent as-is (same as campaign HTML upload). Merge tags are supported.
        </p>
        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div
            v-if="hasUploadedTemplate"
            class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5"
          >
            <p class="truncate text-xs font-medium text-slate-500">Preview</p>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              @click="openPreviewFullscreen"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Full screen
            </button>
          </div>
          <div class="relative h-[min(72vh,720px)] min-h-[420px]">
            <div
              v-if="!hasUploadedTemplate"
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p class="text-sm font-medium text-slate-500">Upload an HTML template to preview</p>
            </div>
            <iframe
              v-else
              :srcdoc="uploadPreviewSrcdoc"
              title="Uploaded template preview"
              class="absolute inset-0 h-full w-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="previewFullscreenOpen && hasUploadedTemplate"
        class="fixed inset-0 z-[90] flex flex-col bg-slate-950/50 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="Template full screen preview"
      >
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">
              {{ uploadedFileName || 'Template preview' }}
            </p>
            <p class="text-xs text-slate-500">Full screen preview — press Esc to close</p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            @click="closePreviewFullscreen"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>
        <div class="min-h-0 flex-1 bg-white p-0">
          <iframe
            :srcdoc="uploadPreviewSrcdoc"
            title="Uploaded template full screen preview"
            class="h-full w-full border-0"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </Teleport>

    <div
      v-if="gmailClipWarning"
      class="mt-4 rounded-2xl border border-amber-200/90 bg-amber-50 px-5 py-4 text-sm text-amber-950"
      role="status"
    >
      {{ gmailClipWarning }}
    </div>

    <div
      v-if="saveError"
      class="mt-4 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900"
      role="alert"
    >
      {{ saveError }}
    </div>

    <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        class="inline-flex w-full items-center justify-center rounded-xl border border-sky-200/90 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-950 shadow-sm shadow-sky-900/[0.06] ring-1 ring-sky-100/80 transition-colors hover:bg-sky-100/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        :disabled="!canSend || sendBusy"
        @click="openScheduleModal"
      >
        Schedule send
      </button>
      <button
        type="button"
        class="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        :disabled="!canSend || sendBusy"
        @click="sendCustomMarketing"
      >
        {{ isSending ? 'Sending…' : 'Send' }}
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="scheduleModalOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-marketing-schedule-title"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeScheduleModal"
        />
        <div
          class="relative w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:rounded-2xl sm:p-6 sm:pb-6"
          @click.stop
        >
          <h2 id="custom-marketing-schedule-title" class="text-lg font-semibold text-slate-900">
            Schedule send
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Your message will be saved as a campaign, then set to send at the time below (your local time).
          </p>
          <label class="mt-4 block text-sm font-medium text-slate-700" for="custom-marketing-schedule-datetime">
            Date &amp; time
          </label>
          <input
            id="custom-marketing-schedule-datetime"
            v-model="scheduleLocal"
            type="datetime-local"
            class="mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
          >
          <p v-if="scheduleError" class="mt-3 text-sm text-red-600" role="alert">
            {{ scheduleError }}
          </p>
          <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:order-2 sm:w-auto"
              :disabled="sendBusy"
              @click="confirmScheduleCustomMarketing"
            >
              {{ scheduleSubmitting ? 'Scheduling…' : 'Schedule' }}
            </button>
            <button
              type="button"
              class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:order-1 sm:w-auto"
              :disabled="sendBusy"
              @click="closeScheduleModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <TenantUnsubscribeFooterAppendedModal
      :open="unsubscribeFooterModalOpen"
      :title="unsubscribeFooterModalTitle"
      :message="unsubscribeFooterModalMessage"
      :confirm-text="unsubscribeFooterModalConfirm"
      :preview-text="unsubscribeFooterModalPreview"
      @preview="openUnsubscribeFooterPreview"
      @close="closeUnsubscribeFooterModal"
    />
    <TenantEmailTemplatePreviewModal
      :open="unsubscribeFooterPreviewOpen"
      name="Custom marketing"
      :subject="subject"
      :html="unsubscribeFooterPreviewHtml"
      elevated
      @close="closeUnsubscribeFooterPreview"
    />
  </div>
</template>
