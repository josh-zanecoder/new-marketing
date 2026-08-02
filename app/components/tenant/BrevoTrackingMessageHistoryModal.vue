<script setup lang="ts">
import {
  formatBrevoSmtpEventLabel,
  formatBrevoSmtpEventTableDate
} from '~/utils/brevoSmtpEventFormat'
import { brevoEventTypeTooltip } from '~/utils/brevoEventTypeTooltip'

export type TrackingHistoryEvent = {
  email?: string
  date?: string
  messageId?: string
  event?: string
  subject?: string
  tag?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
}

const props = defineProps<{
  open: boolean
  recipientEmail?: string
  subject?: string
  messageId?: string
  events: TrackingHistoryEvent[]
}>()

const emit = defineEmits<{
  close: []
}>()

const sortedEvents = computed(() =>
  [...props.events].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  )
)

const title = computed(() => {
  const sub = props.subject?.trim()
  if (sub) return sub
  const email = props.recipientEmail?.trim()
  if (email) return email
  return 'Message history'
})

const subtitle = computed(() => {
  const email = props.recipientEmail?.trim()
  const sub = props.subject?.trim()
  if (sub && email) return email
  return ''
})

function close() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function eventTone(event: string | undefined): {
  ring: string
  bg: string
  icon: string
} {
  const e = (event || '').toLowerCase().replace(/[_\s-]+/g, '')
  if (e === 'delivered')
    return { ring: 'ring-violet-200', bg: 'bg-violet-100 text-violet-700', icon: 'delivered' }
  if (e === 'requests' || e === 'sent' || e === 'request')
    return { ring: 'ring-zinc-200', bg: 'bg-zinc-100 text-zinc-600', icon: 'sent' }
  if (e.includes('bounce') || e === 'blocked' || e === 'invalid' || e === 'error')
    return { ring: 'ring-red-200', bg: 'bg-red-100 text-red-700', icon: 'bounce' }
  if (e.includes('open') || e.includes('proxy'))
    return { ring: 'ring-emerald-200', bg: 'bg-emerald-100 text-emerald-700', icon: 'opened' }
  if (e.includes('click'))
    return { ring: 'ring-amber-200', bg: 'bg-amber-100 text-amber-800', icon: 'click' }
  if (e === 'spam' || e === 'complaint' || e === 'unsubscribed')
    return { ring: 'ring-orange-200', bg: 'bg-orange-100 text-orange-800', icon: 'spam' }
  return { ring: 'ring-zinc-200', bg: 'bg-zinc-100 text-zinc-600', icon: 'default' }
}

const eventTones = computed(() =>
  sortedEvents.value.map((ev) => eventTone(ev.event))
)

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  }
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-history-title"
    >
      <div
        class="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        aria-hidden="true"
        @click="close"
      />

      <div
        class="relative flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/20 ring-1 ring-zinc-900/[0.04] sm:rounded-2xl"
      >
        <div class="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              History
            </p>
            <h2
              id="tracking-history-title"
              class="mt-0.5 truncate text-base font-semibold text-zinc-900"
            >
              {{ title }}
            </h2>
            <p v-if="subtitle" class="mt-0.5 truncate text-sm text-zinc-500">
              {{ subtitle }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
            @click="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <ol v-if="sortedEvents.length" class="relative space-y-0">
            <li
              v-for="(ev, idx) in sortedEvents"
              :key="`${ev.event}-${ev.date}-${idx}`"
              class="relative flex gap-3.5 pb-6 last:pb-0"
            >
              <div
                v-if="idx < sortedEvents.length - 1"
                class="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-200"
                aria-hidden="true"
              />
              <div
                class="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1"
                :class="[eventTones[idx].bg, eventTones[idx].ring]"
                :title="brevoEventTypeTooltip(ev.event)"
              >
                <!-- Sent -->
                <svg
                  v-if="eventTones[idx].icon === 'sent'"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <!-- Delivered -->
                <svg
                  v-else-if="eventTones[idx].icon === 'delivered'"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <!-- Opened -->
                <svg
                  v-else-if="eventTones[idx].icon === 'opened'"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <!-- Click -->
                <svg
                  v-else-if="eventTones[idx].icon === 'click'"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <!-- Bounce / error -->
                <svg
                  v-else-if="eventTones[idx].icon === 'bounce'"
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <svg
                  v-else
                  class="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div class="min-w-0 flex-1 pt-0.5">
                <p class="text-sm font-semibold text-zinc-900">
                  {{ formatBrevoSmtpEventLabel(ev.event) }}
                </p>
                <p
                  v-if="ev.ip?.trim()"
                  class="mt-0.5 font-mono text-xs tabular-nums text-zinc-500"
                >
                  {{ ev.ip.trim() }}
                </p>
                <p
                  v-if="ev.reason?.trim()"
                  class="mt-0.5 text-xs text-zinc-500"
                >
                  {{ ev.reason.trim() }}
                </p>
                <p
                  v-if="ev.link?.trim()"
                  class="mt-0.5 truncate text-xs text-zinc-500"
                  :title="ev.link"
                >
                  {{ ev.link.trim() }}
                </p>
                <p class="mt-1 text-xs tabular-nums text-zinc-400">
                  {{ formatBrevoSmtpEventTableDate(ev.date) }}
                </p>
              </div>
            </li>
          </ol>

          <p v-else class="py-8 text-center text-sm text-zinc-500">
            No events for this message.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
