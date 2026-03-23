<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    <div class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl lg:px-8">
      <NuxtLink
        :to="cancelOrBackHref"
        class="mb-10 inline-flex items-center gap-2.5 text-base font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ cancelOrBackLabel }}
      </NuxtLink>

      <div v-if="showEditSkeleton" class="mb-12 space-y-10 animate-pulse">
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
        <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <div v-for="n in 4" :key="n" class="flex items-center gap-4 border-b border-slate-100 px-8 py-5 last:border-b-0">
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
      <header class="mb-12">
        <nav class="mb-3 flex items-center gap-2 text-base text-slate-500" />
        <h1 class="text-4xl font-bold text-slate-900 tracking-tight">{{ isEditMode ? 'Edit campaign' : 'Create campaign' }}</h1>
        <p class="mt-2 text-lg text-slate-600">
          Configure your campaign step by step. Start with the name, then add sender, recipients, subject, and design.
        </p>
      </header>

      <div class="space-y-6">
        <div>
          <label class="mb-2.5 block text-base font-semibold text-slate-700">Campaign name</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="e.g. Q1 Newsletter"
            class="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
          >
        </div>

        <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <!-- Sender -->
        <div class="border-b border-slate-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-5 px-8 py-5 text-left hover:bg-slate-50/60 transition-colors"
            @click="senderOpen = !senderOpen"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                :class="senderComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'"
              >
                <svg v-if="senderComplete" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div class="text-lg font-semibold text-slate-900">Sender</div>
                <div class="mt-0.5 text-base text-slate-500">
                  {{ form.senderName && form.senderEmail ? `${form.senderName} • ${form.senderEmail}` : 'Add sender name and email' }}
                </div>
              </div>
            </div>
            <span class="rounded-lg border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">{{ senderOpen ? 'Close' : 'Manage sender' }}</span>
          </button>
          <div v-if="senderOpen" class="border-t border-slate-100 bg-slate-50/60 px-8 py-6">
            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-base font-medium text-slate-700">Sender name</label>
                <input
                  v-model="form.senderName"
                  type="text"
                  placeholder="Sender name"
                  class="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
              </div>
              <div>
                <label class="mb-2 block text-base font-medium text-slate-700">Sender email</label>
                <input
                  v-model="form.senderEmail"
                  type="email"
                  placeholder="sender@example.com"
                  class="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Recipients -->
        <div class="border-b border-slate-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-5 px-8 py-5 text-left hover:bg-slate-50/50 transition-colors"
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
              <div>
                <div class="text-lg font-semibold text-slate-900">Recipients</div>
                <div class="mt-0.5 text-base text-slate-500">{{ recipientsDescription }}</div>
              </div>
            </div>
            <span class="rounded-lg border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">{{ recipientsOpen ? 'Close' : 'Add recipients' }}</span>
          </button>
          <div v-if="recipientsOpen" class="border-t border-slate-100 bg-slate-50/50 px-8 py-6">
            <div class="space-y-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  :class="[
                    'rounded-lg border px-5 py-4 text-left text-base font-medium transition-colors',
                    form.recipientsMode === 'list'
                      ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
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
                    'rounded-lg border px-5 py-4 text-left text-base font-medium transition-colors',
                    form.recipientsMode === 'manual'
                      ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                  ]"
                  @click="form.recipientsMode = 'manual'"
                >
                  Enter manually
                  <div class="mt-1.5 text-sm font-normal text-slate-500">Paste emails separated by comma or new line</div>
                </button>
              </div>
              <div v-if="form.recipientsMode === 'list'">
                <label class="mb-2 block text-base font-medium text-slate-700">Recipient list</label>
                <select
                  v-model="form.recipientsListId"
                  class="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Choose a list</option>
                  <option v-for="list in recipientLists" :key="list.id" :value="list.id">{{ list.name }}</option>
                </select>
              </div>
              <div v-else class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <label class="text-base font-medium text-slate-700">Recipients</label>
                  <div class="flex items-center gap-2">
                    <a
                      href="#"
                      class="text-sm font-medium text-slate-600 hover:text-slate-900 underline"
                      @click.prevent="downloadSampleExcel"
                    >
                      Download sample
                    </a>
                    <span class="text-slate-300">|</span>
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept=".xlsx,.xls"
                      class="hidden"
                      @change="handleBulkUpload"
                    >
                    <button
                      type="button"
                      class="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                      :disabled="isUploading"
                      @click="fileInputRef?.click()"
                    >
                      {{ isUploading ? 'Uploading...' : 'Upload Excel' }}
                    </button>
                    <span class="text-slate-300">|</span>
                    <button
                      type="button"
                      class="text-sm font-medium text-slate-600 hover:text-slate-900"
                      @click="addManualRecipient"
                    >
                      Add email
                    </button>
                  </div>
                </div>
                <p v-if="bulkUploadError" class="text-sm text-red-600">{{ bulkUploadError }}</p>
                <div v-for="(value, index) in form.recipientsManual" :key="index" class="flex gap-3">
                  <input
                    v-model="form.recipientsManual[index]"
                    type="email"
                    placeholder="recipient@example.com"
                    class="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                  <button
                    v-if="form.recipientsManual.length > 1"
                    type="button"
                    class="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50"
                    @click="removeManualRecipient(index)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subject -->
        <div class="border-b border-slate-100 last:border-b-0">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-5 px-8 py-5 text-left hover:bg-slate-50/50 transition-colors"
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
              <div>
                <div class="text-lg font-semibold text-slate-900">Subject</div>
                <div class="mt-0.5 text-base text-slate-500">{{ form.subject || 'Add a subject line for this campaign' }}</div>
              </div>
            </div>
            <span class="rounded-lg border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">{{ subjectOpen ? 'Close' : 'Manage' }}</span>
          </button>
          <div v-if="subjectOpen" class="border-t border-slate-100 bg-slate-50/50 px-8 py-6">
            <label class="mb-2 block text-base font-medium text-slate-700">Subject line</label>
            <div class="flex gap-3">
              <input
                v-model="form.subject"
                type="text"
                placeholder="Enter email subject line"
                class="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
              <select
                v-model="subjectVariable"
                class="w-44 shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="">Insert variable</option>
                <option v-for="v in subjectVariables" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Design -->
        <div ref="designSectionRef">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-5 px-8 py-5 text-left hover:bg-slate-50/50 transition-colors"
            @click="designOpen = !designOpen"
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
              <div>
                <div class="text-lg font-semibold text-slate-900">Design</div>
                <div class="mt-0.5 text-base text-slate-500">
                  {{ form.templateMode === 'scratch' ? 'Create from scratch' : form.templateMode === 'existing' ? 'Pick a template' : 'Create your email content' }}
                </div>
              </div>
            </div>
            <span class="rounded-lg border border-slate-200 px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50">{{ designOpen ? 'Close' : 'Start designing' }}</span>
          </button>
          <div v-if="designOpen" class="border-t border-slate-100 bg-slate-50/50 px-8 py-6">
            <div class="space-y-5">
              <label class="block text-base font-medium text-slate-700">Email template</label>
              <div class="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  :class="[
                    'flex items-start gap-4 rounded-lg border px-5 py-4 text-left transition-colors',
                    form.templateMode === 'scratch'
                      ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                  ]"
                  @click="handleCreateFromScratch"
                >
                  <div class="mt-0.5 rounded-xl bg-slate-100 p-2.5">
                    <svg class="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div class="text-base font-medium">Create from scratch</div>
                    <div class="mt-0.5 text-sm text-slate-500">Start with a blank template</div>
                  </div>
                </button>
                <button
                  type="button"
                  :class="[
                    'flex items-start gap-4 rounded-lg border px-5 py-4 text-left transition-colors',
                    form.templateMode === 'existing'
                      ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                      : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                  ]"
                  @click="form.templateMode = 'existing'; form.selectedTemplateId = form.selectedTemplateId || existingTemplates[0]?.id || ''"
                >
                  <div class="mt-0.5 rounded-xl bg-slate-100 p-2.5">
                    <svg class="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                    </svg>
                  </div>
                  <div>
                    <div class="text-base font-medium">Use existing template</div>
                    <div class="mt-0.5 text-sm text-slate-500">Pick from saved templates</div>
                  </div>
                </button>
              </div>
              <div v-if="savedTemplateHtml && (returnCampaignId || editId)" class="mt-6 pt-6 border-t border-slate-200">
                <label class="mb-3 block text-base font-medium text-slate-700">Email preview</label>
                <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div class="relative min-h-[320px] max-h-[480px] overflow-auto bg-[#f8f4ef]">
                    <iframe
                      :srcdoc="previewSrcdoc(savedTemplateHtml || '')"
                      title="Email preview"
                      class="absolute inset-0 h-full w-full border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <div class="p-5">
                    <NuxtLink
                      :to="`/tenant/email-editor?campaignId=${returnCampaignId || editId}&token=local`"
                      class="block w-full rounded-lg border border-slate-200 py-3.5 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit design
                    </NuxtLink>
                  </div>
                </div>
              </div>
              <div v-if="form.templateMode === 'existing'" class="mt-6 pt-6 border-t border-slate-200">
                <label class="mb-3 block text-base font-medium text-slate-700">Existing templates</label>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div
                    v-for="template in existingTemplates"
                    :key="template.id"
                    class="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <div class="px-5 py-4 text-base font-medium text-slate-900">{{ template.name }}</div>
                    <div class="relative min-h-[180px] overflow-hidden bg-[#f8f4ef]">
                      <iframe
                        :srcdoc="previewSrcdoc(template.html, 0.28)"
                        :title="template.name"
                        class="absolute inset-0 h-full w-full border-0"
                        sandbox="allow-same-origin"
                      />
                    </div>
                    <div class="p-5">
                      <button
                        type="button"
                        class="w-full rounded-lg bg-slate-900 py-3.5 text-base font-medium text-white hover:bg-slate-800"
                        @click="handleUseTemplate(template)"
                      >
                        Use template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="saveError" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
        {{ saveError }}
      </div>
      <div class="flex items-center justify-end gap-4 pt-10">
        <NuxtLink
          :to="cancelOrBackHref"
          class="rounded-xl border border-slate-200 px-6 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          :class="{ 'pointer-events-none opacity-50': isSaving }"
        >
          Cancel
        </NuxtLink>
        <button
          type="button"
          class="rounded-xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:shadow-xl transition-all disabled:opacity-50"
          :disabled="isSaving"
          @click.prevent="handleCreate"
        >
          {{ isSaving ? 'Saving...' : savedTemplateHtml ? 'Save campaign' : 'Continue to design' }}
        </button>
      </div>
    </div>
      </template>
  </div>
  </div>  
</template>
<script setup lang="ts">
import type { WorkSheet } from 'xlsx'
import { useCampaignStore } from '~/store/campaignStore'

type XlsxModule = typeof import('xlsx')

const PENDING_CAMPAIGN_KEY = 'mortdash-pending-campaign'

const form = ref({
  name: '',
  senderName: 'Mortdash',
  senderEmail: 'joshdanielsaraa@gmail.com',
  subject: '',
  recipientsMode: 'list' as 'list' | 'manual',
  recipientsListId: '',
  recipientsManual: [''],
  templateMode: 'scratch' as 'scratch' | 'existing',
  selectedTemplateId: ''
})

const senderOpen = ref(false)
const recipientsOpen = ref(false)
const subjectOpen = ref(false)
const designOpen = ref(false)
const subjectVariable = ref('')
const returnCampaignId = ref<string | null>(null)
const savedTemplateHtml = ref<string | null>(null)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

const recipientLists = [
  { id: 'all', name: 'All contacts' },
  { id: 'prospects', name: 'Prospects' },
  { id: 'customers', name: 'Customers' },
  { id: 'reengagement', name: 'Re-engagement' }
]

const subjectVariables = [
  { value: '{{user.firstName}}', label: 'First name' },
  { value: '{{user.lastName}}', label: 'Last name' },
  { value: '{{user.email}}', label: 'Email' },
  { value: '{{user.company}}', label: 'Company' }
]

const existingTemplates = [
  { id: 'newsletter', name: 'Newsletter', html: '<div>Newsletter template</div>' },
  { id: 'promo', name: 'Promotional', html: '<div>Promo template</div>' }
]

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
    const opts = useTenantFetchOptions()
    const res = await $fetch<{ campaign: {
      name: string
      sender: { name: string; email: string }
      recipientsType: 'manual' | 'list'
      recipientsListId?: string
      subject: string
      recipients: { email: string }[]
      templateHtml?: string | null
    } }>(`/api/v1/campaigns/${editId.value}`, opts)
    const c = res.campaign
    form.value = {
      name: c.name,
      senderName: c.sender?.name || 'Mortdash',
      senderEmail: c.sender?.email || 'joshdanielsaraa@gmail.com',
      subject: c.subject || '',
      recipientsMode: c.recipientsType || 'manual',
      recipientsListId: c.recipientsListId || '',
      recipientsManual: c.recipients?.length ? c.recipients.map((r) => r.email) : [''],
      templateMode: 'scratch',
      selectedTemplateId: ''
    }
    returnCampaignId.value = editId.value
    const fromEditor = route.query.fromEditor === '1'
    if (c.templateHtml && !fromEditor) savedTemplateHtml.value = c.templateHtml
    designOpen.value = !!c.templateHtml || fromEditor
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
      const opts = useTenantFetchOptions()
      const res = await $fetch<{ campaign: {
        name: string
        sender: { name: string; email: string }
        recipientsType: 'manual' | 'list'
        recipientsListId?: string
        subject: string
        recipients: { email: string }[]
      } }>(`/api/v1/campaigns/${campaignId}`, opts)
      const c = res.campaign
      form.value = {
        name: c.name,
        senderName: c.sender?.name || 'Mortdash',
        senderEmail: c.sender?.email || 'joshdanielsaraa@gmail.com',
        subject: c.subject || '',
        recipientsMode: c.recipientsType || 'manual',
        recipientsListId: c.recipientsListId || '',
        recipientsManual: c.recipients?.length ? c.recipients.map((r) => r.email) : [''],
        templateMode: form.value.templateMode,
        selectedTemplateId: form.value.selectedTemplateId
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
  designOpen.value = true
  await nextTick()
  designSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const designSectionRef = ref<HTMLElement | null>(null)

onMounted(loadFromEditorReturn)
watch(() => [route.query.campaignId, route.query.fromEditor], loadFromEditorReturn, { immediate: false })

const recipientsDescription = computed(() => {
  if (form.value.recipientsMode === 'manual') {
    const count = form.value.recipientsManual.filter(v => v.trim().length > 0).length
    return count > 0 ? `${count} manual recipient${count === 1 ? '' : 's'}` : 'Add recipients manually'
  }
  const selected = recipientLists.find(l => l.id === form.value.recipientsListId)
  return selected ? `List: ${selected.name}` : 'Select a recipient list'
})

const senderComplete = computed(() => !!(form.value.senderName?.trim() && form.value.senderEmail?.trim()))
const recipientsComplete = computed(() => {
  if (form.value.recipientsMode === 'list') return !!form.value.recipientsListId
  return form.value.recipientsManual.some(v => v.trim().length > 0)
})
const subjectComplete = computed(() => !!form.value.subject?.trim())
const designComplete = computed(() => !!savedTemplateHtml.value || (form.value.templateMode === 'existing' && form.value.selectedTemplateId))

function addManualRecipient() {
  form.value.recipientsManual = [...form.value.recipientsManual, '']
}

function removeManualRecipient(index: number) {
  form.value.recipientsManual = form.value.recipientsManual.filter((_, i) => i !== index)
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
    const existing = new Set(form.value.recipientsManual.map((e) => e.trim().toLowerCase()).filter(Boolean))
    const toAdd = emails.filter((e) => !existing.has(e))
    form.value.recipientsManual = [
      ...form.value.recipientsManual.filter((e) => e.trim()),
      ...toAdd
    ]
    if (form.value.recipientsManual.length === 0) form.value.recipientsManual = ['']
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

function handleUseTemplate(template: { id: string; name: string; html: string }) {
  const campaignId = editId.value || `temp-${Date.now()}`
  const builderId = `builder-${Date.now()}`
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(builderId, template.html)
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({ form: { ...form.value }, campaignId }))
  }
  navigateTo(`/tenant/email-editor?campaignId=${campaignId}&builderId=${builderId}&token=local`)
}

async function handleCreate() {
  saveError.value = null
  if (!form.value.name.trim()) {
    saveError.value = 'Campaign name is required'
    return
  }

  try {
    // Re-read template from sessionStorage if we have campaignId but template wasn't loaded (e.g. route timing)
    const cid = returnCampaignId.value || (route.query.campaignId as string)
    if (!savedTemplateHtml.value && cid && typeof window !== 'undefined') {
      const template = window.sessionStorage.getItem(`campaign-template-${cid}`)
      if (template) savedTemplateHtml.value = template
    }

    // If existing template selected but no editor visit, use template HTML directly (don't go to editor)
    if (!savedTemplateHtml.value && form.value.templateMode === 'existing' && form.value.selectedTemplateId) {
      const template = existingTemplates.find(t => t.id === form.value.selectedTemplateId)
      if (template) savedTemplateHtml.value = template.html
    }

    // If we have a saved template (returned from editor or selected template), save to DB
    if (savedTemplateHtml.value) {
      isSaving.value = true
      try {
        const recipientsManual = form.value.recipientsMode === 'manual'
          ? form.value.recipientsManual.map((e) => e?.trim()).filter((e): e is string => !!e && e.includes('@'))
          : []

        const body = {
          name: form.value.name.trim(),
          senderName: form.value.senderName,
          senderEmail: form.value.senderEmail,
          subject: form.value.subject,
          recipientsType: form.value.recipientsMode,
          recipientsListId: form.value.recipientsListId || undefined,
          recipientsManual,
          templateHtml: savedTemplateHtml.value
        }

        const opts = useTenantFetchOptions()
        if (isEditMode.value && editId.value) {
          await $fetch(`/api/v1/campaigns/${editId.value}`, { method: 'PUT', body, ...opts })
        } else {
          await $fetch<{ id: string }>('/api/v1/campaigns', { method: 'POST', body, ...opts })
        }

        if (typeof window !== 'undefined') {
          if (returnCampaignId.value) {
            window.sessionStorage.removeItem(`campaign-template-${returnCampaignId.value}`)
          }
          window.sessionStorage.removeItem(PENDING_CAMPAIGN_KEY)
        }
        const store = useCampaignStore()
        await store.fetchCampaigns()
        await navigateTo(isEditMode.value ? `/tenant/campaigns/${editId.value}` : '/tenant/campaigns')
      } catch (e: unknown) {
        const data =
          e && typeof e === 'object' && 'data' in e
            ? (e as { data?: { message?: string; statusMessage?: string } }).data
            : undefined
        const raw = data?.message ?? data?.statusMessage ?? (e instanceof Error ? e.message : undefined)
        const err = typeof raw === 'string' ? raw : 'Failed to save campaign'
        saveError.value = err
      } finally {
        isSaving.value = false
      }
      return
    }

  // No design yet - go to editor (only for scratch; existing template without selection falls through)
  const campaignId = returnCampaignId.value || editId.value || `temp-${Date.now()}`
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(PENDING_CAMPAIGN_KEY, JSON.stringify({ form: form.value, campaignId }))
  }
  const params = new URLSearchParams()
  params.set('campaignId', campaignId)
  params.set('token', 'local')
  if (form.value.templateMode === 'existing') {
    const templateId = form.value.selectedTemplateId || existingTemplates[0]?.id
    const template = existingTemplates.find(t => t.id === templateId)
    if (template) {
      const builderId = `builder-${campaignId}-${Date.now()}`
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(builderId, template.html)
      }
      params.set('builderId', builderId)
    }
  }
  navigateTo(`/tenant/email-editor?${params.toString()}`)
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
