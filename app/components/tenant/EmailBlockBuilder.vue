<script setup lang="ts">
import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import {
  EMAIL_CANVAS_MAX_WIDTH,
  EMAIL_CANVAS_MIN_HEIGHT,
  EMAIL_CANVAS_MIN_WIDTH,
  createEmailBlock,
  emailBuilderDocFromHtml,
  type EmailBlock,
  type EmailBlockAlign,
  type EmailBuilderDoc
} from '~~/shared/emailBlockBuilder'

const props = defineProps<{
  modelValue: EmailBuilderDoc
  variables?: Array<{ key: string; label: string }>
  canUploadImage?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EmailBuilderDoc]
  'loaded-template': [value: { name: string; subject: string }]
}>()

const marketingApi = useTenantMarketingApi()
const selectedId = ref<string | null>(props.modelValue.blocks[0]?.id ?? null)
const uploadError = ref('')
const uploading = ref(false)
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const templates = ref<Array<{ id: string; name: string; subject: string }>>([])
const templatesOpen = ref(false)
const templatesPending = ref(false)
const templatesError = ref('')
const dragMode = ref<'move' | 'resize' | 'canvas-width' | 'canvas-height' | null>(null)

const palette: Array<{ type: EmailBlock['type']; label: string }> = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Button' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Spacer' }
]

const selected = computed(() => props.modelValue.blocks.find((block) => block.id === selectedId.value) ?? null)

function commit(next: Partial<EmailBuilderDoc> & { blocks?: EmailBlock[] }) {
  emit('update:modelValue', {
    version: 1,
    canvasWidth: next.canvasWidth ?? props.modelValue.canvasWidth,
    canvasHeight: next.canvasHeight ?? props.modelValue.canvasHeight,
    blocks: next.blocks ?? props.modelValue.blocks
  })
}

function patchBlock(id: string, patch: Partial<EmailBlock>) {
  commit({
    blocks: props.modelValue.blocks.map((block) =>
      block.id === id ? ({ ...block, ...patch } as EmailBlock) : block
    )
  })
}

function updateSelected(patch: Partial<EmailBlock>) {
  const current = selected.value
  if (!current) return
  patchBlock(current.id, patch)
}

function placeBlock(block: EmailBlock, atDrop = false) {
  const bottom = props.modelValue.blocks.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  const placed = atDrop ? block : { ...block, x: 24, y: bottom + 16 }
  const needed = placed.y + placed.h + 48
  commit({
    blocks: [...props.modelValue.blocks, placed],
    canvasHeight: Math.max(props.modelValue.canvasHeight, needed)
  })
  selectedId.value = placed.id
}

function removeSelected() {
  const current = selected.value
  if (!current) return
  const blocks = props.modelValue.blocks.filter((block) => block.id !== current.id)
  commit({ blocks })
  selectedId.value = blocks[0]?.id ?? null
}

function canvasPoint(event: DragEvent): { x: number; y: number } {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 24, y: 24 }
  return {
    x: Math.max(0, event.clientX - rect.left),
    y: Math.max(0, event.clientY - rect.top)
  }
}

function growCanvas(bottom: number) {
  if (bottom + 48 <= props.modelValue.canvasHeight) return
  commit({ canvasHeight: bottom + 48 })
}

function startPointer(mode: 'move' | 'resize', block: EmailBlock, event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  selectedId.value = block.id
  dragMode.value = mode
  const startX = event.clientX
  const startY = event.clientY
  const origin = { x: block.x, y: block.y, w: block.w, h: block.h }
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (mode === 'move') {
      const x = Math.max(0, Math.min(props.modelValue.canvasWidth - 40, origin.x + dx))
      const y = Math.max(0, origin.y + dy)
      patchBlock(block.id, { x, y })
      growCanvas(y + origin.h)
      return
    }
    const w = Math.max(48, origin.w + dx)
    const h = Math.max(24, origin.h + dy)
    patchBlock(block.id, { w, h })
    growCanvas(origin.y + h)
  }
  const stop = () => {
    dragMode.value = null
    window.removeEventListener('pointermove', move)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

function startCanvasResize(edge: 'width' | 'height', event: PointerEvent) {
  event.preventDefault()
  dragMode.value = edge === 'width' ? 'canvas-width' : 'canvas-height'
  const start = edge === 'width' ? event.clientX : event.clientY
  const origin = edge === 'width' ? props.modelValue.canvasWidth : props.modelValue.canvasHeight
  const move = (ev: PointerEvent) => {
    const delta = (edge === 'width' ? ev.clientX : ev.clientY) - start
    if (edge === 'width') {
      commit({
        canvasWidth: Math.min(EMAIL_CANVAS_MAX_WIDTH, Math.max(EMAIL_CANVAS_MIN_WIDTH, origin + delta))
      })
    } else {
      commit({ canvasHeight: Math.max(EMAIL_CANVAS_MIN_HEIGHT, origin + delta) })
    }
  }
  const stop = () => {
    dragMode.value = null
    window.removeEventListener('pointermove', move)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

function onPaletteDragStart(type: EmailBlock['type'], event: DragEvent) {
  event.dataTransfer?.setData('application/x-email-block', type)
  event.dataTransfer?.setData('text/plain', type)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

async function uploadImageFile(file: File): Promise<string> {
  if (!props.canUploadImage) {
    throw new Error('Insert image is turned off for this tenant.')
  }
  const dataUrl = await compressCustomMarketingImageFile(file)
  const uploaded = await marketingApi.uploadEmailTemplateImage({ dataUrl })
  const url = typeof uploaded?.url === 'string' ? uploaded.url.trim() : ''
  if (!url) throw new Error('Upload succeeded but no image link was returned.')
  return url
}

async function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  uploadError.value = ''
  const point = canvasPoint(event)
  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (files.length) {
    uploading.value = true
    try {
      const blocks = props.modelValue.blocks.slice()
      let cursorY = point.y
      let lastId = ''
      for (const file of files) {
        const src = await uploadImageFile(file)
        const block = createEmailBlock('image', { x: point.x, y: cursorY, w: 280, h: 180 })
        if (block.type !== 'image') continue
        const image = { ...block, src, alt: file.name }
        blocks.push(image)
        lastId = image.id
        cursorY += image.h + 12
      }
      commit({
        blocks,
        canvasHeight: Math.max(props.modelValue.canvasHeight, cursorY + 48)
      })
      if (lastId) selectedId.value = lastId
    } catch (e) {
      uploadError.value = e instanceof Error ? e.message : 'Could not upload image'
    } finally {
      uploading.value = false
    }
    return
  }
  const type = event.dataTransfer?.getData('application/x-email-block') as EmailBlock['type'] | ''
  if (!type) return
  placeBlock(createEmailBlock(type, { x: point.x, y: point.y }), true)
}

async function openTemplateList() {
  templatesOpen.value = true
  if (templates.value.length || templatesPending.value) return
  templatesPending.value = true
  templatesError.value = ''
  try {
    const response = await marketingApi.fetchEmailTemplates()
    templates.value = (response.templates ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      subject: template.subject || ''
    }))
  } catch {
    templatesError.value = 'Could not load templates.'
  } finally {
    templatesPending.value = false
  }
}

async function loadTemplate(id: string) {
  templatesError.value = ''
  templatesPending.value = true
  try {
    const response = await marketingApi.fetchEmailTemplateById(id)
    const html = response.template.htmlTemplate || ''
    emit('update:modelValue', emailBuilderDocFromHtml(html))
    emit('loaded-template', {
      name: response.template.name || '',
      subject: response.template.subject || ''
    })
    selectedId.value = null
    templatesOpen.value = false
  } catch {
    templatesError.value = 'Could not open that template.'
  } finally {
    templatesPending.value = false
  }
}

function pickImageFile() {
  uploadError.value = ''
  imageFileInputRef.value?.click()
}

async function onImageFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const current = selected.value
  if (!file || !current || current.type !== 'image') return
  uploading.value = true
  uploadError.value = ''
  try {
    const src = await uploadImageFile(file)
    updateSelected({ src, alt: current.alt || file.name })
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Could not upload image'
  } finally {
    uploading.value = false
  }
}

function insertVariable(token: string) {
  const current = selected.value
  if (!current || (current.type !== 'text' && current.type !== 'heading' && current.type !== 'button')) return
  if (current.type === 'button') updateSelected({ label: `${current.label}${token}` })
  else updateSelected({ text: `${current.text}${token}` })
}

function setAlign(align: EmailBlockAlign) {
  const current = selected.value
  if (!current || (current.type !== 'heading' && current.type !== 'text' && current.type !== 'button')) return
  updateSelected({ align })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 bg-slate-100">
    <aside class="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
      <p class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Blocks</p>
      <ul class="space-y-2 px-3 pb-4">
        <li v-for="item in palette" :key="item.type">
          <button
            type="button"
            draggable="true"
            class="flex w-full cursor-grab items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:border-slate-300 hover:bg-white active:cursor-grabbing"
            @dragstart="onPaletteDragStart(item.type, $event)"
            @click="placeBlock(createEmailBlock(item.type))"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
      <div class="mt-auto border-t border-slate-100 px-3 py-3">
        <button type="button" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50" @click="openTemplateList">
          Load template
        </button>
        <div v-if="templatesOpen" class="mt-2 max-h-48 space-y-1 overflow-auto">
          <p v-if="templatesPending" class="px-1 text-xs text-slate-400">Loading…</p>
          <p v-else-if="templatesError" class="px-1 text-xs text-red-600">{{ templatesError }}</p>
          <p v-else-if="!templates.length" class="px-1 text-xs text-slate-400">No saved templates.</p>
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            class="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
            @click="loadTemplate(template.id)"
          >
            {{ template.name }}
          </button>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-auto p-6">
      <div class="relative mx-auto" :style="{ width: `${modelValue.canvasWidth + 28}px` }">
        <div
          ref="canvasRef"
          class="relative overflow-hidden rounded-xl bg-white shadow-sm"
          :style="{ width: `${modelValue.canvasWidth}px`, height: `${modelValue.canvasHeight}px` }"
          @dragover.prevent
          @drop="onCanvasDrop"
        >
          <p v-if="!modelValue.blocks.length" class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Drag a block or drop an image.
          </p>
          <article
            v-for="block in modelValue.blocks"
            :key="block.id"
            class="absolute overflow-hidden rounded-md border bg-white"
            :class="selectedId === block.id ? 'z-10 border-primary-500 ring-2 ring-primary-500/20' : 'border-transparent hover:border-slate-200'"
            :style="{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.w}px`, height: `${block.h}px` }"
            @pointerdown="startPointer('move', block, $event)"
          >
            <h2
              v-if="block.type === 'heading'"
              class="h-full overflow-hidden px-2 text-2xl font-bold leading-tight text-slate-900"
              :class="block.align === 'center' ? 'text-center' : 'text-left'"
            >
              {{ block.text || 'Heading' }}
            </h2>
            <p
              v-else-if="block.type === 'text'"
              class="h-full overflow-hidden whitespace-pre-wrap px-2 text-sm leading-relaxed text-slate-700"
              :class="block.align === 'center' ? 'text-center' : 'text-left'"
            >
              {{ block.text || 'Text' }}
            </p>
            <div v-else-if="block.type === 'image'" class="flex h-full items-center justify-center bg-slate-100">
              <img v-if="block.src" :src="block.src" :alt="block.alt" class="h-full w-full object-contain">
              <span v-else class="px-2 text-center text-xs text-slate-400">Drop an image</span>
            </div>
            <div v-else-if="block.type === 'button'" class="flex h-full items-center px-1" :class="block.align === 'center' ? 'justify-center' : 'justify-start'">
              <span class="truncate rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">{{ block.label || 'Button' }}</span>
            </div>
            <div v-else-if="block.type === 'divider'" class="flex h-full items-center"><hr class="w-full border-slate-300"></div>
            <div v-else-if="block.type === 'spacer'" class="h-full bg-slate-50" />
            <!-- eslint-disable-next-line vue/no-v-html -- tenant-authored email HTML, shown only in this preview -->
            <div v-else class="h-full overflow-hidden text-xs text-slate-500" v-html="block.html" />
            <button
              v-if="selectedId === block.id"
              type="button"
              class="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-sm bg-primary-600"
              aria-label="Resize block"
              @pointerdown.stop="startPointer('resize', block, $event)"
            />
          </article>
        </div>
        <button
          type="button"
          class="absolute right-0 top-1/2 h-16 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-slate-300"
          aria-label="Resize canvas width"
          @pointerdown="startCanvasResize('width', $event)"
        />
        <button
          type="button"
          class="absolute bottom-0 left-1/2 h-2 w-16 -translate-x-1/2 translate-y-3 cursor-ns-resize rounded-full bg-slate-300"
          aria-label="Resize canvas height"
          @pointerdown="startCanvasResize('height', $event)"
        />
      </div>
      <p v-if="uploadError" class="mx-auto mt-3 max-w-[640px] text-sm text-red-600" role="alert">{{ uploadError }}</p>
      <p v-else-if="uploading" class="mx-auto mt-3 max-w-[640px] text-sm text-slate-500">Uploading image…</p>
    </main>

    <aside class="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      <p class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Edit</p>
      <div v-if="selected" class="flex-1 space-y-4 overflow-auto px-4 pb-4">
        <div class="flex gap-2">
          <button type="button" class="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600" @click="removeSelected">Delete</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-xs font-medium text-slate-500">X<input :value="Math.round(selected.x)" type="number" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" @change="patchBlock(selected.id, { x: Number(($event.target as HTMLInputElement).value) })"></label>
          <label class="text-xs font-medium text-slate-500">Y<input :value="Math.round(selected.y)" type="number" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" @change="patchBlock(selected.id, { y: Number(($event.target as HTMLInputElement).value) })"></label>
          <label class="text-xs font-medium text-slate-500">Width<input :value="Math.round(selected.w)" type="number" min="40" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" @change="patchBlock(selected.id, { w: Number(($event.target as HTMLInputElement).value) })"></label>
          <label class="text-xs font-medium text-slate-500">Height<input :value="Math.round(selected.h)" type="number" min="16" class="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" @change="patchBlock(selected.id, { h: Number(($event.target as HTMLInputElement).value) })"></label>
        </div>

        <template v-if="selected.type === 'heading' || selected.type === 'text'">
          <label class="block text-xs font-medium text-slate-500">
            {{ selected.type === 'heading' ? 'Heading' : 'Text' }}
            <textarea
              :value="selected.text"
              rows="5"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              @input="updateSelected({ text: ($event.target as HTMLTextAreaElement).value })"
            />
          </label>
          <div class="flex gap-2">
            <button type="button" class="rounded-lg border px-3 py-1.5 text-xs font-semibold" :class="selected.align === 'left' ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'" @click="setAlign('left')">Left</button>
            <button type="button" class="rounded-lg border px-3 py-1.5 text-xs font-semibold" :class="selected.align === 'center' ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'" @click="setAlign('center')">Center</button>
          </div>
        </template>

        <template v-else-if="selected.type === 'image'">
          <input ref="imageFileInputRef" type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="sr-only" :disabled="!canUploadImage || uploading" @change="onImageFile">
          <button type="button" class="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!canUploadImage || uploading" @click="pickImageFile">
            {{ canUploadImage ? 'Upload image' : 'Upload turned off' }}
          </button>
          <label class="block text-xs font-medium text-slate-500">
            Image URL
            <input :value="selected.src" type="url" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="https://" @input="updateSelected({ src: ($event.target as HTMLInputElement).value })">
          </label>
          <label class="block text-xs font-medium text-slate-500">
            Alt text
            <input :value="selected.alt" type="text" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" @input="updateSelected({ alt: ($event.target as HTMLInputElement).value })">
          </label>
          <label class="block text-xs font-medium text-slate-500">
            Link
            <input :value="selected.href" type="url" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="https://" @input="updateSelected({ href: ($event.target as HTMLInputElement).value })">
          </label>
        </template>

        <template v-else-if="selected.type === 'button'">
          <label class="block text-xs font-medium text-slate-500">
            Label
            <input :value="selected.label" type="text" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" @input="updateSelected({ label: ($event.target as HTMLInputElement).value })">
          </label>
          <label class="block text-xs font-medium text-slate-500">
            Link
            <input :value="selected.href" type="url" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" @input="updateSelected({ href: ($event.target as HTMLInputElement).value })">
          </label>
          <div class="flex gap-2">
            <button type="button" class="rounded-lg border px-3 py-1.5 text-xs font-semibold" :class="selected.align === 'left' ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'" @click="setAlign('left')">Left</button>
            <button type="button" class="rounded-lg border px-3 py-1.5 text-xs font-semibold" :class="selected.align === 'center' ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500'" @click="setAlign('center')">Center</button>
          </div>
        </template>

        <template v-else-if="selected.type === 'spacer'">
          <label class="block text-xs font-medium text-slate-500">
            Height
            <input :value="selected.height" type="number" min="8" max="120" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" @input="updateSelected({ height: Number(($event.target as HTMLInputElement).value) })">
          </label>
        </template>

        <p v-else class="text-sm text-slate-500">
          This block is existing HTML. Add new blocks around it, or delete it to start clean.
        </p>

        <div v-if="variables?.length && selected && selected.type !== 'html' && selected.type !== 'image' && selected.type !== 'divider' && selected.type !== 'spacer'">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Merge fields</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="variable in variables"
              :key="variable.key"
              type="button"
              class="rounded-md bg-primary-50 px-2 py-1 font-mono text-[11px] text-primary-800"
              @click="insertVariable(`{{${variable.key}}}`)"
            >
              {{ variable.label }}
            </button>
          </div>
        </div>
      </div>
      <p v-else class="px-4 text-sm text-slate-400">Select a block to edit it.</p>
    </aside>
  </div>
</template>
