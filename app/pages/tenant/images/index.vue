<script setup lang="ts">
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import {
  groupTenantHostedImagesByDay,
  type TenantHostedImage
} from '~~/shared/tenantHostedImages'

definePageMeta({ layout: 'default' })

const marketingApi = useTenantMarketingApi()
const toast = useAppToast()
const router = useRouter()
const { copyText } = useClipboardCopy()
const {
  allowTenantImages,
  loadDefaultCampaignSender,
  loaded: imagesFlagLoaded
} = useDefaultCampaignSender()
void loadDefaultCampaignSender()

const canUseImageLibrary = computed(
  () => imagesFlagLoaded.value && allowTenantImages.value === true
)

const pending = ref(true)
const uploadPending = ref(false)
const deletePending = ref(false)
const loadError = ref('')
const items = ref<TenantHostedImage[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedId = ref<string | null>(null)
const selectMode = ref(false)
const checkedIds = ref<string[]>([])
const copyFlashId = ref<string | null>(null)
const deleteConfirmOpen = ref(false)
const pendingDeletePaths = ref<string[]>([])
const previewOpen = ref(false)
const previewItem = ref<TenantHostedImage | null>(null)
let copyFlashTimer: ReturnType<typeof setTimeout> | null = null
let previewEscListener: ((e: KeyboardEvent) => void) | null = null

const dayGroups = computed(() => groupTenantHostedImagesByDay(items.value))
const itemCount = computed(() => items.value.length)
const selectedItem = computed(
  () => items.value.find((i) => i.id === selectedId.value) ?? null
)
const checkedCount = computed(() => checkedIds.value.length)
const allChecked = computed(
  () => itemCount.value > 0 && checkedIds.value.length === itemCount.value
)
const someChecked = computed(() => checkedIds.value.length > 0 && !allChecked.value)
const deleteConfirmMessage = computed(() => {
  const n = pendingDeletePaths.value.length
  if (n <= 0) return 'Delete the selected image(s)?'
  if (n === 1) {
    return 'Delete this hosted image? The file is removed from storage. Emails that already used this link may show a broken image.'
  }
  return `Delete ${n} hosted images? Files are removed from storage. Emails that already used these links may show broken images.`
})
const busy = computed(() => pending.value || uploadPending.value || deletePending.value)

watch(canUseImageLibrary, (ok) => {
  if (imagesFlagLoaded.value && !ok) {
    void router.replace('/tenant/dashboard')
  }
})

async function loadImages() {
  if (!canUseImageLibrary.value) {
    pending.value = false
    return
  }
  pending.value = true
  loadError.value = ''
  try {
    const res = await marketingApi.fetchTenantHostedImages()
    items.value = Array.isArray(res.items) ? res.items : []
    if (selectedId.value && !items.value.some((i) => i.id === selectedId.value)) {
      selectedId.value = null
    }
    const visible = new Set(items.value.map((i) => i.id))
    checkedIds.value = checkedIds.value.filter((id) => visible.has(id))
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

function onUploadClick() {
  if (!canUseImageLibrary.value || busy.value) return
  fileInputRef.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!canUseImageLibrary.value) return

  uploadPending.value = true
  loadError.value = ''
  try {
    const dataUrl = await compressCustomMarketingImageFile(file)
    const uploaded = await marketingApi.uploadTenantHostedImage({ dataUrl })
    const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
    if (!url) throw new Error('Upload succeeded but no image URL was returned.')
    toast.success('Image uploaded — link ready for email templates')
    await loadImages()
    selectedId.value = uploaded.id || uploaded.objectPath || null
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

async function copyImageLink(item: TenantHostedImage) {
  const url = item.url?.trim()
  if (!url) {
    toast.error('This image has no hosted link yet')
    return
  }
  const ok = await copyText(url)
  if (!ok) {
    toast.error('Could not copy link — select the URL and copy manually')
    selectedId.value = item.id
    return
  }
  copyFlashId.value = item.id
  if (copyFlashTimer) clearTimeout(copyFlashTimer)
  copyFlashTimer = setTimeout(() => {
    copyFlashId.value = null
  }, 1600)
  toast.success('Image link copied')
}

function isChecked(id: string): boolean {
  return checkedIds.value.includes(id)
}

function setChecked(id: string, checked: boolean) {
  if (!id) return
  if (checked) {
    if (!checkedIds.value.includes(id)) {
      checkedIds.value = [...checkedIds.value, id]
    }
    return
  }
  checkedIds.value = checkedIds.value.filter((x) => x !== id)
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (selectMode.value) {
    closePreview()
  }
  if (!selectMode.value) {
    checkedIds.value = []
  }
}

function toggleSelectAll(checked: boolean) {
  checkedIds.value = checked ? items.value.map((i) => i.id) : []
}

function clearPreviewEscListener() {
  if (!previewEscListener) return
  window.removeEventListener('keydown', previewEscListener)
  previewEscListener = null
}

function openPreview(item: TenantHostedImage) {
  selectedId.value = item.id
  previewItem.value = item
  previewOpen.value = true
  clearPreviewEscListener()
  if (!import.meta.client) return
  previewEscListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePreview()
  }
  window.addEventListener('keydown', previewEscListener)
}

function closePreview() {
  previewOpen.value = false
  previewItem.value = null
  clearPreviewEscListener()
}

function onTileClick(item: TenantHostedImage) {
  if (selectMode.value) {
    setChecked(item.id, !isChecked(item.id))
    return
  }
  openPreview(item)
}

function openDeleteOne(item: TenantHostedImage) {
  if (busy.value) return
  pendingDeletePaths.value = [item.objectPath || item.id]
  deleteConfirmOpen.value = true
}

function openBulkDelete() {
  if (busy.value || !checkedIds.value.length) return
  const paths = items.value
    .filter((i) => checkedIds.value.includes(i.id))
    .map((i) => i.objectPath || i.id)
    .filter(Boolean)
  if (!paths.length) return
  pendingDeletePaths.value = paths
  deleteConfirmOpen.value = true
}

function cancelDeleteConfirm() {
  if (deletePending.value) return
  deleteConfirmOpen.value = false
  pendingDeletePaths.value = []
}

async function confirmDelete() {
  const paths = [...pendingDeletePaths.value]
  if (!paths.length || deletePending.value) return
  deletePending.value = true
  try {
    const res = await marketingApi.deleteTenantHostedImages(paths)
    deleteConfirmOpen.value = false
    pendingDeletePaths.value = []
    const n = res.deletedCount ?? paths.length
    toast.success(n === 1 ? 'Image deleted.' : `${n} images deleted.`)
    const removed = new Set(res.deleted ?? paths)
    if (selectedId.value && removed.has(selectedId.value)) {
      selectedId.value = null
    }
    checkedIds.value = checkedIds.value.filter((id) => !removed.has(id))
    await loadImages()
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? '')
        : ''
    toast.error(message || (e instanceof Error ? e.message : 'Could not delete image(s)'))
    deleteConfirmOpen.value = false
  } finally {
    deletePending.value = false
  }
}

onMounted(async () => {
  if (!imagesFlagLoaded.value) {
    await loadDefaultCampaignSender()
  }
  if (imagesFlagLoaded.value && !allowTenantImages.value) {
    await router.replace('/tenant/dashboard')
    return
  }
  await loadImages()
})

onBeforeUnmount(() => {
  if (copyFlashTimer) clearTimeout(copyFlashTimer)
  clearPreviewEscListener()
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Content</p>
        <h1 class="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Images
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          Hosted photos with HTTPS links for email templates. Upload here, then copy the link into
          an <code class="rounded bg-slate-100 px-1 py-0.5 text-[0.8em]">&lt;img src&gt;</code>
          — or use Replace on the template editor.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          class="sr-only"
          :disabled="busy || !canUseImageLibrary"
          @change="onFileChange"
        >
        <TenantRefreshIconButton
          label="Refresh images"
          :pending="pending"
          @click="() => loadImages()"
        />
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          :disabled="busy || !itemCount"
          :aria-pressed="selectMode"
          @click="toggleSelectMode"
        >
          {{ selectMode ? 'Cancel' : 'Select' }}
        </button>
        <button
          type="button"
          class="btn-cta inline-flex items-center gap-2"
          :disabled="busy || !canUseImageLibrary"
          @click="onUploadClick"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          {{ uploadPending ? 'Uploading…' : 'Upload' }}
        </button>
      </div>
    </header>

    <div
      v-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      {{ loadError }}
    </div>

    <section class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold tracking-tight text-slate-900">All files</h2>
          <p class="mt-1 text-sm text-slate-500">
            <span class="font-semibold tabular-nums text-slate-700">{{ itemCount }}</span>
            {{ itemCount === 1 ? 'item' : 'items' }}
            · uploads here stay hosted with a shareable link
          </p>
        </div>
        <div
          v-if="selectMode && itemCount"
          class="flex flex-wrap items-center gap-2"
        >
          <label class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
              :checked="allChecked"
              :indeterminate.prop="someChecked"
              :disabled="busy"
              @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
            >
            Select all
          </label>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="busy || checkedCount === 0"
            @click="openBulkDelete"
          >
            Delete selected{{ checkedCount ? ` (${checkedCount})` : '' }}
          </button>
        </div>
      </div>

      <div
        v-if="pending && !items.length"
        class="mt-6 space-y-8"
        aria-busy="true"
        aria-label="Loading images"
      >
        <section>
          <div class="mb-3 h-4 w-20 animate-pulse rounded bg-slate-100" />
          <ul class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <li
              v-for="n in 12"
              :key="`img-skel-${n}`"
              class="aspect-square animate-pulse rounded-xl border border-slate-100 bg-slate-100"
            />
          </ul>
        </section>
      </div>

      <div
        v-else-if="!items.length"
        class="mt-10 flex min-h-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center"
      >
        <p class="text-sm font-semibold text-slate-900">No hosted images yet</p>
        <p class="mt-2 max-w-sm text-sm text-slate-500">
          Upload a photo to get an HTTPS link that works when the email is sent.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          :disabled="uploadPending"
          @click="onUploadClick"
        >
          Upload image
        </button>
      </div>

      <div v-else class="mt-6 space-y-8">
        <section v-for="group in dayGroups" :key="group.key">
          <h3 class="mb-3 text-sm font-semibold text-slate-900">
            {{ group.label }}
          </h3>
          <ul class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="group relative"
            >
              <button
                type="button"
                class="relative aspect-square w-full overflow-hidden rounded-xl border bg-slate-100 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                :class="[
                  selectMode && isChecked(item.id)
                    ? 'border-primary-400 ring-2 ring-primary-500/30'
                    : !selectMode && selectedId === item.id
                      ? 'border-primary-400 ring-2 ring-primary-500/30'
                      : 'border-slate-200 hover:border-slate-300'
                ]"
                :aria-label="selectMode ? `Toggle select ${item.fileName}` : `View ${item.fileName}`"
                :aria-pressed="selectMode ? isChecked(item.id) : selectedId === item.id"
                @click="onTileClick(item)"
              >
                <img
                  :src="item.url"
                  :alt="item.fileName"
                  class="h-full w-full object-cover"
                  loading="lazy"
                >
                <span
                  class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent px-2 pb-2 pt-8 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100"
                >
                  <span class="line-clamp-2 break-all">{{ item.fileName }}</span>
                </span>
              </button>

              <label
                v-if="selectMode"
                class="absolute left-2 top-2 z-10 cursor-pointer"
                @click.stop
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 bg-white text-primary-600 shadow-sm focus:ring-primary-500/30"
                  :checked="isChecked(item.id)"
                  :aria-label="`Select ${item.fileName}`"
                  @change="setChecked(item.id, ($event.target as HTMLInputElement).checked)"
                >
              </label>

              <div
                class="absolute right-2 top-2 z-10 flex flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
                :class="selectMode || selectedId === item.id ? 'opacity-100' : ''"
              >
                <button
                  type="button"
                  class="rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-white"
                  @click.stop="copyImageLink(item)"
                >
                  {{ copyFlashId === item.id ? 'Copied' : 'Copy link' }}
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-red-600 shadow-sm ring-1 ring-slate-200/80 hover:bg-red-50 disabled:opacity-40"
                  :disabled="busy"
                  :aria-label="`Delete ${item.fileName}`"
                  title="Delete"
                  @click.stop="openDeleteOne(item)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                    />
                  </svg>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <aside
      v-if="selectedItem && !selectMode"
      class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div class="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img
            :src="selectedItem.url"
            :alt="selectedItem.fileName"
            class="h-full w-full object-cover"
          >
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-900" :title="selectedItem.fileName">
            {{ selectedItem.fileName }}
          </p>
          <p class="mt-1 text-xs text-slate-500">
            Hosted link for email — paste into HTML
            <code class="rounded bg-slate-100 px-1 py-0.5">&lt;img src&gt;</code>
          </p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              readonly
              class="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
              :value="selectedItem.url"
              @focus="($event.target as HTMLInputElement).select()"
            >
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              @click="copyImageLink(selectedItem)"
            >
              {{ copyFlashId === selectedItem.id ? 'Copied' : 'Copy link' }}
            </button>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40"
              :disabled="busy"
              @click="openDeleteOne(selectedItem)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </aside>

    <Teleport to="body">
      <div
        v-if="previewOpen && previewItem"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        @click.self="closePreview"
      >
        <div class="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60">
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div class="min-w-0">
              <h3 class="truncate text-base font-semibold text-slate-900" :title="previewItem.fileName">
                {{ previewItem.fileName }}
              </h3>
              <p class="mt-0.5 text-xs text-slate-500">
                Preview — copy the hosted link for email templates
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close preview"
              @click="closePreview"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex min-h-0 flex-1 items-center justify-center bg-slate-50 px-4 py-6">
            <img
              :src="previewItem.url"
              :alt="previewItem.fileName"
              class="max-h-[min(70vh,40rem)] max-w-full rounded-lg object-contain shadow-sm"
            >
          </div>

          <div class="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
            <input
              type="text"
              readonly
              class="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
              :value="previewItem.url"
              @focus="($event.target as HTMLInputElement).select()"
            >
            <div class="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                @click="copyImageLink(previewItem)"
              >
                {{ copyFlashId === previewItem.id ? 'Copied' : 'Copy link' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40"
                :disabled="busy"
                @click="openDeleteOne(previewItem); closePreview()"
              >
                Delete
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                @click="closePreview"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ClientConfirmationModal
      :open="deleteConfirmOpen"
      title="Delete images"
      :message="deleteConfirmMessage"
      confirm-text="Delete"
      variant="danger"
      :confirm-loading="deletePending"
      @confirm="confirmDelete"
      @cancel="cancelDeleteConfirm"
    />
  </div>
</template>
