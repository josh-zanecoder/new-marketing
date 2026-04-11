<template>
  <div class="w-full min-w-0 antialiased">
    <div class="w-full min-w-0">
      <NuxtLink
        :to="cancelOrBackHref"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-700"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm shadow-slate-900/[0.04] transition group-hover:border-indigo-200 group-hover:bg-indigo-50/80 group-hover:text-indigo-700">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        {{ cancelOrBackLabel }}
      </NuxtLink>

      <div
        v-if="showWizardSkeleton"
        class="mb-12 space-y-10 animate-pulse"
        aria-busy="true"
        aria-label="Loading campaign to edit"
      >
        <header class="space-y-4">
          <div class="h-4 w-40 rounded-md bg-slate-200" />
          <div class="h-11 max-w-md rounded-lg bg-slate-200" />
          <div class="h-5 max-w-xl rounded-md bg-slate-200" />
          <div class="h-5 w-2/3 max-w-lg rounded-md bg-slate-200" />
        </header>
        <div class="space-y-3">
          <div class="h-5 w-36 rounded bg-slate-200" />
          <div class="h-14 w-full rounded-xl bg-slate-200" />
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:px-6 sm:py-5">
            <div class="h-12 w-12 shrink-0 rounded-xl bg-slate-200" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-5 w-32 rounded bg-slate-200" />
              <div class="h-4 max-w-sm rounded bg-slate-200" />
            </div>
            <div class="h-10 w-28 shrink-0 rounded-lg bg-slate-200" />
          </div>
        </div>
        <div class="flex justify-end gap-4 pt-4">
          <div class="h-12 w-28 rounded-xl bg-slate-200" />
          <div class="h-12 w-44 rounded-xl bg-slate-200" />
        </div>
      </div>

      <template v-else>
      <header class="mb-8 sm:mb-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Edit campaign
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
          Configure your campaign step by step: name, recipients, design, and subject.
        </p>
      </header>

      <div class="space-y-6 sm:space-y-8">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">
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
            class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
          >
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
        <!-- Sender (read-only; values from account defaults or existing campaign) -->
        <div class="border-b border-slate-100 last:border-b-0">
          <div class="flex w-full items-center gap-4 px-5 py-4 sm:px-6 sm:py-5">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:h-12 sm:w-12"
            >
              <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-base font-semibold text-slate-900">Sender</div>
              <div class="mt-0.5 text-sm text-slate-600 sm:text-[15px]">
                {{ form.senderName }} &lt;{{ form.senderEmail }}&gt;
              </div>
            </div>
          </div>
        </div>

        <!-- Recipients -->
        <div class="border-b border-slate-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:gap-5 sm:px-6 sm:py-5"
            @click="recipientsOpen = !recipientsOpen"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="recipientsComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'"
              >
                <svg v-if="recipientsComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-slate-900">Recipients</div>
                <div class="mt-0.5 text-sm text-slate-500 sm:text-[15px]">{{ recipientsDescription }}</div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:px-4 sm:text-[15px]">{{ recipientsOpen ? 'Close' : 'Add recipients' }}</span>
          </button>
          <div v-if="recipientsOpen" class="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <div class="space-y-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  :class="[
                    'rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors sm:px-5 sm:py-4 sm:text-[15px]',
                    form.recipientsMode === 'list'
                      ? 'border-indigo-300 bg-indigo-50/50 text-slate-900 shadow-sm ring-1 ring-indigo-200/50'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                  ]"
                  @click="form.recipientsMode = 'list'"
                >
                  Use a list
                  <div class="mt-1.5 text-sm font-normal text-slate-500">Pick from saved recipient lists</div>
                </button>
                <button
                  type="button"
                  :class="[
                    'rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors sm:px-5 sm:py-4 sm:text-[15px]',
                    form.recipientsMode === 'manual'
                      ? 'border-indigo-300 bg-indigo-50/50 text-slate-900 shadow-sm ring-1 ring-indigo-200/50'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                  ]"
                  @click="form.recipientsMode = 'manual'"
                >
                  Enter manually
                  <div class="mt-1.5 text-sm font-normal text-slate-500">Pick recipients from your CRM contacts</div>
                </button>
              </div>
              <div v-if="form.recipientsMode === 'list'">
                <label class="mb-2 block text-sm font-medium text-slate-700">Recipient list</label>
                <select
                  v-model="form.recipientsListId"
                  class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-[15px]"
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
                  class="mt-2 text-sm text-slate-500"
                >
                  No recipient lists yet.
                  <NuxtLink
                    to="/tenant/recipient-list/add"
                    class="font-semibold text-indigo-600 underline hover:text-indigo-700"
                  >
                    Create one
                  </NuxtLink>
                </p>
                <div
                  v-if="form.recipientsListId"
                  class="mt-5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03]"
                >
                  <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
                    <h3 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Contacts in this list
                    </h3>
                  </div>
                  <div class="px-4 py-3 sm:px-5 sm:py-4">
                    <p
                      v-if="listPreviewPending"
                      class="text-sm text-slate-500"
                    >
                      Loading contacts…
                    </p>
                    <p
                      v-else-if="listPreviewError"
                      class="text-sm text-red-600"
                    >
                      {{ listPreviewError }}
                    </p>
                    <p
                      v-else-if="!listPreviewTotal"
                      class="text-sm text-slate-500"
                    >
                      No contacts in this list yet.
                    </p>
                    <template v-else>
                      <ul class="max-h-56 divide-y divide-slate-100 overflow-y-auto overscroll-contain sm:max-h-64">
                        <li
                          v-for="c in listPreviewContacts"
                          :key="c.id"
                          class="flex flex-col gap-0.5 py-2.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <span class="text-sm font-medium text-slate-900">{{ c.name || '—' }}</span>
                          <span class="break-all text-sm text-slate-600">{{ c.email || '—' }}</span>
                        </li>
                      </ul>
                      <p
                        v-if="listPreviewTotal > listPreviewContacts.length"
                        class="mt-3 text-xs text-slate-500"
                      >
                        Showing {{ listPreviewContacts.length }} of {{ listPreviewTotal }} contacts.
                        <NuxtLink
                          :to="`/tenant/recipient-list/${form.recipientsListId}`"
                          class="font-semibold text-indigo-600 underline hover:text-indigo-700"
                        >
                          View full list
                        </NuxtLink>
                      </p>
                    </template>
                  </div>
                </div>
              </div>
              <div v-else class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label class="text-sm font-medium text-slate-700 sm:text-[15px]">Recipients</label>
                    <p class="mt-1 text-sm text-slate-500">
                      Add contacts from your CRM in the picker, then review them below.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 disabled:opacity-50"
                    :disabled="contactsCatalogPending && !contactsCatalog.length"
                    @click="openAddContactsModal"
                  >
                    Add contacts…
                  </button>
                </div>

                <TenantAddContactInCampaign
                  v-model:open="addContactsModalOpen"
                  :contacts="contactsCatalog"
                  :pending="contactsCatalogPending"
                  :error="contactsCatalogError"
                  :truncated="contactsCatalogTruncated"
                  :kind-counts="contactPickerKindCounts"
                  :selected-ids="form.recipientsManual"
                  @refresh="loadContactsCatalog"
                  @add-contact="addContactFromPicker"
                />

                <div>
                  <h3 class="text-sm font-medium text-slate-800">
                    Selected
                    <span
                      v-if="manualRecipientsListed.length"
                      class="ml-1 font-normal tabular-nums text-slate-500"
                    >({{ manualRecipientsListed.length }})</span>
                  </h3>
                  <p
                    v-if="!manualRecipientsListed.length"
                    class="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No recipients yet — tap <span class="font-semibold text-indigo-600">Add contacts</span> to open the picker.
                  </p>
                  <ul
                    v-else
                    class="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white sm:max-h-64"
                  >
                    <li
                      v-for="(row, idx) in manualRecipientsListed"
                      :key="row.contactId + '-' + idx"
                      class="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span class="min-w-0 truncate text-sm text-slate-900" :title="row.email">{{ row.displayLine }}</span>
                      <button
                        type="button"
                        class="shrink-0 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50"
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
        </div>

        <!-- Design -->
        <div ref="designSectionRef" class="border-b border-slate-100">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:gap-5 sm:px-6 sm:py-5"
            @click="openDesignModal"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="designComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'"
              >
                <svg v-if="designComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-slate-900">Design</div>
                <div class="mt-0.5 text-sm text-slate-500 sm:text-[15px]">
                  {{ designStepSubtitle }}
                </div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:px-4 sm:text-[15px]">{{ designSectionToggleLabel }}</span>
          </button>
          <div v-if="savedTemplateHtml" class="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <div class="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="flex flex-col gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <h3 class="text-base font-semibold text-slate-900">Current email design</h3>
                  <p class="mt-1 text-sm text-slate-500">{{ designSourceSummary }}</p>
                </div>
                <div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    class="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800"
                    @click="confirmChangeDesign"
                  >
                    Change design
                  </button>
                  <button
                    v-if="designEditorCampaignId"
                    type="button"
                    class="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
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
              <p v-if="!designEditorCampaignId" class="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
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
        <div class="border-b border-slate-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 sm:gap-5 sm:px-6 sm:py-5"
            @click="subjectOpen = !subjectOpen"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="subjectComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'"
              >
                <svg v-if="subjectComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold text-slate-900">Subject</div>
                <div class="mt-0.5 truncate text-sm text-slate-500 sm:text-[15px]">{{ form.subject || 'Add a subject line for this campaign' }}</div>
              </div>
            </div>
            <span class="shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:px-4 sm:text-[15px]">{{ subjectOpen ? 'Close' : 'Manage' }}</span>
          </button>
          <div v-if="subjectOpen" class="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6 sm:py-6">
            <label class="mb-2 block text-sm font-medium text-slate-700">Subject line</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="form.subject"
                type="text"
                placeholder="Enter email subject line"
                class="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
              >
              <select
                v-model="subjectVariable"
                class="w-full shrink-0 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:w-44 sm:text-[15px]"
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
        class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-sm"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {{ saveError }}
      </div>
      <div
        v-if="sendError && !sendingCampaignId"
        class="flex flex-wrap items-start gap-3.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-5 py-4 text-sm text-amber-950 shadow-sm"
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
          class="shrink-0 self-start rounded-lg px-2 py-1 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100/90"
          @click="closeSendModal()"
        >
          Dismiss
        </button>
      </div>
      <div class="flex flex-col items-stretch gap-3 pt-8 sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:pt-10">
        <NuxtLink
          :to="cancelOrBackHref"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:text-[15px]"
          :class="{ 'pointer-events-none opacity-50': wizardSendBusy }"
        >
          Cancel
        </NuxtLink>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <button
            v-if="campaignFormComplete"
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-sky-200/90 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-950 shadow-sm shadow-sky-900/[0.06] ring-1 ring-sky-100/80 transition-colors hover:bg-sky-100/90 disabled:opacity-50 sm:px-6 sm:text-[15px]"
            :disabled="wizardSendBusy"
            @click.prevent="handleOpenScheduleWizard"
          >
            Schedule send
          </button>
          <button
            v-if="campaignFormComplete"
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-emerald-200/90 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm shadow-emerald-900/[0.06] ring-1 ring-emerald-100/80 transition-colors hover:bg-emerald-100/90 disabled:opacity-50 sm:px-6 sm:text-[15px]"
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
            class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 sm:px-8 sm:text-[15px]"
            :disabled="saveCampaignActionDisabled"
            @click.prevent="handleCreate"
          >
            {{ isSaving ? 'Saving...' : 'Save campaign' }}
          </button>
        </div>
      </div>
      </div>
      </template>
    </div>

    <ClientSendProgressModal
      :open="!!sendingCampaignId"
      :campaign-name="campaignNameForSendModal"
      :send-error="sendError"
      :send-progress="sendProgress"
      @close="onSendProgressModalClose"
    />

    <ClientSendSuccessModal
      :open="!!sendSuccessSummary"
      :campaign-name="sendSuccessSummary?.campaignName ?? ''"
      :sent="sendSuccessSummary?.sent ?? 0"
      :failed="sendSuccessSummary?.failed ?? 0"
      :campaign-status="sendSuccessSummary?.campaignStatus ?? ''"
      @close="onSendSuccessModalClose"
    />

    <Teleport to="body">
      <div
        v-if="scheduleModalOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-schedule-title"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeScheduleModalFromWizard"
        />
        <div
          class="relative w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:rounded-2xl sm:p-6"
        >
          <h2 id="wizard-schedule-title" class="text-lg font-semibold text-slate-900">
            Schedule send
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            Campaign will be saved, then set to send at the time below (your local time).
          </p>
          <label class="mt-4 block text-sm font-medium text-slate-700" for="wizard-schedule-datetime">
            Date &amp; time
          </label>
          <input
            id="wizard-schedule-datetime"
            v-model="scheduleLocal"
            type="datetime-local"
            class="mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
          >
          <p v-if="scheduleError" class="mt-3 text-sm text-red-600" role="alert">
            {{ scheduleError }}
          </p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
              :disabled="wizardSendBusy"
              @click="closeScheduleModalFromWizard"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:opacity-50"
              :disabled="wizardSendBusy"
              @click="confirmScheduleFromWizard"
            >
              {{ wizardSendBusy ? 'Saving…' : 'Schedule' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
<script setup lang="ts">
import type { Campaign } from '~/types/campaign'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
import type { CampaignContactPickerRow } from '~/types/tenantContact'
import { primaryLifecycleKeyFromTypes } from '~~/shared/utils/contactLifecycle'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '~/store/campaignStore'

const campaignStore = useCampaignStore()
const marketingApi = useTenantMarketingApi()
const { campaigns, sendingCampaignId, sendError, sendStatus } = storeToRefs(campaignStore)
const { canScheduleDraft, sendProgress, startSendStatusPolling, closeSendModal } =
  useCampaignSendFlow()

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
const emailTemplatesLoaded = ref(false)
const dynamicVariablesLoaded = ref(false)

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

const listPreviewPending = ref(false)
const listPreviewError = ref('')
const listPreviewContacts = ref<Array<{ id: string; name: string; email: string }>>([])
const listPreviewTotal = ref(0)

const addContactsModalOpen = ref(false)
const contactPickerKindCounts = ref<{ prospect: number; client: number; contact: number } | null>(
  null
)
const contactsCatalog = ref<CampaignContactPickerRow[]>([])
const contactsCatalogPending = ref(false)
const contactsCatalogError = ref('')
const contactsCatalogTruncated = ref(false)
let recipientListResourcePromise: Promise<Awaited<ReturnType<typeof marketingApi.fetchRecipientListResource>>> | null = null

function fetchRecipientListResourceOnce() {
  if (!recipientListResourcePromise) {
    recipientListResourcePromise = marketingApi.fetchRecipientListResource().catch((e) => {
      recipientListResourcePromise = null
      throw e
    })
  }
  return recipientListResourcePromise
}

/** Display names/emails for manual recipient contact ids. */
const manualRecipientLabels = ref<Record<string, { email: string; name: string }>>({})

function isManualContactIdString(raw: string): boolean {
  return /^[a-f0-9]{24}$/i.test(String(raw ?? '').trim())
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

function addContactFromPicker(row: CampaignContactPickerRow) {
  addContactsToManual([{ id: row.id, email: row.email, name: row.name }])
}

async function loadContactsCatalog() {
  contactsCatalogPending.value = true
  contactsCatalogError.value = ''
  try {
    const res = await fetchRecipientListResourceOnce()
    const rows = Array.isArray(res.contacts) ? res.contacts : []
    const cc = res.contactCounts
    contactPickerKindCounts.value =
      cc && typeof cc === 'object'
        ? {
            prospect: Number(cc.prospect) || 0,
            client: Number(cc.client) || 0,
            contact: Number(cc.contact) || 0
          }
        : null
    contactsCatalog.value = rows
      .map((c) => {
        const rawTypes = Array.isArray(c.contactType) ? c.contactType : []
        const typeKeys = [
          ...new Set(rawTypes.map((k) => String(k).trim().toLowerCase()).filter(Boolean))
        ]
        const keys = typeKeys.length ? typeKeys : (['contact'] as string[])
        return {
          id: c.id,
          name: (c.name ?? '').trim(),
          email: (c.email ?? '').trim(),
          company: (c.company ?? '').trim() || undefined,
          lifecycleKey: primaryLifecycleKeyFromTypes(keys),
          contactType: keys
        }
      })
      .filter((c) => c.email.includes('@'))
    contactsCatalogTruncated.value = Boolean(res.contactsTruncated)
    for (const row of contactsCatalog.value) {
      if (form.value.recipientsManual.includes(row.id)) {
        setManualRecipientLabel(row.id, row.email, row.name)
      }
    }
  } catch {
    contactsCatalogError.value = 'Could not load contacts.'
    contactsCatalog.value = []
    contactsCatalogTruncated.value = false
    contactPickerKindCounts.value = null
  } finally {
    contactsCatalogPending.value = false
  }
}

function openAddContactsModal() {
  addContactsModalOpen.value = true
  if (!contactsCatalogPending.value && !contactsCatalog.value.length) {
    void loadContactsCatalog()
  }
}

watch(
  () => form.value.recipientsMode,
  (mode) => {
    if (mode === 'manual') {
      void loadContactsCatalog()
    }
  }
)

const scheduleModalOpen = ref(false)
const scheduleLocal = ref('')
const scheduleError = ref('')
const scheduleSubmitting = ref(false)

const wizardSendBusy = computed(
  () => isSaving.value || !!sendingCampaignId.value || scheduleSubmitting.value
)

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openScheduleModalFromWizard() {
  scheduleError.value = ''
  scheduleLocal.value = toDatetimeLocalValue(new Date(Date.now() + 65 * 60 * 1000))
  scheduleModalOpen.value = true
}

function closeScheduleModalFromWizard() {
  scheduleModalOpen.value = false
  scheduleError.value = ''
}

const campaignNameForSendModal = computed(() => {
  const id = sendingCampaignId.value
  if (!id) return 'campaign'
  return campaigns.value.find((c) => c.id === id)?.name || form.value.name.trim() || 'campaign'
})

const sendSuccessSummary = ref<{
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
} | null>(null)

/** After send from this wizard, navigate to campaign when the success modal is dismissed. */
const pendingPostSendNavigationId = ref<string | null>(null)

function onSendProgressModalClose() {
  const hadError = !!sendError.value
  const waitingForSuccessModal = !!sendSuccessSummary.value
  closeSendModal()
  if (hadError || !waitingForSuccessModal) pendingPostSendNavigationId.value = null
}

function onSendSuccessModalClose() {
  sendSuccessSummary.value = null
  const target = pendingPostSendNavigationId.value
  pendingPostSendNavigationId.value = null
  if (target) {
    campaignStore.removeCampaignDetailCache(target)
    void campaignStore.fetchCampaigns()
    void navigateTo(`/tenant/campaigns/${target}`)
  }
}

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
    const res = await fetchRecipientListResourceOnce()
    recipientLists.value = Array.isArray(res.lists) ? res.lists : []
  } catch {
    recipientListsError.value = 'Could not load recipient lists.'
    recipientLists.value = []
  } finally {
    recipientListsPending.value = false
  }
}

async function loadListContactsPreview() {
  const id = form.value.recipientsListId?.trim()
  if (!id || form.value.recipientsMode !== 'list') {
    listPreviewContacts.value = []
    listPreviewTotal.value = 0
    listPreviewError.value = ''
    return
  }
  listPreviewPending.value = true
  listPreviewError.value = ''
  try {
    const res = await marketingApi.fetchRecipientListById(id, { limit: 50, page: 1 })
    listPreviewContacts.value = (res.members?.items ?? []).map((c) => ({
      id: c.id,
      name: c.name || '',
      email: c.email || ''
    }))
    listPreviewTotal.value = res.members?.total ?? 0
  } catch {
    listPreviewError.value = 'Could not load contacts for this list.'
    listPreviewContacts.value = []
    listPreviewTotal.value = 0
  } finally {
    listPreviewPending.value = false
  }
}

watch(
  () => [form.value.recipientsMode, form.value.recipientsListId] as const,
  () => {
    void loadListContactsPreview()
  },
  { immediate: true }
)

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
  if (dynamicVariablesLoaded.value) return
  try {
    const res = await marketingApi.fetchDynamicVariables()
    dynamicVariables.value = Array.isArray(res.variables) ? res.variables : []
    dynamicVariablesLoaded.value = true
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
  if (emailTemplatesLoaded.value || emailTemplatesPending.value) return
  emailTemplatesPending.value = true
  emailTemplatesError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplates()
    existingTemplates.value = (res.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      html: t.htmlTemplate,
      subject: (t.subject ?? '').trim() || undefined
    }))
    emailTemplatesLoaded.value = true
  } catch {
    emailTemplatesError.value = 'Could not load email templates.'
    existingTemplates.value = []
  } finally {
    emailTemplatesPending.value = false
  }
}

const route = useRoute()
const editId = computed(() => {
  const q = route.query.id
  if (typeof q === 'string' && q.trim()) return q.trim()
  if (Array.isArray(q) && typeof q[0] === 'string' && q[0].trim()) return q[0].trim()
  const p = route.params.id
  if (typeof p === 'string' && p.trim()) return p.trim()
  return ''
})
const cancelOrBackHref = computed(() =>
  editId.value ? `/tenant/campaigns/${editId.value}` : '/tenant/campaigns'
)
const cancelOrBackLabel = computed(() => (editId.value ? 'Back to campaign' : 'Back to campaigns'))
/** Preserved from server for cache rows after save (edit). */
const editCampaignStatus = ref('Draft')
const editCampaignMeta = ref({ createdAt: '', updatedAt: '' })
const editLoadPending = ref(false)
const loadedEditCampaignId = ref('')
const showWizardSkeleton = computed(() => editLoadPending.value)

async function loadEditCampaign() {
  if (!editId.value) {
    editLoadPending.value = false
    return
  }
  const cached = campaignStore.getCampaignDetailCache(editId.value)
  if (cached) {
    editCampaignStatus.value = String(cached.status || 'Draft')
    editCampaignMeta.value = { createdAt: cached.createdAt || '', updatedAt: cached.updatedAt || '' }
    const ids: string[] = []
    const labels: Record<string, { email: string; name: string }> = {}
    for (const r of cached.recipients ?? []) {
      const cid = r.contactId?.trim()
      if (cid && isManualContactIdString(cid)) {
        ids.push(cid)
        labels[cid] = { email: (r.email ?? '').trim(), name: '' }
      }
    }
    manualRecipientLabels.value = labels
    form.value = {
      name: cached.name,
      senderName: cached.sender?.name || 'Mortdash',
      senderEmail: cached.sender?.email || 'joshdanielsaraa@gmail.com',
      subject: cached.subject || '',
      recipientsMode: cached.recipientsType || 'manual',
      recipientsListId: cached.recipientsListId || '',
      recipientsManual: ids,
      templateMode: 'scratch',
      selectedTemplateId: ''
    }
    returnCampaignId.value = editId.value
    loadedEditCampaignId.value = editId.value
    const fromEditor = route.query.fromEditor === '1'
    if (cached.templateHtml && !fromEditor) savedTemplateHtml.value = cached.templateHtml
    editLoadPending.value = false
    return
  }
  editLoadPending.value = true
  try {
    const res = await marketingApi.fetchCampaignById(editId.value)
    const c = res.campaign
    campaignStore.setCampaignDetailCache(editId.value, c)
    editCampaignStatus.value = String(c.status || 'Draft')
    editCampaignMeta.value = { createdAt: c.createdAt || '', updatedAt: c.updatedAt || '' }
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
    loadedEditCampaignId.value = editId.value
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
  const alreadyLoadedCurrentEdit =
    isRealCampaignId
    && campaignId === editId.value
    && loadedEditCampaignId.value === editId.value
  if (isRealCampaignId) {
    if (alreadyLoadedCurrentEdit) {
      await nextTick()
      designSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    try {
      const res = await marketingApi.fetchCampaignById(campaignId)
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

// Temporarily disabled dynamic-variable merge in design preview.
// const mergeRootDraft = ref<Record<string, unknown> | null>(null)
// let mergeDraftTimer: ReturnType<typeof setTimeout> | null = null
// let mergeDraftInFlight: Promise<void> | null = null
// let mergeDraftLastKey = ''
//
// function buildMergeDraftRequest() {
//   const recipientsType = form.value.recipientsMode
//   const recipientsListId = form.value.recipientsListId || undefined
//   const manual = recipientsType === 'manual'
//     ? [...new Set(form.value.recipientsManual.map((e) => e?.trim()).filter(isManualContactIdString))]
//     : []
//   const recipientsManual = manual.length ? manual : undefined
//   const key = JSON.stringify({
//     recipientsType,
//     recipientsListId: recipientsListId ?? '',
//     recipientsManual: recipientsManual ?? []
//   })
//   return { key, recipientsType, recipientsListId, recipientsManual }
// }
//
// async function refreshMergeRootDraft() {
//   const req = buildMergeDraftRequest()
//   if (req.key === mergeDraftLastKey) return
//   if (mergeDraftInFlight) return
//
//   mergeDraftInFlight = (async () => {
//     try {
//       const res = await marketingApi.fetchEmailMergeContext({
//         recipientsType: req.recipientsType,
//         recipientsListId: req.recipientsListId,
//         recipientsManual: req.recipientsManual
//       })
//       mergeRootDraft.value = res.mergeRoot
//       mergeDraftLastKey = req.key
//     } catch {
//       mergeRootDraft.value = null
//     } finally {
//       mergeDraftInFlight = null
//     }
//   })()
//   await mergeDraftInFlight
// }
//
// function scheduleMergeRootDraftRefresh() {
//   if (!import.meta.client) return
//   if (mergeDraftTimer) clearTimeout(mergeDraftTimer)
//   mergeDraftTimer = setTimeout(() => {
//     mergeDraftTimer = null
//     void refreshMergeRootDraft()
//   }, 350)
// }

const addCampaignDesignPreviewHtml = computed(() => {
  const raw = savedTemplateHtml.value
  if (!raw) return ''
  return raw
})

// watch(
//   () =>
//     [
//       form.value.recipientsMode,
//       form.value.recipientsListId,
//       form.value.recipientsManual.map((e) => e?.trim()).join('\n'),
//       savedTemplateHtml.value
//     ] as const,
//   () => scheduleMergeRootDraftRefresh()
// )

onMounted(async () => {
  loadFromEditorReturn()
  try {
    await loadRecipientLists()
  } finally {
    // dynamic-variable preview merge temporarily disabled
  }
})
watch(() => [route.query.campaignId, route.query.fromEditor], loadFromEditorReturn, { immediate: false })
watch(subjectOpen, (open) => {
  if (open) {
    void loadDynamicVariables()
  }
})

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

watch(subjectVariable, (val) => {
  if (val) {
    form.value.subject += val
    subjectVariable.value = ''
  }
})

function handleCreateFromScratch() {
  if (!editId.value) return
  designModalOpen.value = false
  form.value.templateMode = 'scratch'
  form.value.selectedTemplateId = ''
  const campaignId = editId.value
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({
      form: { ...form.value, templateMode: 'scratch' },
      campaignId
    }))
  }
  navigateTo(`/tenant/email-editor?campaignId=${campaignId}&token=local`)
}

function handleUseTemplate(template: ExistingTemplateOption) {
  if (!editId.value) return
  designModalOpen.value = false
  form.value.templateMode = 'existing'
  form.value.selectedTemplateId = template.id
  const fromTemplate = template.subject?.trim()
  if (fromTemplate) {
    form.value.subject = fromTemplate
  }
  const campaignId = editId.value
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

function buildTenantDetailForCache(campaignId: string): TenantCampaignDetail {
  const recipientsManual = form.value.recipientsMode === 'manual'
    ? [...new Set(form.value.recipientsManual.map((e) => e?.trim()).filter(isManualContactIdString))]
    : []
  const recipients: TenantCampaignDetail['recipients'] = recipientsManual.map((contactId) => {
    const lab = manualRecipientLabels.value[contactId]
    return {
      email: lab?.email?.trim() ?? '',
      contactId,
      name: lab?.name
    }
  })
  const now = new Date().toISOString()
  const createdAt = editCampaignMeta.value.createdAt
    ? editCampaignMeta.value.createdAt
    : now
  return {
    id: campaignId,
    name: form.value.name.trim(),
    sender: { name: form.value.senderName, email: form.value.senderEmail },
    recipientsType: form.value.recipientsMode,
    recipientsListId: form.value.recipientsListId || undefined,
    subject: form.value.subject,
    status: editCampaignStatus.value,
    recipients,
    templateHtml: savedTemplateHtml.value ?? '',
    createdAt,
    updatedAt: now
  }
}

function primeCampaignCacheAfterSave(savedId: string) {
  const detail = buildTenantDetailForCache(savedId)
  campaignStore.setCampaignDetailCache(savedId, detail)
  campaignStore.upsertCampaignInList(campaignStore.listRowFromDetail(detail))
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

  if (!editId.value) throw new Error('Missing campaign id.')
  await marketingApi.updateCampaign(editId.value, body)
  return editId.value
}

function setSaveErrorFromCatch(e: unknown) {
  const data =
    e && typeof e === 'object' && 'data' in e
      ? (e as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
  const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
  saveError.value = typeof raw === 'string' ? raw : 'Failed to save campaign'
}

function recipientsReadyForSchedule(): boolean {
  if (form.value.recipientsMode === 'manual') {
    return form.value.recipientsManual.some((id) => isManualContactIdString(String(id ?? '').trim()))
  }
  return !!form.value.recipientsListId?.trim()
}

function handleOpenScheduleWizard() {
  if (!campaignFormComplete.value) return
  saveError.value = null
  if (!form.value.name.trim()) {
    saveError.value = 'Campaign name is required'
    return
  }
  applyStoredOrSelectedTemplate()
  if (!savedTemplateHtml.value) {
    saveError.value = 'Complete the email design before scheduling.'
    return
  }
  if (!recipientsReadyForSchedule()) {
    saveError.value = 'Add recipients before scheduling.'
    return
  }
  openScheduleModalFromWizard()
}

async function confirmScheduleFromWizard() {
  if (!campaignFormComplete.value) return
  saveError.value = null
  scheduleError.value = ''
  if (!form.value.name.trim()) {
    saveError.value = 'Campaign name is required'
    return
  }
  const parsed = new Date(scheduleLocal.value)
  if (Number.isNaN(parsed.getTime())) {
    scheduleError.value = 'Pick a valid date and time.'
    return
  }
  applyStoredOrSelectedTemplate()
  if (!savedTemplateHtml.value) {
    saveError.value = 'Complete the email design before scheduling.'
    return
  }
  isSaving.value = true
  scheduleSubmitting.value = true
  try {
    const id = await persistSavedCampaign()
    clearCampaignSessionStorage()
    primeCampaignCacheAfterSave(id)
    const campaign = buildCampaignForSend(id)
    if (!canScheduleDraft(campaign)) {
      saveError.value = 'Add recipients before scheduling.'
      return
    }
    try {
      const scheduledIso = parsed.toISOString()
      await marketingApi.scheduleCampaignSend(id, scheduledIso)
      scheduleModalOpen.value = false
      const now = new Date().toISOString()
      campaignStore.patchCampaignDetailCache(id, {
        status: 'Scheduled',
        scheduledAt: scheduledIso,
        updatedAt: now
      })
      const cached = campaignStore.getCampaignDetailCache(id)
      if (cached) campaignStore.upsertCampaignInList(campaignStore.listRowFromDetail(cached))
      void campaignStore.fetchCampaigns()
      await navigateTo(`/tenant/campaigns/${id}`)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'data' in e
          ? (e as { data?: { message?: string } }).data?.message
          : e instanceof Error
            ? e.message
            : 'Could not schedule send.'
      scheduleError.value = typeof msg === 'string' ? msg : 'Could not schedule send.'
    }
  } catch (e: unknown) {
    setSaveErrorFromCatch(e)
  } finally {
    scheduleSubmitting.value = false
    isSaving.value = false
  }
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
      pendingPostSendNavigationId.value = id
      const campaign = buildCampaignForSend(id)
      const { poll } = await campaignStore.sendCampaign(campaign)
      if (!poll) {
        if (sendError.value) return
        const s = sendStatus.value
        if (s?.done) {
          sendSuccessSummary.value = {
            campaignName: form.value.name.trim() || 'campaign',
            sent: s.sent,
            failed: s.failed,
            campaignStatus: s.campaignStatus || 'Sent'
          }
          closeSendModal()
          return
        }
        pendingPostSendNavigationId.value = null
        primeCampaignCacheAfterSave(id)
        void campaignStore.fetchCampaigns()
        await navigateTo(`/tenant/campaigns/${id}`)
        return
      }
      startSendStatusPolling(id, async (res) => {
        sendSuccessSummary.value = {
          campaignName: form.value.name.trim() || campaignNameForSendModal.value,
          sent: res.sent,
          failed: res.failed,
          campaignStatus: res.campaignStatus
        }
      })
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
      const savedId = await persistSavedCampaign()
      clearCampaignSessionStorage()
      primeCampaignCacheAfterSave(savedId)
      void campaignStore.fetchCampaigns()
      await navigateTo(`/tenant/campaigns/${savedId}`)
    } catch (e: unknown) {
      setSaveErrorFromCatch(e)
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
