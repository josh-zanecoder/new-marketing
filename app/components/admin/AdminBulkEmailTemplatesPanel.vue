<script setup lang="ts">
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  BULK_EMAIL_TEMPLATE_MAX_REQUEST_ITEM_BYTES,
  BULK_EMAIL_TEMPLATES_MAX,
  chunkBulkEmailTemplatesForRequests,
  estimateBulkEmailTemplateRequestItemBytes,
  readUploadedHtmlFile,
  templateNameFromUploadedFileName,
  type BulkEmailTemplateRequestItem
} from '~~/shared/utils/uploadedEmailHtml'

const props = defineProps<{
  /** Registry tenantId — required to POST. */
  tenantId: string | null | undefined
  /**
   * When set, show a tenant picker (admin Templates page).
   * Options use registry tenantId as value.
   */
  tenantOptions?: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  uploaded: []
  'update:tenantId': [value: string]
}>()

type StagedTemplate = {
  key: string
  fileName: string
  name: string
  subject: string
  htmlTemplate: string
  bytes: number
}

type BulkResult = {
  totalSubmitted: number
  createdCount: number
  errorCount: number
  created: Array<{ id: string; name: string; subject: string }>
  errors: Array<{ index: number; name: string; message: string }>
}

const fileInputRef = ref<HTMLInputElement | null>(null)
const staged = ref<StagedTemplate[]>([])
const parseError = ref('')
const parsing = ref(false)
const submitting = ref(false)
const confirmOpen = ref(false)
const result = ref<BulkResult | null>(null)
const submitError = ref('')
const dragOver = ref(false)
/** 1-based chunk progress while uploading (0 = idle). */
const uploadProgress = ref({ current: 0, total: 0 })

const selectedTenantId = computed({
  get: () => props.tenantId?.trim() || '',
  set: (value: string) => emit('update:tenantId', value)
})

const showTenantPicker = computed(() => Array.isArray(props.tenantOptions))

const canSubmit = computed(
  () =>
    Boolean(selectedTenantId.value)
    && staged.value.length > 0
    && !parsing.value
    && !submitting.value
)

function resetSelection() {
  staged.value = []
  parseError.value = ''
  result.value = null
  submitError.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function handleFiles(fileList: FileList | File[] | null | undefined) {
  result.value = null
  submitError.value = ''
  parseError.value = ''
  if (!fileList || !fileList.length) return

  const files = Array.from(fileList)
  const remaining = BULK_EMAIL_TEMPLATES_MAX - staged.value.length
  if (remaining <= 0) {
    parseError.value = `At most ${BULK_EMAIL_TEMPLATES_MAX} templates per upload.`
    return
  }

  parsing.value = true
  const next: StagedTemplate[] = [...staged.value]
  const errors: string[] = []
  try {
    for (const file of files.slice(0, remaining)) {
      try {
        const htmlTemplate = await readUploadedHtmlFile(file)
        const name = templateNameFromUploadedFileName(file.name)
        const draft: BulkEmailTemplateRequestItem = {
          name,
          subject: name,
          htmlTemplate
        }
        const estimated = estimateBulkEmailTemplateRequestItemBytes(draft)
        if (estimated > BULK_EMAIL_TEMPLATE_MAX_REQUEST_ITEM_BYTES) {
          errors.push(
            `${file.name}: too large for upload through typical proxies (~${Math.ceil(estimated / 1024)}KB). Keep each HTML under ~800KB.`
          )
          continue
        }
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          fileName: file.name,
          name,
          subject: name,
          htmlTemplate,
          bytes: file.size
        })
      } catch (err) {
        errors.push(`${file.name}: ${fetchErrorMessage(err) || 'Could not read file'}`)
      }
    }
    staged.value = next
    if (files.length > remaining) {
      errors.push(`Only the first ${BULK_EMAIL_TEMPLATES_MAX} files were kept.`)
    }
    if (errors.length) parseError.value = errors.join(' · ')
  } finally {
    parsing.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  void handleFiles(input.files)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  void handleFiles(event.dataTransfer?.files)
}

function removeStaged(key: string) {
  staged.value = staged.value.filter((row) => row.key !== key)
}

function openConfirm() {
  if (!canSubmit.value) return
  confirmOpen.value = true
}

async function confirmUpload() {
  if (!canSubmit.value || !selectedTenantId.value) return
  confirmOpen.value = false
  submitting.value = true
  submitError.value = ''
  result.value = null
  uploadProgress.value = { current: 0, total: 0 }

  const payload: BulkEmailTemplateRequestItem[] = staged.value.map((row) => ({
    name: row.name.trim(),
    subject: row.subject.trim() || row.name.trim(),
    htmlTemplate: row.htmlTemplate
  }))

  // Chunk so each POST stays under common nginx 1m / CDN body limits — works
  // the same when marketing is deployed without nginx.
  const chunks = chunkBulkEmailTemplatesForRequests(payload)
  uploadProgress.value = { current: 0, total: chunks.length }

  const aggregated: BulkResult = {
    totalSubmitted: 0,
    createdCount: 0,
    errorCount: 0,
    created: [],
    errors: []
  }
  let indexOffset = 0

  try {
    for (let i = 0; i < chunks.length; i++) {
      uploadProgress.value = { current: i + 1, total: chunks.length }
      const chunk = chunks[i]!
      try {
        const res = await $fetch<BulkResult & { ok: boolean }>(
          `/api/v1/admin/tenants/${encodeURIComponent(selectedTenantId.value)}/email-templates/bulk`,
          {
            method: 'POST',
            credentials: 'include',
            body: { templates: chunk }
          }
        )
        aggregated.totalSubmitted += res.totalSubmitted
        aggregated.createdCount += res.createdCount
        aggregated.errorCount += res.errorCount
        aggregated.created.push(...(res.created ?? []))
        for (const err of res.errors ?? []) {
          aggregated.errors.push({
            ...err,
            index: err.index + indexOffset
          })
        }
      } catch (err) {
        const message = fetchErrorMessage(err) || 'Chunk upload failed.'
        // Surface proxy/body-limit failures clearly; continue other chunks when possible.
        for (let j = 0; j < chunk.length; j++) {
          aggregated.totalSubmitted += 1
          aggregated.errorCount += 1
          aggregated.errors.push({
            index: indexOffset + j,
            name: chunk[j]?.name || '',
            message
          })
        }
        // Hard fail the rest if this looks like a gateway/body-size rejection.
        if (/413|entity too large|request entity|body.*limit|payload too large/i.test(message)) {
          submitError.value =
            'Upload blocked by a request size limit. Templates are sent in small batches automatically — retry, or shrink oversized HTML files.'
          break
        }
      }
      indexOffset += chunk.length
    }

    result.value = aggregated
    if (aggregated.createdCount > 0) {
      staged.value = []
      emit('uploaded')
    }
    if (!submitError.value && aggregated.errorCount > 0 && aggregated.createdCount === 0) {
      submitError.value = 'No templates were created. See errors below.'
    }
  } catch (err) {
    submitError.value = fetchErrorMessage(err) || 'Bulk upload failed.'
  } finally {
    submitting.value = false
    uploadProgress.value = { current: 0, total: 0 }
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="min-w-0 space-y-5">
    <div
      v-if="showTenantPicker"
      class="flex flex-col gap-2 sm:max-w-md"
    >
      <label class="text-xs font-semibold uppercase tracking-wider text-slate-500" for="bulk-tpl-tenant">
        Target tenant
      </label>
      <select
        id="bulk-tpl-tenant"
        v-model="selectedTenantId"
        class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
      >
        <option value="">
          Select a tenant…
        </option>
        <option
          v-for="opt in tenantOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div
      v-if="!selectedTenantId"
      class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <template v-if="showTenantPicker">
        Choose a tenant with a registry <strong>tenant ID</strong> before uploading.
      </template>
      <template v-else>
        This tenant has no <strong>tenant ID</strong> in the registry. Set one on the client
        record before uploading.
      </template>
    </div>

    <template v-else>
      <div
        class="rounded-2xl border border-dashed px-5 py-8 text-center transition sm:px-8"
        :class="
          dragOver
            ? 'border-primary-400 bg-primary-50/60'
            : 'border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03]'
        "
        @dragenter.prevent="dragOver = true"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <p class="text-sm font-medium text-slate-800">
          Drop .html files here, or choose files
        </p>
        <p class="mt-1 text-xs text-slate-500">
          Multiple files · .html / .htm · max {{ BULK_EMAIL_TEMPLATES_MAX }} per session ·
          sent in small batches (safe behind nginx or without it)
        </p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="btn-cta btn-cta--compact"
            :disabled="parsing || submitting"
            @click="fileInputRef?.click()"
          >
            Choose files
          </button>
          <button
            v-if="staged.length"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            :disabled="parsing || submitting"
            @click="resetSelection"
          >
            Clear
          </button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          multiple
          accept=".html,.htm,text/html"
          @change="onFileInputChange"
        >
        <p v-if="parsing" class="mt-3 text-sm text-slate-500">
          Reading files…
        </p>
        <p v-else-if="staged.length" class="mt-3 text-sm text-slate-600">
          {{ staged.length }} file{{ staged.length === 1 ? '' : 's' }} ready
        </p>
        <p v-if="parseError" class="mt-2 text-sm text-red-700">
          {{ parseError }}
        </p>
      </div>

      <div
        v-if="staged.length"
        class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.03]"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3 font-semibold">
                  File
                </th>
                <th class="px-4 py-3 font-semibold">
                  Name
                </th>
                <th class="px-4 py-3 font-semibold">
                  Subject
                </th>
                <th class="px-4 py-3 font-semibold">
                  Size
                </th>
                <th class="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in staged"
                :key="row.key"
                class="border-b border-slate-50 last:border-0"
              >
                <td class="max-w-[10rem] truncate px-4 py-2.5 text-slate-500" :title="row.fileName">
                  {{ row.fileName }}
                </td>
                <td class="px-4 py-2">
                  <input
                    v-model="row.name"
                    type="text"
                    class="w-full min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                </td>
                <td class="px-4 py-2">
                  <input
                    v-model="row.subject"
                    type="text"
                    class="w-full min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                </td>
                <td class="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-500">
                  {{ formatBytes(row.bytes) }}
                </td>
                <td class="px-4 py-2 text-right">
                  <button
                    type="button"
                    class="text-sm font-medium text-slate-500 hover:text-red-700"
                    :disabled="submitting"
                    @click="removeStaged(row.key)"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn-cta"
          :disabled="!canSubmit"
          @click="openConfirm"
        >
          <template v-if="submitting && uploadProgress.total">
            Uploading batch {{ uploadProgress.current }}/{{ uploadProgress.total }}…
          </template>
          <template v-else-if="submitting">
            Uploading…
          </template>
          <template v-else>
            Upload {{ staged.length || '' }} template{{ staged.length === 1 ? '' : 's' }}
          </template>
        </button>
        <p class="text-xs text-slate-500">
          Shared library templates · auto-chunked requests · unsubscribe footer added when missing
        </p>
      </div>

      <p v-if="submitError" class="text-sm text-red-700">
        {{ submitError }}
      </p>

      <div
        v-if="result"
        class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm shadow-slate-900/[0.03] sm:px-6"
      >
        <p class="text-sm font-semibold text-slate-900">
          Upload result
        </p>
        <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs text-slate-500">
              Submitted
            </dt>
            <dd class="font-semibold tabular-nums text-slate-900">
              {{ result.totalSubmitted.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">
              Created
            </dt>
            <dd class="font-semibold tabular-nums text-emerald-700">
              {{ result.createdCount.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">
              Failed
            </dt>
            <dd class="font-semibold tabular-nums text-amber-800">
              {{ result.errorCount.toLocaleString() }}
            </dd>
          </div>
        </dl>
        <ul
          v-if="result.errors.length"
          class="mt-3 space-y-1 text-xs text-red-700"
        >
          <li
            v-for="(err, i) in result.errors.slice(0, 8)"
            :key="`${err.index}-${i}`"
          >
            {{ err.name || `Row ${err.index + 1}` }}: {{ err.message }}
          </li>
        </ul>
      </div>
    </template>

    <ClientConfirmationModal
      :open="confirmOpen"
      title="Upload email templates?"
      :message="`Create ${staged.length.toLocaleString()} template${
        staged.length === 1 ? '' : 's'
      } in this tenant’s library? Existing templates with the same name are not overwritten.`"
      confirm-text="Upload"
      variant="primary"
      :confirm-loading="submitting"
      @confirm="confirmUpload"
      @cancel="confirmOpen = false"
    />
  </div>
</template>
