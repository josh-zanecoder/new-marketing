<template>
  <div class="relative">
    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
      {{ label }}
    </label>
    <div class="relative">
      <input
        ref="inputEl"
        v-model="draft"
        type="email"
        autocomplete="off"
        placeholder="Search LO email or name…"
        class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 pr-10 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:text-[15px]"
        :aria-expanded="dropdownOpen"
        aria-autocomplete="list"
        aria-controls="campaign-sender-candidates"
        @focus="onFocus"
        @input="onInput"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="confirmActive"
        @keydown.escape="closeDropdown"
      >
      <span
        v-if="loading"
        class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600"
        aria-hidden="true"
      />
    </div>

    <ul
      v-if="dropdownOpen && (candidates.length || draft.trim())"
      id="campaign-sender-candidates"
      role="listbox"
      class="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
    >
      <li
        v-for="(c, idx) in candidates"
        :key="c.email"
        role="option"
        :aria-selected="idx === activeIndex"
        class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors"
        :class="idx === activeIndex ? 'bg-primary-50' : 'hover:bg-slate-50'"
        @mousedown.prevent="selectCandidate(c)"
        @mouseenter="activeIndex = idx"
      >
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-xs font-semibold text-white"
        >
          <img
            v-if="c.avatarUrl && !avatarFailed[c.email]"
            :src="c.avatarUrl"
            :alt="c.displayName"
            class="h-full w-full object-cover"
            @error="avatarFailed[c.email] = true"
          >
          <span v-else>{{ initials(c) }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-slate-900">{{ c.displayName }}</p>
          <p class="truncate text-xs text-slate-500">{{ c.email }}</p>
        </div>
      </li>
      <li
        v-if="!loading && !candidates.length && draft.trim()"
        class="px-3 py-2.5 text-sm text-slate-500"
      >
        No matching profiles — you can still use this email if valid.
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
export type SenderCandidate = {
  email: string
  firstName: string
  lastName: string
  displayName: string
  avatarUrl: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Optional field label (default: Sender email). */
    label?: string
  }>(),
  { label: 'Sender email' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Fired on keyboard input only (not on LO profile select). */
  typed: []
  select: [candidate: SenderCandidate]
}>()

const marketingApi = useTenantMarketingApi()
const draft = ref(props.modelValue || '')
const candidates = ref<SenderCandidate[]>([])
const loading = ref(false)
const dropdownOpen = ref(false)
const activeIndex = ref(0)
const avatarFailed = reactive<Record<string, boolean>>({})
const inputEl = ref<HTMLInputElement | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

watch(
  () => props.modelValue,
  (v) => {
    if (v !== draft.value) draft.value = v || ''
  }
)

watch(draft, (v) => {
  emit('update:modelValue', v.trim())
})

function initials(c: Pick<SenderCandidate, 'firstName' | 'lastName' | 'email'>): string {
  const a = (c.firstName || '').charAt(0)
  const b = (c.lastName || '').charAt(0)
  const s = `${a}${b}`.toUpperCase()
  if (s) return s
  return (c.email || '?').charAt(0).toUpperCase()
}

async function search(q: string) {
  const seq = ++searchSeq
  loading.value = true
  try {
    const res = await marketingApi.fetchCampaignSenderCandidates(q)
    if (seq !== searchSeq) return
    candidates.value = res.candidates ?? []
    activeIndex.value = 0
  } catch {
    if (seq !== searchSeq) return
    candidates.value = []
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void search(draft.value.trim())
  }, 220)
}

function onFocus() {
  dropdownOpen.value = true
  scheduleSearch()
}

function onInput() {
  dropdownOpen.value = true
  scheduleSearch()
  emit('typed')
}

function closeDropdown() {
  dropdownOpen.value = false
}

function moveActive(delta: number) {
  if (!candidates.value.length) return
  const n = candidates.value.length
  activeIndex.value = (activeIndex.value + delta + n) % n
}

function confirmActive() {
  const c = candidates.value[activeIndex.value]
  if (c) selectCandidate(c)
  else closeDropdown()
}

function selectCandidate(c: SenderCandidate) {
  draft.value = c.email
  emit('update:modelValue', c.email)
  emit('select', c)
  closeDropdown()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  if (searchTimer) clearTimeout(searchTimer)
})

function onDocClick(ev: MouseEvent) {
  const el = inputEl.value
  if (!el || !(ev.target instanceof Node)) return
  const root = el.closest('.relative')
  if (root && !root.contains(ev.target)) closeDropdown()
}
</script>
