<script setup lang="ts">
/**
 * Spike only — Templatical has no drag-resize on titles.
 * Side panel: Align + Width presets (padding) so non-tech users can position text.
 */
const STORAGE_KEY = 'marketing-editor-compare-templatical'

type Align = 'left' | 'center' | 'right'
type WidthPreset = 'full' | 'medium' | 'narrow'

type Spacing = { top: number; right: number; bottom: number; left: number }

type TemplateContent = {
  blocks?: unknown[]
  settings?: {
    width?: number
    backgroundColor?: string
    textColor?: string
    fontFamily?: string
    [key: string]: unknown
  }
}

type TemplaticalHandle = {
  unmount: () => void
  getContent: () => TemplateContent
  setContent: (content: TemplateContent) => void
}

const WIDTH_PRESETS: Record<WidthPreset, { label: string; hint: string; side: number }> = {
  full: { label: 'Full', hint: 'Edge to edge', side: 16 },
  medium: { label: 'Medium', hint: 'Slight inset', side: 48 },
  narrow: { label: 'Narrow', hint: 'More side space', side: 96 }
}

const hostRef = ref<HTMLElement | null>(null)
const status = ref('Loading Templatical…')
const error = ref('')
const lastSavedAt = ref('')
const contentWidth = ref(520)
const textAlign = ref<Align>('center')
const widthPreset = ref<WidthPreset>('medium')
const ready = ref(false)
let editor: TemplaticalHandle | null = null
let applying = false

function clampWidth(value: number) {
  return Math.min(600, Math.max(320, Math.round(value)))
}

function persist(content: TemplateContent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(content))
  lastSavedAt.value = new Date().toLocaleTimeString()
}

function walkBlocks(blocks: unknown[], map: (block: Record<string, unknown>) => Record<string, unknown>): unknown[] {
  return blocks.map((raw) => {
    const block = raw as Record<string, unknown>
    if (block.type === 'section' && Array.isArray(block.children)) {
      return {
        ...block,
        children: (block.children as unknown[][]).map((col) => walkBlocks(col, map))
      }
    }
    if (block.type === 'wrapper' && Array.isArray(block.children)) {
      return { ...block, children: walkBlocks(block.children as unknown[], map) }
    }
    return map(block)
  })
}

function isTextBlock(block: Record<string, unknown>) {
  return block.type === 'title' || block.type === 'paragraph'
}

function readLayoutFromContent(content: TemplateContent) {
  let foundAlign: Align | null = null
  let foundSide: number | null = null
  const visit = (blocks: unknown[]) => {
    for (const raw of blocks) {
      const block = raw as Record<string, unknown>
      if (block.type === 'section' && Array.isArray(block.children)) {
        for (const col of block.children as unknown[][]) visit(col)
        continue
      }
      if (block.type === 'wrapper' && Array.isArray(block.children)) {
        visit(block.children as unknown[])
        continue
      }
      if (!isTextBlock(block)) continue
      if (!foundAlign && (block.textAlign === 'left' || block.textAlign === 'center' || block.textAlign === 'right')) {
        foundAlign = block.textAlign
      }
      const padding = (block.styles as { padding?: Spacing } | undefined)?.padding
      if (foundSide == null && padding) {
        foundSide = Math.max(padding.left || 0, padding.right || 0)
      }
    }
  }
  visit(content.blocks || [])
  if (foundAlign) textAlign.value = foundAlign
  if (foundSide != null) {
    if (foundSide >= 80) widthPreset.value = 'narrow'
    else if (foundSide >= 36) widthPreset.value = 'medium'
    else widthPreset.value = 'full'
  }
}

function patchTextBlocks(patch: (block: Record<string, unknown>) => Record<string, unknown>, message: string) {
  if (!editor || !ready.value) return
  applying = true
  try {
    const content = editor.getContent()
    const next = {
      ...content,
      blocks: walkBlocks(content.blocks || [], (block) => (isTextBlock(block) ? patch(block) : block))
    }
    editor.setContent(next)
    persist(next)
    status.value = message
  } finally {
    applying = false
  }
}

function applyAlign(next: Align) {
  textAlign.value = next
  patchTextBlocks(
    (block) => ({ ...block, textAlign: next }),
    `Titles & paragraphs aligned ${next}.`
  )
}

function applyWidthPreset(preset: WidthPreset) {
  widthPreset.value = preset
  const side = WIDTH_PRESETS[preset].side
  patchTextBlocks((block) => {
    const styles = (block.styles as { padding?: Spacing } | undefined) || {}
    const padding = styles.padding || { top: 12, right: side, bottom: 12, left: side }
    return {
      ...block,
      styles: {
        ...styles,
        padding: { ...padding, left: side, right: side }
      }
    }
  }, `Text width set to ${WIDTH_PRESETS[preset].label.toLowerCase()}.`)
}

function applyContentWidth(next: number) {
  if (!editor || !ready.value) return
  const width = clampWidth(next)
  contentWidth.value = width
  applying = true
  try {
    const content = editor.getContent()
    const settings = { ...(content.settings || {}), width }
    editor.setContent({ ...content, settings })
    persist({ ...content, settings })
    status.value = `Email canvas ${width}px.`
  } finally {
    applying = false
  }
}

onMounted(async () => {
  if (!hostRef.value) return
  try {
    if (!document.getElementById('templatical-editor-css')) {
      const link = document.createElement('link')
      link.id = 'templatical-editor-css'
      link.rel = 'stylesheet'
      link.href = '/vendor/templatical-editor.css'
      document.head.appendChild(link)
    }
    const { init } = await import('@templatical/editor')
    let content: TemplateContent | undefined
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) content = JSON.parse(raw) as TemplateContent
    } catch {
      /* start blank */
    }
    if (content?.settings?.width) contentWidth.value = clampWidth(content.settings.width)
    if (content) readLayoutFromContent(content)

    editor = (await init({
      container: hostRef.value,
      branding: false,
      smallScreenNotice: false,
      templateSettings: { fields: ['width', 'backgroundColor', 'fontFamily', 'textColor'] },
      templateDefaults: {
        width: contentWidth.value,
        backgroundColor: '#f4f4f5'
      },
      blockDefaults: {
        title: {
          textAlign: textAlign.value,
          styles: {
            padding: {
              top: 12,
              right: WIDTH_PRESETS[widthPreset.value].side,
              bottom: 12,
              left: WIDTH_PRESETS[widthPreset.value].side
            }
          }
        },
        paragraph: {
          textAlign: textAlign.value === 'center' ? 'left' : textAlign.value,
          styles: {
            padding: {
              top: 8,
              right: WIDTH_PRESETS[widthPreset.value].side,
              bottom: 8,
              left: WIDTH_PRESETS[widthPreset.value].side
            }
          }
        }
      },
      ...(content ? { content: content as never } : {}),
      onChange(next) {
        if (applying) return
        const typed = next as TemplateContent
        if (typed.settings?.width) contentWidth.value = clampWidth(typed.settings.width)
        readLayoutFromContent(typed)
        persist(typed)
      }
    })) as unknown as TemplaticalHandle

    ready.value = true
    status.value = 'Use the Layout panel on the right — Align + Width replace drag-resize.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start Templatical.'
    status.value = ''
  }
})

onBeforeUnmount(() => {
  editor?.unmount()
  editor = null
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <p class="min-w-0 truncate">{{ error || status }}</p>
      <p v-if="lastSavedAt" class="shrink-0 text-slate-400">Draft {{ lastSavedAt }}</p>
    </div>

    <div class="flex min-h-0 flex-1">
      <div ref="hostRef" class="min-h-0 min-w-0 flex-1 bg-white" style="min-height: 520px" />

      <aside
        v-if="ready"
        class="flex w-[240px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-slate-200 bg-slate-50 px-3 py-4 text-sm"
      >
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Layout</p>
          <p class="mt-1 text-xs leading-snug text-slate-500">
            Titles can’t be drag-resized. Use Align + Width instead.
          </p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium text-slate-700">Position</p>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="opt in (['left', 'center', 'right'] as Align[])"
              :key="opt"
              type="button"
              class="rounded-md border px-2 py-2 text-xs font-medium capitalize"
              :class="textAlign === opt ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-white'"
              :aria-pressed="textAlign === opt"
              @click="applyAlign(opt)"
            >
              {{ opt }}
            </button>
          </div>
          <p class="text-[11px] text-slate-400">Moves text left, center, or right in the column.</p>
        </div>

        <div class="space-y-2">
          <p class="text-xs font-medium text-slate-700">Width</p>
          <div class="grid grid-cols-1 gap-1">
            <button
              v-for="(meta, key) in WIDTH_PRESETS"
              :key="key"
              type="button"
              class="rounded-md border px-2.5 py-2 text-left"
              :class="widthPreset === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-white'"
              :aria-pressed="widthPreset === key"
              @click="applyWidthPreset(key as WidthPreset)"
            >
              <span class="block text-xs font-medium">{{ meta.label }}</span>
              <span
                class="block text-[11px]"
                :class="widthPreset === key ? 'text-slate-300' : 'text-slate-400'"
              >{{ meta.hint }}</span>
            </button>
          </div>
        </div>

        <div class="space-y-2 border-t border-slate-200 pt-4">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-slate-700">Email canvas</p>
            <span class="tabular-nums text-[11px] text-slate-500">{{ contentWidth }}px</span>
          </div>
          <input
            v-model.number="contentWidth"
            type="range"
            min="320"
            max="600"
            step="10"
            class="h-2 w-full accent-slate-900"
            @change="applyContentWidth(contentWidth)"
          >
          <div class="flex flex-wrap gap-1">
            <button
              v-for="preset in [400, 480, 520, 600]"
              :key="preset"
              type="button"
              class="rounded border px-1.5 py-0.5 text-[11px] font-medium"
              :class="contentWidth === preset ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'"
              @click="applyContentWidth(preset)"
            >
              {{ preset }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
