<script setup lang="ts">
import {
  CONSENT_BUILDER_COPY,
  CONSENT_FIELD_KIND_LABELS,
  consentSectionLabel,
  kindNeedsOptions,
  type ConsentFieldKind
} from '~~/shared/consentFormBuilder'

definePageMeta({ layout: 'default' })

const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const {
  sections,
  activeSection,
  selectedKey,
  selectedField,
  sectionFields,
  paletteKinds,
  dirty,
  saving,
  success,
  load,
  setActiveSection,
  selectField,
  addField,
  updateSelected,
  addChoice,
  updateChoice,
  removeChoice,
  deleteSelected,
  moveField,
  save,
  discard
} = useMarketingConsentFormBuilder()

const paletteDragKind = ref<ConsentFieldKind | null>(null)

const KIND_ICONS: Record<string, string> = {
  display: 'M4 7h16M4 12h10M4 17h14',
  text: 'M4 6h16M4 12h10M4 18h14',
  textarea: 'M4 6h16M4 10h16M4 14h12M4 18h8',
  number: 'M8 8h8M8 12h8M12 8v8',
  radio: 'M8 12a4 4 0 108 0 4 4 0 10-8 0',
  yes_no: 'M6 12h12M9 9l-3 3 3 3M15 9l3 3-3 3',
  multi_select: 'M5 7h14M5 12h14M5 17h10',
  checkbox: 'M5 12l3 3 8-8',
  date: 'M8 7V3m8 4V3M5 11h14M7 15h2m4 0h2',
  file: 'M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14'
}

function onPaletteDragStart(event: DragEvent, kind: ConsentFieldKind) {
  paletteDragKind.value = kind
  event.dataTransfer?.setData('application/x-consent-palette', kind)
  event.dataTransfer?.setData('text/plain', kind)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onCanvasItemDragStart(event: DragEvent, key: string) {
  paletteDragKind.value = null
  event.dataTransfer?.setData('application/x-consent-field', key)
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onCanvasDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = paletteDragKind.value ? 'copy' : 'move'
  }
}

function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  const palette = event.dataTransfer?.getData('application/x-consent-palette') as ConsentFieldKind
  if (palette && paletteKinds.value.includes(palette)) addField(palette)
  paletteDragKind.value = null
}

function onFieldDrop(event: DragEvent, targetKey: string) {
  event.preventDefault()
  event.stopPropagation()
  const palette = event.dataTransfer?.getData('application/x-consent-palette') as ConsentFieldKind
  const fromKey = event.dataTransfer?.getData('application/x-consent-field')
  if (palette && paletteKinds.value.includes(palette)) addField(palette)
  else if (fromKey && fromKey !== targetKey) moveField(fromKey, targetKey)
  paletteDragKind.value = null
}

onMounted(() => load())
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold text-slate-900">{{ CONSENT_BUILDER_COPY.PAGE_TITLE }}</h1>
        <p class="truncate text-xs text-slate-500">{{ CONSENT_BUILDER_COPY.PAGE_SUBTITLE }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="dirty"
          class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
        >
          {{ CONSENT_BUILDER_COPY.UNSAVED }}
        </span>
        <button
          v-if="dirty"
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          @click="discard()"
        >
          Discard
        </button>
        <button
          type="button"
          class="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          :disabled="saving || !dirty"
          @click="save()"
        >
          {{ saving ? CONSENT_BUILDER_COPY.SAVING : CONSENT_BUILDER_COPY.SAVE }}
        </button>
      </div>
    </header>

    <div
      v-if="success"
      class="shrink-0 border-b border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800"
    >
      {{ success }}
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[220px_240px_minmax(0,1fr)_280px]">
      <aside class="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-r">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {{ CONSENT_BUILDER_COPY.SECTIONS_TITLE }}
        </p>
        <p class="mb-3 text-xs text-slate-500">Choose a section to view and edit its content.</p>
        <div class="space-y-1.5">
          <button
            v-for="section in sections"
            :key="section"
            type="button"
            class="w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
            :class="activeSection === section
              ? 'border-teal-500 bg-teal-50 font-semibold text-teal-900'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'"
            @click="setActiveSection(section)"
          >
            {{ consentSectionLabel(section) }}
          </button>
        </div>
      </aside>

      <aside class="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 lg:border-b-0 lg:border-r">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {{ CONSENT_BUILDER_COPY.PALETTE_TITLE }}
        </p>
        <p class="mb-3 text-xs text-slate-500">{{ CONSENT_BUILDER_COPY.PALETTE_HINT }}</p>
        <div class="space-y-2">
          <button
            v-for="kind in paletteKinds"
            :key="kind"
            type="button"
            draggable="true"
            class="flex w-full cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50 active:cursor-grabbing"
            @dragstart="onPaletteDragStart($event, kind)"
            @click="addField(kind)"
          >
            <span class="text-teal-600">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" :d="KIND_ICONS[kind] || KIND_ICONS.text" />
              </svg>
            </span>
            <span class="font-medium">{{ CONSENT_FIELD_KIND_LABELS[kind] }}</span>
          </button>
        </div>
      </aside>

      <section
        class="min-h-0 overflow-y-auto bg-slate-100 p-4"
        @dragover="onCanvasDragOver"
        @drop="onCanvasDrop"
      >
        <div class="mb-3">
          <h2 class="text-sm font-semibold text-slate-900">
            {{ CONSENT_BUILDER_COPY.CANVAS_TITLE }}
            · {{ consentSectionLabel(activeSection) }}
          </h2>
          <p class="text-xs text-slate-500">{{ CONSENT_BUILDER_COPY.CANVAS_HINT }}</p>
        </div>

        <div
          v-if="!sectionFields.length"
          class="flex min-h-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 text-center text-sm text-slate-500"
        >
          {{ CONSENT_BUILDER_COPY.EMPTY_CANVAS }}
        </div>

        <ul v-else class="space-y-2">
          <li
            v-for="field in sectionFields"
            :key="field.key"
            draggable="true"
            class="cursor-grab rounded-xl border bg-white p-3 shadow-sm transition-colors active:cursor-grabbing"
            :class="selectedKey === field.key
              ? 'border-teal-500 ring-2 ring-teal-200'
              : 'border-slate-200 hover:border-teal-300'"
            @dragstart="onCanvasItemDragStart($event, field.key)"
            @dragover="onCanvasDragOver"
            @drop="onFieldDrop($event, field.key)"
            @click="selectField(field.key)"
          >
            <div class="flex items-start gap-2">
              <span class="mt-0.5 text-slate-400" :title="CONSENT_BUILDER_COPY.DRAG_HANDLE" aria-hidden="true">
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm8-12a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold text-slate-900">
                    {{ field.label }}
                    <span v-if="field.required" class="text-rose-600">*</span>
                  </p>
                  <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                    {{ CONSENT_FIELD_KIND_LABELS[field.kind] }}
                  </span>
                </div>
                <p v-if="field.helpText" class="mt-1 text-xs text-slate-500">{{ field.helpText }}</p>
                <div v-if="field.kind === 'yes_no' || field.kind === 'radio'" class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-for="opt in field.options"
                    :key="opt.id"
                    class="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {{ opt.label }}
                  </span>
                </div>
                <div v-else-if="field.kind === 'multi_select'" class="mt-2 space-y-1">
                  <p v-for="opt in field.options" :key="opt.id" class="text-xs text-slate-600">
                    ☐ {{ opt.label }}
                  </p>
                </div>
                <div
                  v-else-if="field.kind === 'display'"
                  class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                >
                  {{ field.helpText || field.label }}
                </div>
                <div
                  v-else
                  class="mt-2 h-8 rounded-lg border border-dashed border-slate-200 bg-slate-50"
                />
              </div>
            </div>
          </li>
        </ul>
      </section>

      <aside class="min-h-0 overflow-y-auto border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {{ CONSENT_BUILDER_COPY.DETAILS_TITLE }}
        </p>
        <p class="mb-4 text-xs text-slate-500">Changes apply locally until you save.</p>

        <div
          v-if="!selectedField"
          class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500"
        >
          {{ CONSENT_BUILDER_COPY.DETAILS_EMPTY }}
        </div>

        <div v-else class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-700" for="consent-field-label">
              {{ CONSENT_BUILDER_COPY.LABEL }}
            </label>
            <input
              id="consent-field-label"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              :value="selectedField.label"
              @input="updateSelected({ label: ($event.target as HTMLInputElement).value })"
            >
          </div>

          <div>
            <p class="text-xs font-medium text-slate-700">Field type</p>
            <p class="mt-1 text-sm text-slate-600">{{ CONSENT_FIELD_KIND_LABELS[selectedField.kind] }}</p>
          </div>

          <label
            v-if="selectedField.kind !== 'display'"
            class="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              :checked="selectedField.required"
              @change="updateSelected({ required: ($event.target as HTMLInputElement).checked })"
            >
            {{ CONSENT_BUILDER_COPY.REQUIRED }}
          </label>

          <div>
            <label class="block text-xs font-medium text-slate-700" for="consent-field-help">
              {{ CONSENT_BUILDER_COPY.HELP }}
            </label>
            <textarea
              id="consent-field-help"
              rows="3"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              :value="selectedField.helpText"
              @input="updateSelected({ helpText: ($event.target as HTMLTextAreaElement).value })"
            />
          </div>

          <div v-if="kindNeedsOptions(selectedField.kind)">
            <p class="text-xs font-medium text-slate-700">{{ CONSENT_BUILDER_COPY.OPTIONS }}</p>
            <div class="mt-2 space-y-2">
              <div
                v-for="(opt, index) in selectedField.options"
                :key="opt.id"
                class="flex gap-2"
              >
                <input
                  type="text"
                  class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  :value="opt.label"
                  @input="updateChoice(index, ($event.target as HTMLInputElement).value)"
                >
                <button
                  type="button"
                  class="shrink-0 text-xs font-medium text-rose-600 hover:underline"
                  @click="removeChoice(index)"
                >
                  Remove
                </button>
              </div>
            </div>
            <button
              type="button"
              class="mt-2 text-xs font-semibold text-teal-700 hover:underline"
              @click="addChoice()"
            >
              {{ CONSENT_BUILDER_COPY.ADD_CHOICE }}
            </button>
          </div>

          <button
            type="button"
            class="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            @click="deleteSelected()"
          >
            {{ CONSENT_BUILDER_COPY.DELETE }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
