<template>
  <div class="w-full min-w-0">
    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl 2xl:max-w-7xl">
      <NuxtLink
        :to="cancelOrBackHref"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        {{ cancelOrBackLabel }}
      </NuxtLink>

      <div v-if="showEditSkeleton" class="mb-12 space-y-10 animate-pulse">
        <header class="space-y-4">
          <div class="h-4 w-40 rounded-md bg-zinc-200" />
          <div class="h-11 max-w-md rounded-lg bg-zinc-200" />
          <div class="h-5 max-w-xl rounded-md bg-zinc-200" />
          <div class="h-5 w-2/3 max-w-lg rounded-md bg-zinc-200" />
        </header>
        <div class="space-y-3">
          <div class="h-5 w-36 rounded bg-zinc-200" />
          <div class="h-14 w-full rounded-xl bg-zinc-200" />
        </div>
        <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 border-b border-zinc-100 px-5 py-4 last:border-b-0 sm:px-6 sm:py-5">
            <div class="h-12 w-12 shrink-0 rounded-xl bg-zinc-200" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-5 w-32 rounded bg-zinc-200" />
              <div class="h-4 max-w-sm rounded bg-zinc-200" />
            </div>
            <div class="h-10 w-28 shrink-0 rounded-lg bg-zinc-200" />
          </div>
        </div>
        <div class="flex justify-end gap-4 pt-4">
          <div class="h-12 w-28 rounded-xl bg-zinc-200" />
          <div class="h-12 w-44 rounded-xl bg-zinc-200" />
        </div>
      </div>

      <template v-else>
      <header class="mb-8 sm:mb-10">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {{ isEditMode ? 'Edit campaign' : 'Create campaign' }}
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
          Configure your campaign step by step: name, recipients, design, and subject.
        </p>
      </header>

      <div class="space-y-6">
        <div>
          <label class="mb-2 block text-sm font-medium text-zinc-700">
            Campaign name
            <span class="ml-0.5 text-red-600" aria-hidden="true">*</span>
            <span class="sr-only">(required)</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            aria-required="true"
            autocomplete="off"
            placeholder="e.g. Q1 Newsletter"
            class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
          >
        </div>

        <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
        <!-- Sender (read-only; values from account defaults or existing campaign) -->
        <div class="border-b border-zinc-100 last:border-b-0">
          <div class="flex w-full items-center gap-4 px-5 py-4 sm:px-6 sm:py-5">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 sm:h-12 sm:w-12"
            >
              <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-base font-semibold text-zinc-900">Sender</div>
              <div class="mt-0.5 text-sm text-zinc-600 sm:text-[15px]">
                {{ form.senderName }} &lt;{{ form.senderEmail }}&gt;
              </div>
            </div>
          </div>
        </div>

        <!-- Recipients -->
        <div class="border-b border-zinc-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50/50 sm:gap-5 sm:px-6 sm:py-5"
            @click="recipientsOpen = !recipientsOpen"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="recipientsComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-600'"
              >
                <svg v-if="recipientsComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-zinc-900">Recipients</div>
                <div class="mt-0.5 text-sm text-zinc-500 sm:text-[15px]">{{ recipientsDescription }}</div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:px-4 sm:text-[15px]">{{ recipientsOpen ? 'Close' : 'Add recipients' }}</span>
          </button>
          <div v-if="recipientsOpen" class="border-t border-zinc-100 bg-zinc-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <div class="space-y-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  :class="[
                    'rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors sm:px-5 sm:py-4 sm:text-[15px]',
                    form.recipientsMode === 'list'
                      ? 'border-zinc-300 bg-white text-zinc-900 shadow-sm'
                      : 'border-zinc-200 bg-white/60 text-zinc-600 hover:bg-white'
                  ]"
                  @click="form.recipientsMode = 'list'"
                >
                  Use a list
                  <div class="mt-1.5 text-sm font-normal text-zinc-500">Pick from saved recipient lists</div>
                </button>
                <button
                  type="button"
                  :class="[
                    'rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors sm:px-5 sm:py-4 sm:text-[15px]',
                    form.recipientsMode === 'manual'
                      ? 'border-zinc-300 bg-white text-zinc-900 shadow-sm'
                      : 'border-zinc-200 bg-white/60 text-zinc-600 hover:bg-white'
                  ]"
                  @click="form.recipientsMode = 'manual'"
                >
                  Enter manually
                  <div class="mt-1.5 text-sm font-normal text-zinc-500">Pick from CRM contacts or upload a spreadsheet</div>
                </button>
              </div>
              <div v-if="form.recipientsMode === 'list'">
                <label class="mb-2 block text-sm font-medium text-zinc-700">Recipient list</label>
                <select
                  v-model="form.recipientsListId"
                  class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 sm:text-[15px]"
                  :disabled="recipientListsPending"
                >
                  <option value="">
                    {{ recipientListsPending ? 'Loading lists…' : 'Choose a list' }}
                  </option>
                  <option
                    v-for="list in recipientLists"
                    :key="list.id"
                    :value="list.id"
                  >
                    {{ list.name }}
                  </option>
                </select>
                <p
                  v-if="recipientListsError"
                  class="mt-2 text-sm text-red-600"
                >
                  {{ recipientListsError }}
                </p>
                <p
                  v-else-if="!recipientListsPending && !recipientLists.length"
                  class="mt-2 text-sm text-zinc-500"
                >
                  No recipient lists yet.
                  <NuxtLink
                    to="/tenant/recipient-list/add"
                    class="font-medium text-zinc-700 underline hover:text-zinc-900"
                  >
                    Create one
                  </NuxtLink>
                </p>
              </div>
              <div v-else class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <label class="text-sm font-medium text-zinc-700 sm:text-[15px]">Recipients</label>
                  <div class="flex items-center gap-2">
                    <a
                      href="#"
                      class="text-sm font-medium text-zinc-600 hover:text-zinc-900 underline"
                      @click.prevent="downloadSampleExcel"
                    >
                      Download sample
                    </a>
                    <span class="text-zinc-300">|</span>
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept=".xlsx,.xls"
                      class="hidden"
                      @change="handleBulkUpload"
                    >
                    <button
                      type="button"
                      class="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                      :disabled="isUploading"
                      @click="fileInputRef?.click()"
                    >
                      {{ isUploading ? 'Uploading...' : 'Upload Excel' }}
                    </button>
                    <span class="text-zinc-300">|</span>
                    <button
                      type="button"
                      class="text-sm font-medium text-zinc-600 hover:text-zinc-900"
                      @click="openContactsPicker"
                    >
                      Add from contacts
                    </button>
                  </div>
                </div>
                <p v-if="bulkUploadError" class="text-sm text-red-600">{{ bulkUploadError }}</p>
                <p
                  v-if="!manualRecipientsListed.length"
                  class="rounded-xl border border-dashed border-zinc-200/90 bg-white/80 px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No recipients yet. Use <span class="font-medium text-zinc-700">Add from contacts</span> or <span class="font-medium text-zinc-700">Upload Excel</span>.
                </p>
                <ul v-else class="divide-y divide-zinc-100 rounded-xl border border-zinc-200/90 bg-white">
                  <li
                    v-for="(row, idx) in manualRecipientsListed"
                    :key="row.contactId + '-' + idx"
                    class="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span class="min-w-0 truncate text-sm text-zinc-900" :title="row.email">{{ row.displayLine }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm transition hover:bg-zinc-50"
                      @click="removeManualRecipientById(row.contactId)"
                    >
                      Remove
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Design -->
        <div ref="designSectionRef" class="border-b border-zinc-100">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50/50 sm:gap-5 sm:px-6 sm:py-5"
            @click="openDesignModal"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="designComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-600'"
              >
                <svg v-if="designComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-zinc-900">Design</div>
                <div class="mt-0.5 text-sm text-zinc-500 sm:text-[15px]">
                  {{ designStepSubtitle }}
                </div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:px-4 sm:text-[15px]">{{ designSectionToggleLabel }}</span>
          </button>
          <div v-if="savedTemplateHtml" class="border-t border-zinc-100 bg-zinc-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <div class="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
              <div class="flex flex-col gap-4 border-b border-zinc-100 bg-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <h3 class="text-base font-semibold text-zinc-900">Current email design</h3>
                  <p class="mt-1 text-sm text-zinc-500">{{ designSourceSummary }}</p>
                </div>
                <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    class="rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                    @click="confirmChangeDesign"
                  >
                    Change design
                  </button>
                  <button
                    v-if="designEditorCampaignId"
                    type="button"
                    class="rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800"
                    @click="openEditorWithCurrentDesign"
                  >
                    Edit in editor
                  </button>
                </div>
              </div>
              <div class="relative min-h-[280px] max-h-[min(480px,55vh)] overflow-auto bg-[#f8f4ef]">
                <iframe
                  :srcdoc="previewSrcdoc(addCampaignDesignPreviewHtml || '')"
                  title="Email preview"
                  class="absolute inset-0 h-full w-full border-0"
                  sandbox="allow-same-origin"
                />
              </div>
              <p v-if="!designEditorCampaignId" class="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
                Save the campaign once to get a stable link for the editor.
              </p>
            </div>
          </div>
        </div>

        <ClientEmailTemlatesSelection
          v-model="designModalOpen"
          :templates="existingTemplates"
          :pending="emailTemplatesPending"
          :error="emailTemplatesError"
          @create-from-scratch="handleCreateFromScratch"
          @select-template="handleUseTemplate"
        />

        <ClientConfirmationModal
          :open="changeDesignConfirmOpen"
          title="Change design?"
          message="Changing design will replace your current email. All unsaved changes will be lost."
          confirm-text="Continue"
          cancel-text="Cancel"
          variant="danger"
          @confirm="onChangeDesignConfirmed"
          @cancel="changeDesignConfirmOpen = false"
        />

        <!-- Subject -->
        <div class="border-b border-zinc-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50/50 sm:gap-5 sm:px-6 sm:py-5"
            @click="subjectOpen = !subjectOpen"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="subjectComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-600'"
              >
                <svg v-if="subjectComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-zinc-900">Subject</div>
                <div class="mt-0.5 truncate text-sm text-zinc-500 sm:text-[15px]">{{ form.subject || 'Add a subject line for this campaign' }}</div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:px-4 sm:text-[15px]">{{ subjectOpen ? 'Close' : 'Manage' }}</span>
          </button>
          <div v-if="subjectOpen" class="border-t border-zinc-100 bg-zinc-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <label class="mb-2 block text-sm font-medium text-zinc-700">Subject line</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="form.subject"
                type="text"
                placeholder="Enter email subject line"
                class="min-w-0 flex-1 rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
              >
              <select
                v-model="subjectVariable"
                class="w-full shrink-0 rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:w-44 sm:text-[15px]"
              >
                <option value="">Insert variable</option>
                <option v-for="v in subjectVariables" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="saveError"
        class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900 shadow-sm"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {{ saveError }}
      </div>
      <div
        v-if="sendError && !sendingCampaignId"
        class="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-50/30 px-4 py-3.5 text-sm text-amber-950 shadow-sm shadow-amber-900/5"
        role="status"
      >
        <div class="mt-0.5 shrink-0 text-amber-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-amber-950">Send failed</p>
          <p class="mt-1 text-amber-900/90">{{ sendError }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 self-start rounded-lg px-2 py-1 text-sm font-medium text-amber-900 transition hover:bg-amber-100/80"
          @click="campaignStore.clearSendModal()"
        >
          Dismiss
        </button>
      </div>
      <div class="flex flex-col items-stretch gap-3 pt-8 sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:pt-10">
        <NuxtLink
          :to="cancelOrBackHref"
          class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:text-[15px]"
          :class="{ 'pointer-events-none opacity-50': wizardSendBusy }"
        >
          Cancel
        </NuxtLink>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <button
            v-if="campaignFormComplete"
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-emerald-200/90 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100/90 disabled:opacity-50 sm:px-6 sm:text-[15px]"
            :disabled="wizardSendBusy"
            @click.prevent="handleSendFromWizard"
          >
            {{
              isSaving
                ? 'Saving...'
                : sendingCampaignId
                  ? 'Sending...'
                  : 'Send'
            }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 sm:px-8 sm:text-[15px]"
            :disabled="saveCampaignActionDisabled"
            @click.prevent="handleCreate"
          >
            {{ isSaving ? 'Saving...' : 'Save campaign' }}
          </button>
        </div>
      </div>
    </div>
      </template>

    <ClientSendProgressModal
      :open="!!sendingCampaignId"
      :campaign-name="campaignNameForSendModal"
      :send-error="sendError"
      :send-progress="sendProgress"
      @close="closeSendModal"
    />

    <Teleport to="body">
      <div
        v-if="contactsPickerOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contacts-picker-title"
      >
        <div
          class="absolute inset-0 bg-zinc-950/55 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="closeContactsPicker"
        />
        <div
          class="relative flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-zinc-200/90 sm:max-h-[85vh] sm:rounded-2xl"
        >
          <div class="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
            <div class="min-w-0">
              <h2 id="contacts-picker-title" class="text-base font-semibold text-zinc-900">
                Add from contacts
              </h2>
              <p class="mt-1 text-sm text-zinc-500">
                Choose people already in your CRM. Their email is added to this campaign.
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close"
              @click="closeContactsPicker"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="shrink-0 border-b border-zinc-100 px-5 py-3 sm:px-6">
            <label class="sr-only" for="contact-picker-search">Search contacts</label>
            <input
              id="contact-picker-search"
              v-model="contactPickerSearch"
              type="search"
              autocomplete="off"
              placeholder="Search by name or email…"
              class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
            <p v-if="contactsCatalogError" class="text-sm text-red-600">
              {{ contactsCatalogError }}
            </p>
            <div
              v-else-if="contactsCatalogPending"
              class="space-y-3 py-8 text-center text-sm text-zinc-500"
            >
              Loading contacts…
            </div>
            <template v-else>
              <p
                v-if="contactsCatalogTruncated"
                class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/80"
              >
                Showing the most recently updated contacts only (list is capped). Refine your search or manage lists for larger audiences.
              </p>
              <p
                v-if="!filteredContactsForPicker.length"
                class="py-10 text-center text-sm text-zinc-500"
              >
                {{
                  contactPickerSearch.trim()
                    ? 'No contacts match your search.'
                    : 'No contacts with an email address yet.'
                }}
              </p>
              <ul v-else class="divide-y divide-zinc-100">
                <li
                  v-for="c in filteredContactsForPicker"
                  :key="c.id"
                  class="flex items-center justify-between gap-3 py-3.5"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-zinc-900">
                      {{ c.name || '—' }}
                    </p>
                    <p class="truncate text-sm text-zinc-500">
                      {{ c.email }}
                    </p>
                    <p v-if="c.company" class="truncate text-xs text-zinc-400">
                      {{ c.company }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isManualContactSelected(c.id)"
                    @click="addContactFromPicker(c)"
                  >
                    {{ isManualContactSelected(c.id) ? 'Added' : 'Add' }}
                  </button>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
  </div>  
</template>
<script setup lang="ts">
import type { Campaign, SendStatus } from '~/types/campaign'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'
import type { WorkSheet } from 'xlsx'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '~/store/campaignStore'

const campaignStore = useCampaignStore()
const { campaigns, sendingCampaignId, sendStatus, sendError } = storeToRefs(campaignStore)

type XlsxModule = typeof import('xlsx')

const PENDING_CAMPAIGN_KEY = 'mortdash-pending-campaign'

const form = ref({
  name: '',
  senderName: 'Mortdash',
  senderEmail: 'joshdanielsaraa@gmail.com',
  subject: '',
  recipientsMode: 'list' as 'list' | 'manual',
  recipientsListId: '',
  recipientsManual: [] as string[],
  templateMode: 'scratch' as 'scratch' | 'existing',
  selectedTemplateId: ''
})

const recipientsOpen = ref(false)
const subjectOpen = ref(false)
const designModalOpen = ref(false)
const changeDesignConfirmOpen = ref(false)

function openDesignModal() {
  designModalOpen.value = true
  void loadEmailTemplates()
}

function confirmChangeDesign() {
  changeDesignConfirmOpen.value = true
}

function onChangeDesignConfirmed() {
  changeDesignConfirmOpen.value = false
  openDesignModal()
}
const subjectVariable = ref('')
const returnCampaignId = ref<string | null>(null)
const savedTemplateHtml = ref<string | null>(null)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

interface RecipientListOption {
  id: string
  name: string
}

const recipientLists = ref<RecipientListOption[]>([])
const recipientListsPending = ref(false)
const recipientListsError = ref('')

interface ContactPickerRow {
  id: string
  name: string
  email: string
  company?: string
}

const contactsPickerOpen = ref(false)
const contactPickerSearch = ref('')
const contactsCatalog = ref<ContactPickerRow[]>([])
const contactsCatalogPending = ref(false)
const contactsCatalogError = ref('')
const contactsCatalogTruncated = ref(false)

/** Display names/emails for manual recipient contact ids (wizard + Excel match). */
const manualRecipientLabels = ref<Record<string, { email: string; name: string }>>({})

function normalizeRecipientEmail(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

function isManualContactIdString(raw: string): boolean {
  return /^[a-f0-9]{24}$/i.test(String(raw ?? '').trim())
}

function isManualContactSelected(contactId: string): boolean {
  const id = String(contactId ?? '').trim()
  if (!id) return false
  return form.value.recipientsManual.includes(id)
}

function setManualRecipientLabel(contactId: string, email: string, name: string) {
  manualRecipientLabels.value = {
    ...manualRecipientLabels.value,
    [contactId]: { email, name }
  }
}

function addContactsToManual(rows: Array<{ id: string; email: string; name: string }>) {
  const next = new Set(form.value.recipientsManual.filter(isManualContactIdString))
  for (const r of rows) {
    const id = r.id.trim()
    if (!isManualContactIdString(id)) continue
    next.add(id)
    setManualRecipientLabel(id, (r.email ?? '').trim(), (r.name ?? '').trim())
  }
  form.value.recipientsManual = [...next]
}

function addContactFromPicker(row: ContactPickerRow) {
  addContactsToManual([{ id: row.id, email: row.email, name: row.name }])
}

async function loadContactsCatalog() {
  contactsCatalogPending.value = true
  contactsCatalogError.value = ''
  try {
    const res = await $fetch<{
      contacts?: Array<{
        id: string
        name?: string
        email?: string
        company?: string
      }>
      contactsTruncated?: boolean
    }>('/api/v1/tenant/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    const rows = Array.isArray(res.contacts) ? res.contacts : []
    contactsCatalog.value = rows
      .map((c) => ({
        id: c.id,
        name: (c.name ?? '').trim(),
        email: (c.email ?? '').trim(),
        company: (c.company ?? '').trim() || undefined
      }))
      .filter((c) => c.email.includes('@'))
    contactsCatalogTruncated.value = Boolean(res.contactsTruncated)
  } catch {
    contactsCatalogError.value = 'Could not load contacts.'
    contactsCatalog.value = []
    contactsCatalogTruncated.value = false
  } finally {
    contactsCatalogPending.value = false
  }
}

const filteredContactsForPicker = computed(() => {
  const q = contactPickerSearch.value.trim().toLowerCase()
  if (!q) return contactsCatalog.value
  return contactsCatalog.value.filter((c) => {
    const name = c.name.toLowerCase()
    const email = c.email.toLowerCase()
    const company = (c.company ?? '').toLowerCase()
    return name.includes(q) || email.includes(q) || company.includes(q)
  })
})

async function openContactsPicker() {
  contactPickerSearch.value = ''
  contactsPickerOpen.value = true
  await loadContactsCatalog()
}

function closeContactsPicker() {
  contactsPickerOpen.value = false
}

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

let sendPollTimer: ReturnType<typeof setInterval> | null = null

const wizardSendBusy = computed(() => isSaving.value || !!sendingCampaignId.value)

const campaignNameForSendModal = computed(() => {
  const id = sendingCampaignId.value
  if (!id) return 'campaign'
  return campaigns.value.find((c) => c.id === id)?.name || form.value.name.trim() || 'campaign'
})

const sendProgress = computed(() => {
  const s = sendStatus.value
  if (!s) return null
  const processed = s.sent + s.failed
  const pct = s.total > 0 ? (processed / s.total) * 100 : 0
  return {
    ...s,
    processed,
    pct,
    remaining: s.pending
  }
})

function closeSendModal() {
  campaignStore.clearSendModal()
  if (sendPollTimer) {
    clearInterval(sendPollTimer)
    sendPollTimer = null
  }
}

function startPollingAfterWizard(campaignId: string) {
  async function poll() {
    if (!sendingCampaignId.value) return
    try {
      const res = await $fetch<SendStatus>(`/api/v1/tenant/send-campaign/status/${campaignId}`, {
        timeout: 60000,
        credentials: 'include',
        ...serverAuthHeaders()
      })
      campaignStore.setSendStatus(res)
      if (res.done) {
        campaignStore.setSendingCampaignId(null)
        campaignStore.setSendStatus(null)
        if (sendPollTimer) {
          clearInterval(sendPollTimer)
          sendPollTimer = null
        }
        await campaignStore.fetchCampaigns()
        await navigateTo(`/tenant/campaigns/${campaignId}`)
      }
    } catch {
      campaignStore.clearSendModal()
      if (sendPollTimer) {
        clearInterval(sendPollTimer)
        sendPollTimer = null
      }
    }
  }
  poll()
  // Frequent polls so we detect completion soon after the worker finishes (5s felt sluggish).
  sendPollTimer = setInterval(poll, 1500)
}

onBeforeUnmount(() => {
  if (sendPollTimer) {
    clearInterval(sendPollTimer)
    sendPollTimer = null
  }
})

function buildCampaignForSend(savedId: string): Campaign {
  const fromStore = campaignStore.campaigns.find((x) => x.id === savedId)
  if (fromStore) return fromStore
  const manualRecipients = form.value.recipientsManual
    .filter(isManualContactIdString)
    .map((id) => manualRecipientLabels.value[id]?.email?.trim())
    .filter((e): e is string => !!e && e.includes('@'))
  return {
    id: savedId,
    name: form.value.name.trim(),
    sender: { name: form.value.senderName, email: form.value.senderEmail },
    recipientsType: form.value.recipientsMode,
    recipientsListId: form.value.recipientsListId || undefined,
    recipients: manualRecipients.map((email) => ({ email })),
    subject: form.value.subject,
    status: 'Draft',
    createdAt: '',
    updatedAt: ''
  }
}

async function loadRecipientLists() {
  recipientListsPending.value = true
  recipientListsError.value = ''
  try {
    const res = await $fetch<{ lists?: RecipientListOption[] }>('/api/v1/tenant/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    recipientLists.value = Array.isArray(res.lists) ? res.lists : []
  } catch {
    recipientListsError.value = 'Could not load recipient lists.'
    recipientLists.value = []
  } finally {
    recipientListsPending.value = false
  }
}

interface DynamicVariableOption {
  key: string
  label: string
  scopes?: Array<'subject' | 'body'>
  enabled?: boolean
}

const dynamicVariables = ref<DynamicVariableOption[]>([])

const baseSubjectVariables = [
  { value: '{{user.firstName}}', label: 'First name' },
  { value: '{{user.lastName}}', label: 'Last name' },
  { value: '{{user.email}}', label: 'Email' },
  { value: '{{user.company}}', label: 'Company' }
]

const subjectVariables = computed(() => {
  const vars = dynamicVariables.value
    .filter((v) => v.enabled !== false && (!v.scopes?.length || v.scopes.includes('subject')))
    .map((v) => ({
      value: `{{${v.key}}}`,
      label: v.label || v.key
    }))
  const seen = new Set<string>()
  return [...baseSubjectVariables, ...vars].filter((v) => {
    if (seen.has(v.value)) return false
    seen.add(v.value)
    return true
  })
})

async function loadDynamicVariables() {
  try {
    const res = await $fetch<{ variables?: DynamicVariableOption[] }>(
      '/api/v1/tenant/dynamic-variables',
      {
        credentials: 'include',
        ...serverAuthHeaders()
      }
    )
    dynamicVariables.value = Array.isArray(res.variables) ? res.variables : []
  } catch {
    dynamicVariables.value = []
  }
}

interface ExistingTemplateOption {
  id: string
  name: string
  html: string
  /** Mirrors saved email template default subject; may be empty. */
  subject?: string
}

const existingTemplates = ref<ExistingTemplateOption[]>([])
const emailTemplatesPending = ref(false)
const emailTemplatesError = ref('')

async function loadEmailTemplates() {
  emailTemplatesPending.value = true
  emailTemplatesError.value = ''
  try {
    const res = await $fetch<{
      templates: { id: string; name: string; htmlTemplate: string; subject?: string }[]
    }>('/api/v1/tenant/email-templates', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    existingTemplates.value = (res.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      html: t.htmlTemplate,
      subject: (t.subject ?? '').trim() || undefined
    }))
  } catch {
    emailTemplatesError.value = 'Could not load email templates.'
    existingTemplates.value = []
  } finally {
    emailTemplatesPending.value = false
  }
}

const route = useRoute()
const editId = computed(() => (route.query.id as string) || '')
const isEditMode = computed(() => !!editId.value)
const cancelOrBackHref = computed(() =>
  isEditMode.value && editId.value ? `/tenant/campaigns/${editId.value}` : '/tenant/campaigns'
)
const cancelOrBackLabel = computed(() => (isEditMode.value ? 'Back to campaign' : 'Back to campaigns'))
const editLoadPending = ref(false)
const showEditSkeleton = computed(() => isEditMode.value && editLoadPending.value)

async function loadEditCampaign() {
  if (!editId.value) {
    editLoadPending.value = false
    return
  }
  editLoadPending.value = true
  try {
    const res = await $fetch<{ campaign: {
      name: string
      sender: { name: string; email: string }
      recipientsType: 'manual' | 'list'
      recipientsListId?: string
      subject: string
      recipients: { email: string; contactId?: string }[]
      templateHtml?: string | null
    } }>(`/api/v1/tenant/campaigns/${editId.value}`)
    const c = res.campaign
    const ids: string[] = []
    const labels: Record<string, { email: string; name: string }> = {}
    for (const r of c.recipients ?? []) {
      const cid = r.contactId?.trim()
      if (cid && isManualContactIdString(cid)) {
        ids.push(cid)
        labels[cid] = { email: (r.email ?? '').trim(), name: '' }
      }
    }
    manualRecipientLabels.value = labels
    form.value = {
      name: c.name,
      senderName: c.sender?.name || 'Mortdash',
      senderEmail: c.sender?.email || 'joshdanielsaraa@gmail.com',
      subject: c.subject || '',
      recipientsMode: c.recipientsType || 'manual',
      recipientsListId: c.recipientsListId || '',
      recipientsManual: ids,
      templateMode: 'scratch',
      selectedTemplateId: ''
    }
    returnCampaignId.value = editId.value
    const fromEditor = route.query.fromEditor === '1'
    if (c.templateHtml && !fromEditor) savedTemplateHtml.value = c.templateHtml
  } catch {
    /* ignore load errors; form stays empty */
  } finally {
    editLoadPending.value = false
  }
}

watch(editId, loadEditCampaign, { immediate: true })

async function loadFromEditorReturn() {
  const campaignId = route.query.campaignId as string
  const fromEditor = route.query.fromEditor
  if (!campaignId || fromEditor !== '1') return
  returnCampaignId.value = campaignId
  if (typeof window !== 'undefined') {
    const template = window.sessionStorage.getItem(`campaign-template-${campaignId}`)
    if (template) savedTemplateHtml.value = template
  }
  const isRealCampaignId = /^[a-f0-9]{24}$/i.test(campaignId)
  if (isRealCampaignId) {
    try {
      const res = await $fetch<{ campaign: {
        name: string
        sender: { name: string; email: string }
        recipientsType: 'manual' | 'list'
        recipientsListId?: string
        subject: string
        recipients: { email: string; contactId?: string }[]
        templateHtml?: string | null
      } }>(`/api/v1/tenant/campaigns/${campaignId}`)
      const c = res.campaign
      const ids: string[] = []
      const labels: Record<string, { email: string; name: string }> = {}
      for (const r of c.recipients ?? []) {
        const cid = r.contactId?.trim()
        if (cid && isManualContactIdString(cid)) {
          ids.push(cid)
          labels[cid] = { email: (r.email ?? '').trim(), name: '' }
        }
      }
      manualRecipientLabels.value = labels
      form.value = {
        name: c.name,
        senderName: c.sender?.name || 'Mortdash',
        senderEmail: c.sender?.email || 'joshdanielsaraa@gmail.com',
        subject: c.subject || '',
        recipientsMode: c.recipientsType || 'manual',
        recipientsListId: c.recipientsListId || '',
        recipientsManual: ids,
        templateMode: form.value.templateMode,
        selectedTemplateId: form.value.selectedTemplateId
      }
      if (!savedTemplateHtml.value && c.templateHtml) {
        savedTemplateHtml.value = c.templateHtml
      }
    } catch {
      /* ignore prefetch errors; session path may still apply */
    }
  } else if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(PENDING_CAMPAIGN_KEY)
    if (stored) {
      try {
        const { form: storedForm } = JSON.parse(stored)
        if (storedForm) form.value = { ...form.value, ...storedForm }
      } catch {
        /* ignore invalid stored JSON */
      }
    }
  }
  await nextTick()
  designSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const designSectionRef = ref<HTMLElement | null>(null)

const mergeRootDraft = ref<Record<string, unknown> | null>(null)
let mergeDraftTimer: ReturnType<typeof setTimeout> | null = null

async function refreshMergeRootDraft() {
  try {
    const manual = form.value.recipientsMode === 'manual'
      ? [...new Set(form.value.recipientsManual.map((e) => e?.trim()).filter(isManualContactIdString))]
      : []
    const res = await $fetch<{ mergeRoot: Record<string, unknown> }>('/api/v1/tenant/email/merge-context', {
      method: 'POST',
      body: {
        recipientsType: form.value.recipientsMode,
        recipientsListId: form.value.recipientsListId || undefined,
        recipientsManual: manual.length ? manual : undefined
      },
      credentials: 'include',
      ...serverAuthHeaders()
    })
    mergeRootDraft.value = res.mergeRoot
  } catch {
    mergeRootDraft.value = null
  }
}

function scheduleMergeRootDraftRefresh() {
  if (!import.meta.client) return
  if (mergeDraftTimer) clearTimeout(mergeDraftTimer)
  mergeDraftTimer = setTimeout(() => {
    mergeDraftTimer = null
    void refreshMergeRootDraft()
  }, 350)
}

const addCampaignDesignPreviewHtml = computed(() => {
  const raw = savedTemplateHtml.value
  if (!raw) return ''
  if (mergeRootDraft.value == null) return raw
  try {
    return mergeMustacheTemplate(raw, mergeRootDraft.value)
  } catch {
    return raw
  }
})

watch(
  () =>
    [
      form.value.recipientsMode,
      form.value.recipientsListId,
      form.value.recipientsManual.map((e) => e?.trim()).join('\n'),
      savedTemplateHtml.value
    ] as const,
  () => scheduleMergeRootDraftRefresh()
)

onMounted(() => {
  loadFromEditorReturn()
  loadRecipientLists()
  loadEmailTemplates()
  loadDynamicVariables()
  void refreshMergeRootDraft()
})
watch(() => [route.query.campaignId, route.query.fromEditor], loadFromEditorReturn, { immediate: false })

function pickQueryString(q: unknown): string {
  if (q == null || q === '') return ''
  if (Array.isArray(q)) return typeof q[0] === 'string' ? q[0] : ''
  return typeof q === 'string' ? q : String(q)
}

const designEditorCampaignId = computed(() =>
  returnCampaignId.value || editId.value || pickQueryString(route.query.campaignId)
)

function openEditorWithCurrentDesign() {
  const campaignId = designEditorCampaignId.value
  if (!campaignId) return
  if (typeof window !== 'undefined') {
    if (savedTemplateHtml.value) {
      window.sessionStorage.setItem(`campaign-template-${campaignId}`, savedTemplateHtml.value)
    }
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({
      form: { ...form.value },
      campaignId
    }))
  }
  navigateTo(`/tenant/email-editor?campaignId=${campaignId}&token=local`)
}

const recipientsDescription = computed(() => {
  if (form.value.recipientsMode === 'manual') {
    const count = form.value.recipientsManual.filter(isManualContactIdString).length
    return count > 0 ? `${count} manual recipient${count === 1 ? '' : 's'}` : 'Add recipients manually'
  }
  const selected = recipientLists.value.find((l) => l.id === form.value.recipientsListId)
  return selected ? `List: ${selected.name}` : 'Select a recipient list'
})

const recipientsComplete = computed(() => {
  if (form.value.recipientsMode === 'list') return !!form.value.recipientsListId
  return form.value.recipientsManual.some(isManualContactIdString)
})
const subjectComplete = computed(() => !!form.value.subject?.trim())
const designComplete = computed(() => !!savedTemplateHtml.value || (form.value.templateMode === 'existing' && form.value.selectedTemplateId))

const designSourceSummary = computed(() => {
  if (form.value.templateMode === 'scratch') return 'Built from scratch in the email editor.'
  const t = existingTemplates.value.find((x) => x.id === form.value.selectedTemplateId)
  if (t) return `Based on saved template “${t.name}”.`
  return 'Your campaign email is ready to refine or send.'
})

const designSectionToggleLabel = computed(() => {
  if (savedTemplateHtml.value) return 'Browse templates'
  return 'Choose design'
})

const designStepSubtitle = computed(() => {
  if (savedTemplateHtml.value) return 'Preview ready — change design or edit in the editor.'
  if (form.value.templateMode === 'scratch') return 'Create from scratch'
  if (form.value.templateMode === 'existing') return 'Pick a template'
  return 'Create your email content'
})

const campaignFormComplete = computed(
  () =>
    !!form.value.name?.trim()
    && recipientsComplete.value
    && subjectComplete.value
    && designComplete.value
)

/** Name, recipients, subject, and template — required before "Save campaign" is enabled. */
const readyToSaveCampaign = computed(
  () =>
    !!form.value.name?.trim()
    && recipientsComplete.value
    && subjectComplete.value
    && designComplete.value
)

const saveCampaignActionDisabled = computed(
  () =>
    isSaving.value
    || !!sendingCampaignId.value
    || !readyToSaveCampaign.value
)

const manualRecipientsListed = computed(() =>
  form.value.recipientsManual
    .map((id) => id.trim())
    .filter(isManualContactIdString)
    .map((contactId) => {
      const lbl = manualRecipientLabels.value[contactId]
      const email = lbl?.email ?? ''
      const name = lbl?.name ?? ''
      const displayLine =
        name && email ? `${name} · ${email}` : email || `Contact ${contactId.slice(0, 8)}…`
      return { contactId, email, name, displayLine }
    })
)

function removeManualRecipientById(contactId: string) {
  const id = String(contactId ?? '').trim()
  if (!id) return
  form.value.recipientsManual = form.value.recipientsManual.filter((x) => x.trim() !== id)
  const { [id]: _removed, ...rest } = manualRecipientLabels.value
  manualRecipientLabels.value = rest
}

const bulkUploadError = ref<string | null>(null)
const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function extractEmailsFromSheet(sheet: WorkSheet, XLSX: XlsxModule): string[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][]
  const emails: string[] = []
  for (const row of rows) {
    for (const cell of row) {
      const s = String(cell ?? '').trim()
      if (s && emailRegex.test(s)) emails.push(s.toLowerCase())
    }
  }
  return [...new Set(emails)]
}

async function handleBulkUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  input.value = ''
  if (!file) return
  bulkUploadError.value = null
  isUploading.value = true
  try {
    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const firstSheetName = wb.SheetNames[0]
    const firstSheet = firstSheetName ? wb.Sheets[firstSheetName] : undefined
    if (!firstSheet) {
      bulkUploadError.value = 'No sheets found in file'
      return
    }
    const emails = extractEmailsFromSheet(firstSheet, XLSX)
    if (!emails.length) {
      bulkUploadError.value = 'No valid email addresses found. Use a column with email addresses.'
      return
    }
    if (!contactsCatalog.value.length) await loadContactsCatalog()
    const byEmail = new Map<string, ContactPickerRow>()
    for (const c of contactsCatalog.value) {
      byEmail.set(normalizeRecipientEmail(c.email), c)
    }
    const existingIds = new Set(form.value.recipientsManual.filter(isManualContactIdString))
    const toAdd: Array<{ id: string; email: string; name: string }> = []
    const unknown: string[] = []
    for (const em of emails) {
      const row = byEmail.get(em)
      if (!row) {
        unknown.push(em)
        continue
      }
      if (existingIds.has(row.id)) continue
      existingIds.add(row.id)
      toAdd.push({ id: row.id, email: row.email, name: row.name })
    }
    if (unknown.length) {
      bulkUploadError.value = `No CRM contact for ${unknown.length} address(es). Only existing contacts can be added.`
      if (!toAdd.length) return
    }
    addContactsToManual(toAdd)
  } catch (err: unknown) {
    bulkUploadError.value =
      err instanceof Error ? err.message : 'Failed to parse file. Use .xlsx or .xls format.'
  } finally {
    isUploading.value = false
  }
}

async function downloadSampleExcel() {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([
    ['email'],
    ['recipient1@example.com'],
    ['recipient2@example.com'],
    ['recipient3@example.com']
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Recipients')
  XLSX.writeFile(wb, 'recipients-sample.xlsx')
}

watch(subjectVariable, (val) => {
  if (val) {
    form.value.subject += val
    subjectVariable.value = ''
  }
})

function handleCreateFromScratch() {
  designModalOpen.value = false
  form.value.templateMode = 'scratch'
  form.value.selectedTemplateId = ''
  const campaignId = editId.value || `temp-${Date.now()}`
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({
      form: { ...form.value, templateMode: 'scratch' },
      campaignId
    }))
  }
  navigateTo(`/tenant/email-editor?campaignId=${campaignId}&token=local`)
}

function handleUseTemplate(template: ExistingTemplateOption) {
  designModalOpen.value = false
  form.value.templateMode = 'existing'
  form.value.selectedTemplateId = template.id
  const fromTemplate = template.subject?.trim()
  if (fromTemplate) {
    form.value.subject = fromTemplate
  }
  const campaignId = editId.value || `temp-${Date.now()}`
  if (typeof window !== 'undefined') {
    // Same key the email editor reads after save-and-exit; avoids relying on builderId query + separate storage.
    window.sessionStorage.setItem(`campaign-template-${campaignId}`, template.html)
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({ form: { ...form.value }, campaignId }))
  }
  navigateTo(`/tenant/email-editor?campaignId=${campaignId}&token=local`)
}

function applyStoredOrSelectedTemplate() {
  const cid = returnCampaignId.value || (route.query.campaignId as string)
  if (!savedTemplateHtml.value && cid && typeof window !== 'undefined') {
    const template = window.sessionStorage.getItem(`campaign-template-${cid}`)
    if (template) savedTemplateHtml.value = template
  }
  if (!savedTemplateHtml.value && form.value.templateMode === 'existing' && form.value.selectedTemplateId) {
    const template = existingTemplates.value.find(t => t.id === form.value.selectedTemplateId)
    if (template) {
      savedTemplateHtml.value = template.html
      const sub = (template.subject ?? '').trim()
      if (sub && !form.value.subject?.trim()) {
        form.value.subject = sub
      }
    }
  }
}

function clearCampaignSessionStorage() {
  if (typeof window !== 'undefined') {
    if (returnCampaignId.value) {
      window.sessionStorage.removeItem(`campaign-template-${returnCampaignId.value}`)
    }
    window.sessionStorage.removeItem(PENDING_CAMPAIGN_KEY)
  }
}

async function persistSavedCampaign(): Promise<string> {
  const recipientsManual = form.value.recipientsMode === 'manual'
    ? [...new Set(form.value.recipientsManual.map((e) => e?.trim()).filter(isManualContactIdString))]
    : []

  const body = {
    name: form.value.name.trim(),
    senderName: form.value.senderName,
    senderEmail: form.value.senderEmail,
    subject: form.value.subject,
    recipientsType: form.value.recipientsMode,
    recipientsListId: form.value.recipientsListId || undefined,
    recipientsManual,
    templateHtml: savedTemplateHtml.value!
  }

  if (isEditMode.value && editId.value) {
    await $fetch(`/api/v1/tenant/campaigns/${editId.value}`, { method: 'PUT', body })
    return editId.value
  }
  const res = await $fetch<{ id: string }>('/api/v1/tenant/campaigns', { method: 'POST', body })
  return res.id
}

function setSaveErrorFromCatch(e: unknown) {
  const data =
    e && typeof e === 'object' && 'data' in e
      ? (e as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
  const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
  saveError.value = typeof raw === 'string' ? raw : 'Failed to save campaign'
}

async function handleSendFromWizard() {
  if (!campaignFormComplete.value) return
  saveError.value = null
  if (!form.value.name.trim()) {
    saveError.value = 'Campaign name is required'
    return
  }
  try {
    applyStoredOrSelectedTemplate()
    if (!savedTemplateHtml.value) {
      saveError.value = 'Complete the email design before sending.'
      return
    }
    isSaving.value = true
    try {
      const id = await persistSavedCampaign()
      clearCampaignSessionStorage()
        const campaign = buildCampaignForSend(id)
      const { poll } = await campaignStore.sendCampaign(campaign)
      if (!poll) {
        if (sendError.value) return
        await navigateTo(`/tenant/campaigns/${id}`)
        return
      }
      startPollingAfterWizard(id)
    } catch (e: unknown) {
      setSaveErrorFromCatch(e)
    } finally {
      isSaving.value = false
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      saveError.value = e.message
    } else if (
      typeof e === 'object'
      && e !== null
      && 'message' in e
      && typeof (e as { message: unknown }).message === 'string'
    ) {
      saveError.value = (e as { message: string }).message
    } else {
      saveError.value = 'Something went wrong'
    }
  }
}

async function handleCreate() {
  saveError.value = null
  if (!form.value.name.trim()) {
    saveError.value = 'Campaign name is required'
    return
  }

  try {
    applyStoredOrSelectedTemplate()

    if (!savedTemplateHtml.value) {
      saveError.value = 'Add an email design before saving.'
      return
    }

    isSaving.value = true
    try {
      await persistSavedCampaign()
      clearCampaignSessionStorage()
      await campaignStore.fetchCampaigns()
      await navigateTo(isEditMode.value ? `/tenant/campaigns/${editId.value}` : '/tenant/campaigns')
    } catch (e: unknown) {
      setSaveErrorFromCatch(e)
    } finally {
      isSaving.value = false
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      saveError.value = e.message
    } else if (
      typeof e === 'object'
      && e !== null
      && 'message' in e
      && typeof (e as { message: unknown }).message === 'string'
    ) {
      saveError.value = (e as { message: string }).message
    } else {
      saveError.value = 'Something went wrong'
    }
  }
}

function previewSrcdoc(html: string, scale = 0.45) {
  // Don't escape - escaping " breaks inline styles (style="...")
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:center top;width:600px}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}
</script>
