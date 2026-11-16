<script setup lang="ts">
import {
  DIGIKARD_TEMPLATES,
  DIGIKARD_TEMPLATE_IDS,
  normalizeDigikardTemplateId,
  type DigikardTemplateId
} from '~~/shared/digikardTemplates'

definePageMeta({ layout: 'default' })

const STORAGE_KEY = 'marketing-digikard-template-id'
const toast = useAppToast()
const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)

const selectedTemplate = ref<DigikardTemplateId>(DIGIKARD_TEMPLATE_IDS.CLASSIC)
const savedTemplate = ref<DigikardTemplateId>(DIGIKARD_TEMPLATE_IDS.CLASSIC)
const saving = ref(false)
const success = ref('')
let successTimer = 0

const isDirty = computed(() => selectedTemplate.value !== savedTemplate.value)
const selectedMeta = computed(
  () => DIGIKARD_TEMPLATES.find((t) => t.id === selectedTemplate.value) ?? DIGIKARD_TEMPLATES[0]
)

function loadSaved() {
  if (!import.meta.client) return
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const id = normalizeDigikardTemplateId(raw)
  selectedTemplate.value = id
  savedTemplate.value = id
}

function selectTemplate(id: DigikardTemplateId) {
  selectedTemplate.value = id
  success.value = ''
}

async function saveTemplate() {
  if (saving.value) return
  saving.value = true
  success.value = ''
  try {
    window.localStorage.setItem(STORAGE_KEY, selectedTemplate.value)
    savedTemplate.value = selectedTemplate.value
    success.value = 'Template saved. Preview shows the DigiKard card style you picked.'
    toast.success('DigiKard template saved')
    window.clearTimeout(successTimer)
    successTimer = window.setTimeout(() => {
      success.value = ''
    }, 3000)
  } finally {
    saving.value = false
  }
}

onMounted(loadSaved)
onBeforeUnmount(() => window.clearTimeout(successTimer))
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="min-w-0">
        <h1 class="truncate text-sm font-semibold text-slate-900">DigiKard templates</h1>
        <p class="truncate text-xs text-slate-500">
          Choose how DigiKard cards look. Preview updates as you switch; save to keep your pick.
        </p>
      </div>
      <span
        v-if="isDirty"
        class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
      >
        Unsaved
      </span>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div
        v-if="success"
        class="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800"
      >
        {{ success }}
      </div>

      <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <div class="lg:col-span-2">
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-slate-900">Card style</h2>
              <button
                type="button"
                class="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
                :disabled="saving || !isDirty"
                @click="saveTemplate"
              >
                {{ saving ? 'Saving…' : 'Save template' }}
              </button>
            </div>

            <label class="mb-2 block text-xs font-medium text-slate-500 lg:hidden" for="digikard-style-select">
              Template
            </label>
            <select
              id="digikard-style-select"
              class="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 lg:hidden"
              :value="selectedTemplate"
              @change="selectTemplate(normalizeDigikardTemplateId(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="template in DIGIKARD_TEMPLATES" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>

            <div class="hidden space-y-3 lg:block">
              <button
                v-for="template in DIGIKARD_TEMPLATES"
                :key="template.id"
                type="button"
                class="w-full rounded-xl border-2 p-4 text-left transition-colors"
                :class="selectedTemplate === template.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'"
                @click="selectTemplate(template.id)"
              >
                <div class="font-medium text-slate-900">{{ template.name }}</div>
                <div class="mt-0.5 text-xs text-slate-500">{{ template.preview }}</div>
              </button>
            </div>

            <div class="mt-5 hidden border-t border-slate-200 pt-4 lg:block">
              <button
                type="button"
                class="w-full rounded-lg bg-teal-600 px-5 py-3 font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="saving || !isDirty"
                @click="saveTemplate"
              >
                {{ saving ? 'Saving…' : 'Save template' }}
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div class="flex h-full min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold text-slate-900">Preview</h2>
              <span class="text-xs font-medium text-teal-700">{{ selectedMeta?.name }}</span>
            </div>
            <p class="mb-4 text-sm text-slate-500">
              Sample DigiKard card as others would see it. Switch styles to preview; save when you're happy.
            </p>
            <div class="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <TenantDigikardCardPreview :template-id="selectedTemplate" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
