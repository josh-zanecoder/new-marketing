<script setup lang="ts">
export interface MarketingAnalyticsCampaignOption {
  id: string
  name: string
}

const selectedCampaignId = defineModel<string>('modelValue', { required: true })

const props = defineProps<{
  campaigns: MarketingAnalyticsCampaignOption[]
}>()

const open = ref(false)
const searchQuery = ref('')
const rootRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedLabel = computed(() => {
  if (!selectedCampaignId.value.trim()) return 'All campaigns'
  const match = props.campaigns.find((campaign) => campaign.id === selectedCampaignId.value)
  return match?.name ?? 'Selected campaign'
})

const filteredCampaigns = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.campaigns
  return props.campaigns.filter((campaign) => campaign.name.toLowerCase().includes(q))
})

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    searchQuery.value = ''
  }
}

function selectCampaign(id: string) {
  selectedCampaignId.value = id
  open.value = false
  searchQuery.value = ''
}

function onDocumentPointerDown(event: MouseEvent) {
  const root = rootRef.value
  if (!root || !open.value) return
  if (event.target instanceof Node && root.contains(event.target)) return
  open.value = false
  searchQuery.value = ''
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="relative w-full min-w-0 lg:flex-1 lg:max-w-sm">
    <span class="mb-1.5 block text-xs font-medium text-zinc-500">Campaign</span>
    <button
      type="button"
      class="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-800 shadow-sm shadow-zinc-950/5 transition hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span class="min-w-0 truncate">{{ selectedLabel }}</span>
      <svg
        class="h-4 w-4 shrink-0 text-zinc-400 transition-transform"
        :class="{ 'rotate-180': open }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-show="open"
      class="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-950/10"
      role="listbox"
      aria-label="Campaign options"
    >
      <div class="border-b border-zinc-100 p-2">
        <label class="sr-only" for="marketing-analytics-campaign-search">Search campaigns</label>
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="marketing-analytics-campaign-search"
            ref="searchInputRef"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search campaigns…"
            class="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/80 py-2.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            @keydown.escape="open = false"
          >
        </div>
      </div>

      <ul class="max-h-64 overflow-y-auto py-1">
        <li>
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-zinc-50"
            :class="
              !selectedCampaignId
                ? 'bg-indigo-50 font-semibold text-indigo-900'
                : 'font-medium text-zinc-700'
            "
            role="option"
            :aria-selected="!selectedCampaignId"
            @click="selectCampaign('')"
          >
            All campaigns
            <svg
              v-if="!selectedCampaignId"
              class="h-4 w-4 shrink-0 text-indigo-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </li>
        <li v-if="filteredCampaigns.length === 0">
          <p class="px-4 py-6 text-center text-sm text-zinc-500">
            No campaigns match your search.
          </p>
        </li>
        <li v-for="campaign in filteredCampaigns" :key="campaign.id">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-zinc-50"
            :class="
              selectedCampaignId === campaign.id
                ? 'bg-indigo-50 font-semibold text-indigo-900'
                : 'font-medium text-zinc-700'
            "
            role="option"
            :aria-selected="selectedCampaignId === campaign.id"
            @click="selectCampaign(campaign.id)"
          >
            <span class="min-w-0 truncate">{{ campaign.name }}</span>
            <svg
              v-if="selectedCampaignId === campaign.id"
              class="h-4 w-4 shrink-0 text-indigo-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
