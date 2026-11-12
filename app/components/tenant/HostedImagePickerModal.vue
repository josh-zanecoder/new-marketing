<script setup lang="ts">
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import {
  groupTenantHostedImagesByDay,
  type TenantHostedImage
} from '~~/shared/tenantHostedImages'
import {
  isHostedImagePickerUploadDisabled,
  shouldShowHostedImagePickerListSkeleton
} from '~~/shared/utils/hostedImagePickerUploadGate'

const props = defineProps<{
  open: boolean
  title?: string
  confirmText?: string
}>()

const emit = defineEmits<{
  close: []
  select: [item: TenantHostedImage]
}>()

const marketingApi = useTenantMarketingApi()
const toast = useAppToast()

const pending = ref(false)
const uploadPending = ref(false)
const loadError = ref('')
const items = ref<TenantHostedImage[]>([])
const selectedId = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const dayGroups = computed(() => groupTenantHostedImagesByDay(items.value))
const selectedItem = computed(
  () => items.value.find((i) => i.id === selectedId.value) ?? null
)
/** Upload stays enabled while the gallery list loads; only block mid-upload. */
const uploadDisabled = computed(() =>
  isHostedImagePickerUploadDisabled(uploadPending.value)
)
const showListSkeleton = computed(() =>
  shouldShowHostedImagePickerListSkeleton(pending.value, items.value.length)
)

async function loadImages(opts?: { selectId?: string | null }) {
  pending.value = true
  loadError.value = ''
  try {
    const res = await marketingApi.fetchTenantHostedImages()
    items.value = Array.isArray(res.items) ? res.items : []
    const prefer = opts?.selectId
    if (prefer && items.value.some((i) => i.id === prefer)) {
      selectedId.value = prefer
    } else if (selectedId.value && !items.value.some((i) => i.id === selectedId.value)) {
      selectedId.value = null
    }
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? '')
        : ''
    loadError.value = message || (e instanceof Error ? e.message : 'Failed to load images')
    items.value = []
  } finally {
    pending.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    selectedId.value = null
    loadError.value = ''
    void loadImages()
  }
)

function onClose() {
  if (uploadPending.value) return
  emit('close')
}

function onConfirm() {
  if (!selectedItem.value || uploadPending.value) return
  emit('select', selectedItem.value)
}

function onUploadClick() {
  if (uploadDisabled.value) return
  loadError.value = ''
  fileInputRef.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploadPending.value) return

  uploadPending.value = true
  loadError.value = ''
  try {
    const dataUrl = await compressCustomMarketingImageFile(file)
    const uploaded = await marketingApi.uploadTenantHostedImage({ dataUrl })
    const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
    const id = String(uploaded?.id || uploaded?.objectPath || '').trim()
    if (!url || !id) {
      throw new Error('Upload succeeded but no hosted link was returned.')
    }

    // Same library as Images page — insert immediately with the HTTPS link.
    const item: TenantHostedImage = {
      id,
      url,
      objectPath: uploaded.objectPath || id,
      fileName: file.name || id.split('/').pop() || 'image',
      contentType: file.type || 'image/jpeg',
      size: file.size || 0,
      createdAt: new Date().toISOString()
    }
    toast.success('Uploaded to Images — inserting hosted link')
    emit('select', item)
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? '')
        : ''
    loadError.value = message || (e instanceof Error ? e.message : 'Could not upload image')
    toast.error(loadError.value)
  } finally {
    uploadPending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      @click.self="onClose"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        :aria-label="title ?? 'Choose image'"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-slate-900">
              {{ title ?? 'Choose image' }}
            </h3>
            <p class="mt-1 text-sm text-slate-500">
              Pick a hosted image from
              <NuxtLink
                to="/tenant/images"
                class="font-semibold text-primary-600 hover:text-primary-700"
                @click="onClose"
              >
                Images
              </NuxtLink>
              , or upload from this device — uploads get an HTTPS link and appear on Images.
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              class="sr-only"
              :disabled="uploadDisabled"
              @change="onFileChange"
            >
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="uploadDisabled"
              @click="onUploadClick"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {{ uploadPending ? 'Uploading…' : 'Upload' }}
            </button>
            <button
              type="button"
              class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              aria-label="Close"
              :disabled="uploadPending"
              @click="onClose"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p v-if="loadError" class="mb-3 text-sm text-red-600" role="alert">
            {{ loadError }}
          </p>

          <div
            v-if="showListSkeleton"
            class="space-y-4"
            aria-busy="true"
            aria-label="Loading images"
          >
            <div class="h-3 w-16 animate-pulse rounded bg-slate-100" />
            <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              <li
                v-for="n in 10"
                :key="`picker-skel-${n}`"
                class="aspect-square animate-pulse rounded-xl border border-slate-100 bg-slate-100"
              />
            </ul>
          </div>

          <div
            v-else-if="!items.length"
            class="flex min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center"
          >
            <p class="text-sm font-semibold text-slate-900">No hosted images yet</p>
            <p class="mt-2 max-w-sm text-sm text-slate-500">
              Upload from this device to create an HTTPS link and save it to Images.
            </p>
            <button
              type="button"
              class="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="uploadDisabled"
              @click="onUploadClick"
            >
              {{ uploadPending ? 'Uploading…' : 'Upload from device' }}
            </button>
          </div>

          <div v-else class="space-y-6">
            <section v-for="group in dayGroups" :key="group.key">
              <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {{ group.label }}
              </h4>
              <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                <li v-for="item in group.items" :key="item.id">
                  <button
                    type="button"
                    class="relative aspect-square w-full overflow-hidden rounded-xl border bg-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60"
                    :class="
                      selectedId === item.id
                        ? 'border-primary-400 ring-2 ring-primary-500/30'
                        : 'border-slate-200 hover:border-slate-300'
                    "
                    :disabled="uploadPending"
                    :aria-pressed="selectedId === item.id"
                    :aria-label="`Select ${item.fileName}`"
                    @click="selectedId = item.id"
                    @dblclick="selectedId = item.id; onConfirm()"
                  >
                    <img
                      :src="item.url"
                      :alt="item.fileName"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    >
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p class="text-xs text-slate-500">
            Uploads are stored on
            <NuxtLink
              to="/tenant/images"
              class="font-semibold text-primary-600 hover:text-primary-700"
              @click="onClose"
            >
              Images
            </NuxtLink>
            with a shareable link.
          </p>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              :disabled="uploadPending"
              @click="onClose"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedItem || uploadPending"
              @click="onConfirm"
            >
              {{ confirmText ?? 'Insert image' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
