<template>
  <div class="w-full min-w-0 space-y-8 antialiased">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Contacts
      </h1>
      <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
        All contacts in your tenant database, newest updates first.
      </p>
    </header>

    <div
      v-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm sm:text-[0.9375rem]"
      role="alert"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {{ loadError }}
    </div>

    <div
      v-if="subscriptionActionError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm sm:text-[0.9375rem]"
      role="alert"
    >
      {{ subscriptionActionError }}
    </div>

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
      <div class="min-w-0 w-full max-w-lg">
        <label class="sr-only" for="contacts-search">Search contacts</label>
        <div class="relative">
          <svg class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="contacts-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search name, email, company, phone, address…"
            class="w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-11 pr-4 text-[0.9375rem] text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
          >
        </div>
      </div>
      <div class="relative w-full shrink-0 sm:w-[14rem]">
        <label class="sr-only" for="contacts-subscription-filter">Subscription</label>
        <select
          id="contacts-subscription-filter"
          v-model="subscriptionFilter"
          class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-[0.9375rem] text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
          <option value="all">
            All subscriptions
          </option>
          <option value="subscribed">
            Subscribed
          </option>
          <option value="unsubscribed">
            Unsubscribed
          </option>
        </select>
        <svg
          class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div class="relative w-full shrink-0 sm:w-[14rem]">
        <label class="sr-only" for="contacts-kind-filter">Contact type</label>
        <select
          id="contacts-kind-filter"
          v-model="contactTypeFilter"
          class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-[0.9375rem] text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
            <option value="all">
              All types
            </option>
            <option value="__none__">
              No type
            </option>
            <option
              v-for="opt in contactTypeFilterOptions"
              :key="opt.key"
              :value="opt.key"
            >
              {{ opt.label }}
            </option>
          </select>
        <svg
          class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <div
      v-if="pending"
      class="space-y-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:p-6"
    >
      <div v-for="n in 8" :key="n" class="h-12 animate-pulse rounded-xl bg-slate-100" />
    </div>

    <div
      v-else-if="data && !listContacts.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-sm shadow-slate-900/[0.03] sm:py-24"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
      >
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
        {{ data.total ? 'No matching contacts' : 'No contacts yet' }}
      </h3>
      <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
        {{ data.total ? noMatchesHint : 'Contacts will appear here as they sync into your tenant.' }}
      </p>
    </div>

    <div
      v-else-if="data"
      class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
      :class="pageLoading ? 'pointer-events-none opacity-60' : ''"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-[0.9375rem] leading-snug">
          <thead class="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/95 backdrop-blur-sm">
            <tr>
              <th
                scope="col"
                class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:pl-6 sm:pr-4"
              >
                Name
              </th>
              <th
                scope="col"
                class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:px-4"
              >
                Email
              </th>
              <th
                scope="col"
                class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:px-4"
              >
                Types
              </th>
              <th
                scope="col"
                class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:px-4"
              >
                Subscription
              </th>
              <th
                scope="col"
                class="hidden whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:table-cell lg:px-4"
              >
                Company
              </th>
              <th
                scope="col"
                class="whitespace-nowrap px-4 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:pr-6 sm:pl-4"
              >
                View
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in listContacts"
              :key="row.id"
              class="bg-white transition-colors duration-150 ease-out hover:bg-slate-50/90"
            >
              <td class="whitespace-nowrap px-4 py-4 font-semibold text-slate-900 sm:pl-6 sm:pr-4">
                {{ row.name || '—' }}
              </td>
              <td
                class="max-w-[200px] truncate px-4 py-4 text-slate-600 sm:max-w-xs sm:px-4"
                :title="row.email || undefined"
              >
                {{ row.email || '—' }}
              </td>
              <td class="max-w-[14rem] px-4 py-4 sm:px-4">
                <div v-if="row.contactType?.length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(label, idx) in row.contactTypeLabels"
                    :key="`${row.id}-${row.contactType![idx]}`"
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset"
                    :class="typeKeyBadgeClass(row.contactType![idx] ?? '')"
                  >
                    {{ label }}
                  </span>
                </div>
                <span
                  v-else
                  class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset"
                  :class="typeKeyBadgeClass(row.contactType?.[0] ?? '')"
                >
                  {{ row.primaryTypeLabel }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-4 sm:px-4">
                <div class="flex items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    :class="!row.is_unsubscribe ? 'bg-emerald-600' : 'bg-slate-300'"
                    :aria-checked="!row.is_unsubscribe"
                    :aria-label="row.is_unsubscribe ? 'Subscribe contact' : 'Unsubscribe contact'"
                    :disabled="subscriptionSavingId === row.id"
                    @click="setContactSubscription(row, row.is_unsubscribe)"
                  >
                    <span class="sr-only">{{ row.is_unsubscribe ? 'Subscribed off' : 'Subscribed on' }}</span>
                    <span
                      class="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="!row.is_unsubscribe ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                  <span
                    class="text-[0.8125rem] font-medium tabular-nums"
                    :class="row.is_unsubscribe ? 'text-amber-800' : 'text-emerald-800'"
                  >
                    {{ subscriptionSavingId === row.id ? 'Saving…' : row.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }}
                  </span>
                </div>
              </td>
              <td
                class="hidden max-w-[180px] truncate px-4 py-4 text-slate-600 lg:table-cell lg:px-4"
                :title="row.company || undefined"
              >
                {{ row.company || '—' }}
              </td>
              <td class="whitespace-nowrap px-4 py-4 text-right sm:pr-6 sm:pl-4">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  @click="openContactDetail(row.id)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="data.total"
        class="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 text-[0.9375rem] text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
      >
        <p class="tabular-nums text-slate-500">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="mx-1.5 text-slate-300">·</span>
          <span>{{ paginationMeta.total.toLocaleString() }} total</span>
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-2.5">
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none"
            :disabled="currentPage === 1 || pageLoading"
            @click="goPage(currentPage - 1)"
          >
            Previous
          </button>
          <span class="min-w-[6.5rem] px-1 text-center text-[0.8125rem] font-medium tabular-nums text-slate-500">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none"
            :disabled="currentPage === totalPages || pageLoading"
            @click="goPage(currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="viewContactOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-detail-title"
      >
        <div
          class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="closeContactDetail"
        />
        <div
          class="relative flex max-h-[min(92vh,840px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-slate-50 shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
        >
          <div class="shrink-0 border-b border-slate-200/80 bg-white px-5 py-5 sm:px-8 sm:py-6">
            <div class="flex items-start justify-between gap-4">
              <div class="flex min-w-0 items-start gap-4">
                <div
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-semibold text-white shadow-md shadow-indigo-500/25"
                  aria-hidden="true"
                >
                  {{ contactDetailInitials }}
                </div>
                <div class="min-w-0">
                  <h2 id="contact-detail-title" class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {{ viewContactDetail?.name || 'Contact details' }}
                  </h2>
                  <p v-if="viewContactDetail?.email" class="mt-1 truncate text-sm text-slate-600">
                    {{ viewContactDetail.email }}
                  </p>
                  <div v-if="viewContactDetail && !viewContactLoading" class="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                      :class="viewContactDetail.is_unsubscribe
                        ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
                        : 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'"
                    >
                      {{ viewContactDetail.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }}
                    </span>
                    <span
                      v-for="(label, idx) in viewContactDetail.contactTypeLabels"
                      :key="`${viewContactDetail.id}-type-${idx}`"
                      class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                      :class="typeKeyBadgeClass(viewContactDetail.contactType?.[idx] ?? '')"
                    >
                      {{ label }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                @click="closeContactDetail"
              >
                Close
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            <div v-if="viewContactLoading" class="flex items-center justify-center py-16">
              <p class="text-sm font-medium text-slate-500">
                Loading contact…
              </p>
            </div>
            <p v-else-if="viewContactError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {{ viewContactError }}
            </p>
            <template v-else-if="viewContactDetail">
              <div class="grid gap-5 lg:grid-cols-2">
                <section
                  v-for="section in contactDetailSections"
                  :key="section.title"
                  class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02]"
                  :class="section.fullWidth ? 'lg:col-span-2' : ''"
                >
                  <div class="mb-4 border-b border-slate-100 pb-3">
                    <h3 class="text-sm font-semibold text-slate-900">
                      {{ section.title }}
                    </h3>
                    <p v-if="section.description" class="mt-0.5 text-xs text-slate-500">
                      {{ section.description }}
                    </p>
                  </div>
                  <div
                    v-if="section.title === 'Account owner'"
                    class="mb-5 flex items-center gap-4 border-b border-slate-100 pb-4"
                  >
                    <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-2 ring-slate-200/80 shadow-sm">
                      <img
                        v-if="ownerAvatarUrl && !ownerAvatarLoadFailed"
                        :src="ownerAvatarUrl"
                        alt=""
                        class="h-full w-full object-cover"
                        @error="ownerAvatarLoadFailed = true"
                      >
                      <div
                        v-else
                        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-semibold text-white"
                        aria-hidden="true"
                      >
                        {{ ownerDetailInitials }}
                      </div>
                    </div>
                    <div class="min-w-0">
                      <p class="truncate font-semibold text-slate-900">
                        {{ ownerDisplayName }}
                      </p>
                      <p v-if="ownerEmailDisplay" class="truncate text-sm text-slate-500">
                        {{ ownerEmailDisplay }}
                      </p>
                    </div>
                  </div>
                  <dl
                    class="grid gap-x-6 gap-y-4"
                    :class="section.columns === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'"
                  >
                    <div
                      v-for="field in section.fields"
                      :key="`${section.title}-${field.label}`"
                      :class="field.span === 2 ? 'sm:col-span-2' : ''"
                    >
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
                        {{ field.label }}
                      </dt>
                      <dd
                        class="mt-1 break-words text-[0.9375rem] leading-snug text-slate-900"
                        :class="field.mono ? 'font-mono text-[0.8125rem] text-slate-800' : ''"
                      >
                        {{ field.value }}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section
                v-if="viewContactDetail.contactProfile"
                class="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02]"
              >
                <div class="mb-4 border-b border-slate-100 pb-3">
                  <h3 class="text-sm font-semibold text-slate-900">
                    Contact profile
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Structured segment type and subtypes
                  </p>
                </div>
                <pre class="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-[0.8125rem] leading-relaxed text-slate-100">{{ formatJson(viewContactDetail.contactProfile) }}</pre>
              </section>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { contactTypeKeyBadgeClass } from '~~/shared/utils/contactTypeBadgeClass'
import { formatUsPhoneNumber } from '~~/shared/utils/usNumberFormatter'
import type {
  TenantContactDetail,
  TenantContactListRow,
  TenantContactsListPayload,
  TenantContactTypeOption
} from '~/types/tenantContact'

definePageMeta({ layout: 'default', ssr: false })

function typeKeyBadgeClass(kind: string): string {
  return contactTypeKeyBadgeClass(kind)
}

const marketingApi = useTenantMarketingApi()
const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300

export type { TenantContactListRow, TenantContactTypeOption }

const pending = ref(true)
const pageLoading = ref(false)
const loadError = ref('')
const data = ref<TenantContactsListPayload | null>(null)
const searchQuery = ref('')
const debouncedSearch = ref('')
const contactTypeFilter = ref('all')
const subscriptionFilter = ref<'all' | 'subscribed' | 'unsubscribed'>('all')
const currentPage = ref(1)
const subscriptionSavingId = ref('')
const subscriptionActionError = ref('')
const viewContactOpen = ref(false)
const viewContactLoading = ref(false)
const viewContactError = ref('')
const viewContactDetail = ref<TenantContactDetail | null>(null)
const ownerAvatarLoadFailed = ref(false)

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let loadSeq = 0

const contactTypeFilterOptions = computed(() => {
  const api = data.value?.contactTypes ?? []
  return [...api]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map((t) => ({ key: t.key, label: t.label }))
})

const listContacts = computed(() => data.value?.contacts ?? [])

const noMatchesHint = computed(() => {
  const hasSearch = Boolean(searchQuery.value.trim())
  const hasKind = contactTypeFilter.value !== 'all'
  const hasSubscription = subscriptionFilter.value !== 'all'
  if (hasSearch && (hasKind || hasSubscription)) return 'Try a different search or filter.'
  if (hasSearch) return 'Try a different search.'
  if (hasKind && hasSubscription) return 'No contacts match these filters.'
  if (hasKind) return 'No contacts match this type. Try another type or choose “All types”.'
  if (hasSubscription) {
    return subscriptionFilter.value === 'subscribed'
      ? 'No subscribed contacts match your filters.'
      : 'No unsubscribed contacts match your filters.'
  }
  return 'Try a different search or filter.'
})

const totalPages = computed(() => Math.max(1, data.value?.totalPages ?? 1))

const paginationMeta = computed(() => {
  const total = data.value?.total ?? 0
  if (!total) return { from: 0, to: 0, total: 0 }
  const page = data.value?.page ?? currentPage.value
  const pageSize = data.value?.pageSize ?? PAGE_SIZE
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return { from, to, total }
})

function normalizeContactRow(row: TenantContactListRow): TenantContactListRow {
  return {
    ...row,
    contactType: Array.isArray(row.contactType) ? row.contactType : [],
    contactTypeLabels: Array.isArray(row.contactTypeLabels) ? row.contactTypeLabels : [],
    primaryTypeLabel: row.primaryTypeLabel ?? '—',
    is_unsubscribe: row.is_unsubscribe === true
  }
}

const fetchKey = computed(
  () =>
    `${currentPage.value}|${debouncedSearch.value}|${contactTypeFilter.value}|${subscriptionFilter.value}`
)

watch(searchQuery, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
    if (currentPage.value !== 1) currentPage.value = 1
  }, SEARCH_DEBOUNCE_MS)
})

watch([contactTypeFilter, subscriptionFilter], () => {
  if (currentPage.value !== 1) currentPage.value = 1
})

watch(fetchKey, () => {
  if (import.meta.client) void loadList()
})

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => formatDetailValue(v)).join(', ') : '—'
  }
  return formatJson(value)
}

type ContactDetailField = {
  label: string
  value: string
  mono?: boolean
  span?: number
}

type ContactDetailSection = {
  title: string
  description?: string
  fields: ContactDetailField[]
  columns?: 1 | 2
  fullWidth?: boolean
}

const contactDetailInitials = computed(() => {
  const c = viewContactDetail.value
  if (!c) return '?'
  const first = c.firstName?.charAt(0) || c.name?.charAt(0) || ''
  const last = c.lastName?.charAt(0) || ''
  const value = `${first}${last}`.toUpperCase()
  return value || c.email?.charAt(0)?.toUpperCase() || '?'
})

function ownerMetadata(
  contact: TenantContactDetail | null | undefined
): Record<string, unknown> {
  const meta = contact?.metadata
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
}

const ownerAvatarUrl = computed(() => {
  const url = ownerMetadata(viewContactDetail.value).ownerAvatarUrl
  return typeof url === 'string' ? url.trim() : ''
})

const ownerEmailDisplay = computed(() => {
  const email = ownerMetadata(viewContactDetail.value).ownerEmail
  return typeof email === 'string' ? email.trim() : ''
})

const ownerDisplayName = computed(() => {
  const meta = ownerMetadata(viewContactDetail.value)
  const first = typeof meta.ownerFirstName === 'string' ? meta.ownerFirstName.trim() : ''
  const last = typeof meta.ownerLastName === 'string' ? meta.ownerLastName.trim() : ''
  const full = [first, last].filter(Boolean).join(' ')
  return full || ownerEmailDisplay.value || 'Account owner'
})

const ownerDetailInitials = computed(() => {
  const meta = ownerMetadata(viewContactDetail.value)
  const first = typeof meta.ownerFirstName === 'string' ? meta.ownerFirstName.charAt(0) : ''
  const last = typeof meta.ownerLastName === 'string' ? meta.ownerLastName.charAt(0) : ''
  const value = `${first}${last}`.toUpperCase()
  if (value) return value
  return ownerEmailDisplay.value?.charAt(0)?.toUpperCase() || '?'
})

const contactDetailSections = computed((): ContactDetailSection[] => {
  const c = viewContactDetail.value
  if (!c) return []

  const typeLabel = c.contactTypeLabels?.length
    ? c.contactTypeLabels.join(', ')
    : formatDetailValue(c.primaryTypeLabel)

  const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {}
  const ownerFields: ContactDetailField[] = [
    { label: 'Owner email', value: formatDetailValue(meta.ownerEmail) },
    { label: 'Owner first name', value: formatDetailValue(meta.ownerFirstName) },
    { label: 'Owner last name', value: formatDetailValue(meta.ownerLastName) },
    { label: 'Owner phone', value: meta.ownerPhone ? formatUsPhoneNumber(String(meta.ownerPhone)) : '—' }
  ].filter((f) => f.value !== '—')

  const hasOwnerAvatar =
    typeof meta.ownerAvatarUrl === 'string' && meta.ownerAvatarUrl.trim().length > 0

  const sections: ContactDetailSection[] = [
    {
      title: 'Contact',
      description: 'Primary person and company details',
      fields: [
        { label: 'First name', value: formatDetailValue(c.firstName) },
        { label: 'Last name', value: formatDetailValue(c.lastName) },
        { label: 'Email', value: formatDetailValue(c.email) },
        { label: 'Phone', value: c.phone ? formatUsPhoneNumber(c.phone) : '—' },
        { label: 'Company', value: formatDetailValue(c.company), span: 2 },
        { label: 'Channel', value: formatDetailValue(c.channel) },
        { label: 'Subscription', value: c.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }
      ]
    },
    {
      title: 'CRM status',
      description: 'Pipeline and segmentation from sync',
      fields: [
        { label: 'Status', value: formatDetailValue(c.status) },
        { label: 'Stage', value: formatDetailValue(c.stage) },
        { label: 'Contact types', value: typeLabel, span: 2 }
      ]
    },
    {
      title: 'Address',
      fields: [
        { label: 'Street', value: formatDetailValue(c.address?.street), span: 2 },
        { label: 'City', value: formatDetailValue(c.address?.city) },
        { label: 'State', value: formatDetailValue(c.address?.state) },
        { label: 'County', value: formatDetailValue(c.address?.county), span: 2 }
      ]
    },
    {
      title: 'Timestamps',
      fields: [
        { label: 'Created', value: c.createdAt ? formatDate(c.createdAt) : '—' },
        { label: 'Updated', value: c.updatedAt ? formatDate(c.updatedAt) : '—' },
        { label: 'Deleted', value: c.deletedAt ? formatDate(c.deletedAt) : '—' }
      ]
    }
  ]

  if (ownerFields.length || hasOwnerAvatar) {
    sections.splice(2, 0, {
      title: 'Account owner',
      description: 'Owner details used for email merge tokens and reply-to',
      fields: ownerFields
    })
  }

  return sections
})

async function openContactDetail(contactId: string) {
  viewContactOpen.value = true
  viewContactLoading.value = true
  viewContactError.value = ''
  viewContactDetail.value = null
  ownerAvatarLoadFailed.value = false
  try {
    const res = await $fetch<{ contact: TenantContactDetail }>(
      `/api/v1/tenant/contacts/${encodeURIComponent(contactId)}`,
      {
        credentials: 'include',
        ...marketingApi.serverAuthHeaders()
      }
    )
    viewContactDetail.value = {
      ...res.contact,
      contactType: Array.isArray(res.contact.contactType) ? res.contact.contactType : [],
      contactTypeLabels: Array.isArray(res.contact.contactTypeLabels)
        ? res.contact.contactTypeLabels
        : [],
      primaryTypeLabel: res.contact.primaryTypeLabel ?? '—',
      is_unsubscribe: res.contact.is_unsubscribe === true,
      metadata:
        res.contact.metadata && typeof res.contact.metadata === 'object'
          ? res.contact.metadata
          : {}
    }
  } catch (e: unknown) {
    viewContactError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load contact')
        : 'Failed to load contact'
  } finally {
    viewContactLoading.value = false
  }
}

function closeContactDetail() {
  viewContactOpen.value = false
  viewContactDetail.value = null
  viewContactError.value = ''
  ownerAvatarLoadFailed.value = false
}

async function setContactSubscription(row: TenantContactListRow, subscribed: boolean) {
  if (subscriptionSavingId.value) return
  subscriptionSavingId.value = row.id
  subscriptionActionError.value = ''
  try {
    const res = await $fetch<{
      ok: boolean
      is_unsubscribe: boolean
      updatedAt: string | null
    }>(`/api/v1/tenant/contacts/${encodeURIComponent(row.id)}/subscription`, {
      method: 'PATCH',
      credentials: 'include',
      body: { subscribed },
      ...marketingApi.serverAuthHeaders()
    })
    const excludedByFilter =
      (subscriptionFilter.value === 'subscribed' && res.is_unsubscribe) ||
      (subscriptionFilter.value === 'unsubscribed' && !res.is_unsubscribe)
    if (excludedByFilter) {
      await loadList()
      return
    }
    if (data.value?.contacts) {
      const idx = data.value.contacts.findIndex((c) => c.id === row.id)
      if (idx >= 0) {
        data.value.contacts[idx] = {
          ...data.value.contacts[idx]!,
          is_unsubscribe: res.is_unsubscribe === true,
          updatedAt: res.updatedAt ?? data.value.contacts[idx]!.updatedAt
        }
      }
    }
    if (viewContactDetail.value?.id === row.id) {
      viewContactDetail.value = {
        ...viewContactDetail.value,
        is_unsubscribe: res.is_unsubscribe === true,
        updatedAt: res.updatedAt ?? viewContactDetail.value.updatedAt
      }
    }
  } catch (e: unknown) {
    subscriptionActionError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to update subscription')
        : 'Failed to update subscription'
  } finally {
    subscriptionSavingId.value = ''
  }
}

async function loadList() {
  if (!import.meta.client) return

  const seq = ++loadSeq
  const isInitial = data.value === null
  if (isInitial) {
    pending.value = true
  } else {
    pageLoading.value = true
  }
  loadError.value = ''
  try {
    const res = await marketingApi.fetchContacts({
      page: currentPage.value,
      limit: PAGE_SIZE,
      search: debouncedSearch.value,
      subscription: subscriptionFilter.value,
      contactType: contactTypeFilter.value
    })
    if (seq !== loadSeq) return

    const totalPagesResolved = Math.max(1, res.totalPages ?? 1)
    const resolvedPage = res.page ?? currentPage.value
    if (resolvedPage > totalPagesResolved && (res.total ?? 0) > 0) {
      currentPage.value = totalPagesResolved
      return
    }

    const contacts = (res.contacts ?? []).map(normalizeContactRow)
    data.value = {
      contacts,
      contactTypes: res.contactTypes ?? data.value?.contactTypes ?? [],
      total: res.total ?? 0,
      page: resolvedPage,
      pageSize: res.pageSize ?? PAGE_SIZE,
      totalPages: totalPagesResolved
    }
    currentPage.value = resolvedPage
  } catch (e: unknown) {
    if (seq !== loadSeq) return
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load contacts')
        : 'Failed to load contacts'
    if (isInitial) data.value = null
  } finally {
    if (seq === loadSeq) {
      pending.value = false
      pageLoading.value = false
    }
  }
}

onMounted(() => {
  void loadList()
})

async function goPage(page: number) {
  if (page < 1 || page > totalPages.value || pageLoading.value || page === currentPage.value) return
  currentPage.value = page
}

onUnmounted(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})
</script>
