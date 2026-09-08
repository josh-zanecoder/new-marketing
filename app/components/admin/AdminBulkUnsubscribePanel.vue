<script setup lang="ts">
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import { parseUnsubscribeEmailSpreadsheetFile } from '~/utils/parseUnsubscribeEmailSpreadsheet'

const props = defineProps<{
  tenantId: string | null | undefined
}>()

type BulkResult = {
  totalSubmitted: number
  uniqueEmails: number
  updated: number
  alreadyUnsubscribed: number
  notFound: number
  invalid: string[]
}

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const parsedEmails = ref<string[]>([])
const parseError = ref('')
const parsing = ref(false)
const submitting = ref(false)
const confirmOpen = ref(false)
const result = ref<BulkResult | null>(null)
const submitError = ref('')
const dragOver = ref(false)

const canSubmit = computed(
  () => Boolean(props.tenantId?.trim()) && parsedEmails.value.length > 0 && !parsing.value && !submitting.value
)

function resetSelection() {
  selectedFile.value = null
  parsedEmails.value = []
  parseError.value = ''
  result.value = null
  submitError.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function handleFile(file: File | null | undefined) {
  resetSelection()
  if (!file) return

  const name = file.name.toLowerCase()
  const okExt =
    name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')
  if (!okExt) {
    parseError.value = 'Upload an Excel (.xlsx / .xls) or CSV file with an Email column.'
    return
  }

  selectedFile.value = file
  parsing.value = true
  try {
    const parsed = await parseUnsubscribeEmailSpreadsheetFile(file)
    if (!parsed.emails.length) {
      parseError.value = parsed.foundEmailColumn
        ? 'No email addresses found under the Email column.'
        : 'Could not find an Email column. Use a header named Email (column A).'
      return
    }
    parsedEmails.value = parsed.emails
  } catch (err) {
    parseError.value = fetchErrorMessage(err) || 'Failed to read spreadsheet.'
  } finally {
    parsing.value = false
  }
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  void handleFile(input.files?.[0])
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  void handleFile(file)
}

function openConfirm() {
  if (!canSubmit.value) return
  confirmOpen.value = true
}

async function confirmUnsubscribe() {
  if (!canSubmit.value || !props.tenantId?.trim()) return
  confirmOpen.value = false
  submitting.value = true
  submitError.value = ''
  result.value = null
  try {
    const res = await $fetch<BulkResult & { ok: boolean }>(
      `/api/v1/admin/tenants/${encodeURIComponent(props.tenantId.trim())}/contacts/bulk-unsubscribe`,
      {
        method: 'POST',
        body: { emails: parsedEmails.value }
      }
    )
    result.value = {
      totalSubmitted: res.totalSubmitted,
      uniqueEmails: res.uniqueEmails,
      updated: res.updated,
      alreadyUnsubscribed: res.alreadyUnsubscribed,
      notFound: res.notFound,
      invalid: res.invalid || []
    }
  } catch (err) {
    submitError.value = fetchErrorMessage(err) || 'Bulk unsubscribe failed.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-5">
    <div
      v-if="!tenantId"
      class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      This tenant has no <strong>tenant ID</strong> in the registry. Set one on the client record
      before uploading.
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
          Drop Excel / CSV here, or choose a file
        </p>
        <p class="mt-1 text-xs text-slate-500">
          First sheet · header <span class="font-mono">Email</span> · .xlsx / .xls / .csv
        </p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="btn-cta btn-cta--compact"
            :disabled="parsing || submitting"
            @click="fileInputRef?.click()"
          >
            Choose file
          </button>
          <button
            v-if="selectedFile"
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
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          @change="onFileInputChange"
        >
        <p v-if="selectedFile" class="mt-3 truncate text-sm text-slate-600">
          {{ selectedFile.name }}
          <span v-if="parsing" class="text-slate-400"> · reading…</span>
          <span v-else-if="parsedEmails.length" class="text-slate-400">
            · {{ parsedEmails.length.toLocaleString() }} email{{
              parsedEmails.length === 1 ? '' : 's'
            }}
          </span>
        </p>
        <p v-if="parseError" class="mt-2 text-sm text-red-700">{{ parseError }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn-cta"
          :disabled="!canSubmit"
          @click="openConfirm"
        >
          {{ submitting ? 'Unsubscribing…' : 'Unsubscribe contacts' }}
        </button>
        <p class="text-xs text-slate-500">
          Only contacts that exist in this tenant’s database are updated.
        </p>
      </div>

      <p v-if="submitError" class="text-sm text-red-700">{{ submitError }}</p>

      <div
        v-if="result"
        class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm shadow-slate-900/[0.03] sm:px-6"
      >
        <p class="text-sm font-semibold text-slate-900">Upload result</p>
        <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs text-slate-500">Unique emails</dt>
            <dd class="font-semibold tabular-nums text-slate-900">
              {{ result.uniqueEmails.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Unsubscribed</dt>
            <dd class="font-semibold tabular-nums text-emerald-700">
              {{ result.updated.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Already unsubscribed</dt>
            <dd class="font-semibold tabular-nums text-slate-800">
              {{ result.alreadyUnsubscribed.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Not found</dt>
            <dd class="font-semibold tabular-nums text-amber-800">
              {{ result.notFound.toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">Invalid rows</dt>
            <dd class="font-semibold tabular-nums text-slate-800">
              {{ result.invalid.length.toLocaleString() }}
            </dd>
          </div>
        </dl>
        <p
          v-if="result.invalid.length"
          class="mt-3 truncate text-xs text-slate-500"
          :title="result.invalid.join(', ')"
        >
          Invalid examples: {{ result.invalid.slice(0, 5).join(', ') }}
        </p>
      </div>
    </template>

    <ClientConfirmationModal
      :open="confirmOpen"
      title="Bulk unsubscribe contacts?"
      :message="`Mark ${parsedEmails.length.toLocaleString()} email${
        parsedEmails.length === 1 ? '' : 's'
      } as unsubscribed in this tenant? Contacts already unsubscribed are skipped; emails with no matching contact are reported as not found.`"
      confirm-text="Unsubscribe"
      variant="danger"
      :confirm-loading="submitting"
      @confirm="confirmUnsubscribe"
      @cancel="confirmOpen = false"
    />
  </div>
</template>
