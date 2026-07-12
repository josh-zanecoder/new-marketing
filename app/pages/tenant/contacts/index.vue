<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Audience</p>
        <h1 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Contacts
        </h1>
        <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          All contacts in your tenant database, newest updates first.
        </p>
      </div>
      <div class="flex items-center gap-2 sm:shrink-0">
        <button
          type="button"
          class="btn-cta group"
          @click="openAddContactModal"
        >
          <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add contact
        </button>
        <TenantRefreshIconButton
          aria-label="Refresh contacts"
          :pending="pending"
          @click="() => load({ force: true })"
        />
      </div>
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
      v-if="data?.truncated"
      class="flex gap-3.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-5 py-4 text-sm text-amber-950 shadow-sm sm:text-[0.9375rem]"
      role="status"
    >
      <div class="mt-0.5 shrink-0 text-amber-600">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <p class="font-semibold text-amber-950">
          Partial list
        </p>
        <p class="mt-1.5 leading-relaxed text-amber-900/90">
          Showing the <strong class="font-semibold">{{ data.contacts.length }}</strong> most recently updated contacts.
          Total in database: <strong class="font-semibold tabular-nums">{{ data.total.toLocaleString() }}</strong>.
        </p>
      </div>
    </div>

    <div
      v-if="subscriptionActionError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm sm:text-[0.9375rem]"
      role="alert"
    >
      {{ subscriptionActionError }}
    </div>

    <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
      <div class="min-w-0 flex-1">
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
            placeholder="Search name, email, company…"
            class="w-full rounded-xl border border-slate-200/90 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:py-3.5 sm:text-[0.9375rem]"
          >
        </div>
      </div>
      <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center">
        <TenantFilterSelect
          id="contacts-subscription-filter"
          v-model="subscriptionFilter"
          label="Subscription"
          :options="subscriptionFilterSelectOptions"
          class="w-full shrink-0 lg:w-[14rem]"
        />
        <TenantFilterSelect
          id="contacts-kind-filter"
          v-model="contactTypeFilter"
          label="Contact type"
          :options="contactTypeSelectOptions"
          class="w-full shrink-0 lg:w-[14rem]"
        />
      </div>
    </div>

    <div
      v-if="pending"
      class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
    >
      <div class="divide-y divide-slate-100 lg:hidden">
        <div v-for="n in 5" :key="`mobile-skel-${n}`" class="animate-pulse space-y-3 p-4">
          <div class="h-4 w-2/3 max-w-xs rounded bg-slate-100" />
          <div class="h-3 w-1/2 max-w-[10rem] rounded bg-slate-100" />
          <div class="h-8 w-full rounded-lg bg-slate-100" />
        </div>
      </div>
      <div class="hidden space-y-3 p-5 sm:p-6 lg:block">
        <div v-for="n in 8" :key="n" class="h-12 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>

    <div
      v-else-if="data && !filteredContacts.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-sm shadow-slate-900/[0.03] sm:py-24"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100"
      >
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
        {{ data.contacts.length ? 'No matching contacts' : 'No contacts yet' }}
      </h3>
      <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
        {{ data.contacts.length ? noMatchesHint : 'Contacts will appear here as they sync into your tenant.' }}
      </p>
    </div>

    <div
      v-else-if="data"
      class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
    >
      <ul class="divide-y divide-slate-100 lg:hidden">
        <li v-for="row in paginatedContacts" :key="`mobile-${row.id}`" class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-900">
                {{ row.name || '—' }}
              </p>
              <p class="mt-0.5 truncate text-xs text-slate-500" :title="row.email || undefined">
                {{ row.email || '—' }}
              </p>
              <p v-if="row.company" class="mt-1 truncate text-xs text-slate-500" :title="row.company">
                {{ row.company }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                @click="openEditContactModal(row.id)"
              >
                Edit
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                @click="openContactDetail(row.id)"
              >
                View
              </button>
            </div>
          </div>

          <div v-if="row.contactType?.length" class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="(label, idx) in row.contactTypeLabels"
              :key="`${row.id}-mobile-${row.contactType![idx]}`"
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset"
              :class="typeKeyBadgeClass(row.contactType![idx] ?? '')"
            >
              {{ label }}
            </span>
          </div>
          <span
            v-else
            class="mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset"
            :class="typeKeyBadgeClass(row.contactType?.[0] ?? '')"
          >
            {{ row.primaryTypeLabel }}
          </span>

          <div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span class="text-xs font-medium text-slate-500">Subscription</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                class="text-xs font-medium tabular-nums"
                :class="row.is_unsubscribe ? 'text-amber-800' : 'text-emerald-800'"
              >
                {{ subscriptionSavingId === row.id ? 'Saving…' : row.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }}
              </span>
            </div>
          </div>
        </li>
      </ul>

      <div class="hidden overflow-x-auto lg:block">
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in paginatedContacts"
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
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                    class="hidden text-[0.8125rem] font-medium tabular-nums xl:inline"
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
                <div class="inline-flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    @click="openEditContactModal(row.id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    @click="openContactDetail(row.id)"
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="filteredContacts.length"
        class="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4"
      >
        <p class="min-w-0 text-xs tabular-nums text-slate-500 sm:text-sm">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="text-slate-300"> / </span>
          <span>{{ paginationMeta.total.toLocaleString() }}</span>
        </p>
        <nav
          class="flex shrink-0 items-center gap-1 sm:gap-1.5"
          aria-label="Contacts pagination"
        >
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            <span class="sm:hidden">Prev</span>
            <span class="hidden sm:inline">Previous</span>
          </button>
          <span class="whitespace-nowrap px-1 text-center text-xs font-medium tabular-nums text-slate-500 sm:min-w-[6.5rem] sm:text-[0.8125rem]">
            <span class="sm:hidden">{{ currentPage }}/{{ totalPages }}</span>
            <span class="hidden sm:inline">Page {{ currentPage }} / {{ totalPages }}</span>
          </span>
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </nav>
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
          class="relative flex max-h-[min(92dvh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
        >
          <div
            class="flex shrink-0 justify-center pt-2.5 sm:hidden"
            aria-hidden="true"
          >
            <span class="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          <div v-if="viewContactLoading" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-slate-500">
              Loading contact…
            </p>
          </div>

          <template v-else-if="viewContactError">
            <div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p class="max-w-sm text-sm text-red-700" role="alert">
                {{ viewContactError }}
              </p>
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                @click="closeContactDetail"
              >
                Close
              </button>
            </div>
          </template>

          <template v-else-if="viewContactDetail">
            <div class="shrink-0 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-primary-50/40 px-4 py-5 sm:px-6">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-4">
                  <div
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 text-lg font-semibold text-white shadow-md shadow-primary-500/20"
                    aria-hidden="true"
                  >
                    {{ contactDetailInitials }}
                  </div>
                  <div class="min-w-0 pt-0.5">
                    <h2 id="contact-detail-title" class="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                      {{ viewContactDetail.name || 'Contact details' }}
                    </h2>
                    <p v-if="viewContactDetail.company" class="mt-1 truncate text-sm text-slate-500">
                      {{ viewContactDetail.company }}
                    </p>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset"
                        :class="viewContactDetail.is_unsubscribe
                          ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
                          : 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'"
                      >
                        {{ viewContactDetail.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }}
                      </span>
                      <span
                        v-for="(label, idx) in viewContactDetail.contactTypeLabels"
                        :key="`${viewContactDetail.id}-type-${idx}`"
                        class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset"
                        :class="typeKeyBadgeClass(viewContactDetail.contactType?.[idx] ?? '')"
                      >
                        {{ label }}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  aria-label="Close contact details"
                  @click="closeContactDetail"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="mt-5 grid gap-2 sm:grid-cols-2">
                <a
                  v-if="viewContactDetail.email"
                  :href="`mailto:${viewContactDetail.email}`"
                  class="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-3 shadow-sm transition-colors hover:border-primary-200 hover:bg-white"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Email</span>
                    <span class="block truncate text-sm font-medium text-slate-900 group-hover:text-primary-700">{{ viewContactDetail.email }}</span>
                  </span>
                </a>
                <a
                  v-if="viewContactDetail.phone"
                  :href="`tel:${viewContactDetail.phone}`"
                  class="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-3 shadow-sm transition-colors hover:border-primary-200 hover:bg-white"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Phone</span>
                    <span class="block truncate text-sm font-medium text-slate-900 group-hover:text-primary-700">{{ formatUsPhoneNumber(viewContactDetail.phone) }}</span>
                  </span>
                </a>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div class="space-y-4">
                <section class="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
                  <h3 class="text-sm font-semibold text-slate-900">
                    CRM details
                  </h3>
                  <dl class="mt-4 grid gap-4 sm:grid-cols-2">
                    <div v-if="hasDetailValue(viewContactDetail.status)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Status</dt>
                      <dd class="mt-1 text-sm font-medium text-slate-900">{{ viewContactDetail.status }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewContactDetail.stage)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Stage</dt>
                      <dd class="mt-1 text-sm font-medium text-slate-900">{{ viewContactDetail.stage }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewContactDetail.channel)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Channel</dt>
                      <dd class="mt-1 text-sm font-medium text-slate-900">{{ viewContactDetail.channel }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewContactDetail.firstName) || hasDetailValue(viewContactDetail.lastName)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Full name</dt>
                      <dd class="mt-1 text-sm font-medium text-slate-900">
                        {{ [viewContactDetail.firstName, viewContactDetail.lastName].filter(Boolean).join(' ') || '—' }}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
                  <h3 class="text-sm font-semibold text-slate-900">
                    Address
                  </h3>
                  <p v-if="contactDetailAddressFormatted" class="mt-3 text-sm leading-relaxed text-slate-700">
                    {{ contactDetailAddressFormatted }}
                  </p>
                  <p v-else class="mt-3 text-sm text-slate-400">
                    No address on file
                  </p>
                </section>

                <section
                  v-if="contactDetailHasOwner"
                  class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5"
                >
                  <h3 class="text-sm font-semibold text-slate-900">
                    Account owner
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Used for email merge tokens and reply-to
                  </p>
                  <div class="mt-4 flex items-center gap-4">
                    <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
                      <img
                        v-if="ownerAvatarUrl && !ownerAvatarLoadFailed"
                        :src="ownerAvatarUrl"
                        alt=""
                        class="h-full w-full object-cover"
                        @error="ownerAvatarLoadFailed = true"
                      >
                      <div
                        v-else
                        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-500 to-violet-600 text-sm font-semibold text-white"
                        aria-hidden="true"
                      >
                        {{ ownerDetailInitials }}
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-semibold text-slate-900">
                        {{ ownerDisplayName }}
                      </p>
                      <p v-if="ownerEmailDisplay" class="mt-0.5 truncate text-sm text-slate-500">
                        {{ ownerEmailDisplay }}
                      </p>
                      <p v-if="ownerPhoneDisplay" class="mt-0.5 text-sm text-slate-600">
                        {{ ownerPhoneDisplay }}
                      </p>
                    </div>
                  </div>
                </section>

                <section
                  v-if="viewContactDetail.contactProfile"
                  class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5"
                >
                  <h3 class="text-sm font-semibold text-slate-900">
                    Contact profile
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Structured segment type and subtypes
                  </p>
                  <pre class="mt-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-[0.8125rem] leading-relaxed text-slate-100">{{ formatJson(viewContactDetail.contactProfile) }}</pre>
                </section>

                <section class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3 sm:px-5">
                  <dl class="grid gap-3 sm:grid-cols-3">
                    <div v-if="viewContactDetail.createdAt">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Created</dt>
                      <dd class="mt-1 text-xs font-medium text-slate-600">{{ formatDate(viewContactDetail.createdAt) }}</dd>
                    </div>
                    <div v-if="viewContactDetail.updatedAt">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Updated</dt>
                      <dd class="mt-1 text-xs font-medium text-slate-600">{{ formatDate(viewContactDetail.updatedAt) }}</dd>
                    </div>
                    <div v-if="viewContactDetail.source">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-400">Source</dt>
                      <dd class="mt-1 text-xs font-medium text-slate-600">{{ viewContactDetail.source }}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>

            <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 sm:order-2 sm:w-auto"
                @click="editFromContactDetail"
              >
                Edit contact
              </button>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:order-1 sm:w-auto"
                @click="closeContactDetail"
              >
                Close
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="addContactOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-title"
      >
        <div
          class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="closeContactFormModal"
        />
        <div
          class="relative flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/[0.04] sm:rounded-2xl"
          @click.stop
        >
          <div
            class="flex shrink-0 justify-center pt-2.5 sm:hidden"
            aria-hidden="true"
          >
            <span class="h-1 w-10 rounded-full bg-slate-200" />
          </div>
          <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-5">
            <div class="min-w-0">
              <h2 id="contact-form-title" class="text-base font-semibold text-slate-900 sm:text-lg">
                {{ contactFormMode === 'edit' ? 'Edit contact' : 'Add contact' }}
              </h2>
              <p class="mt-1 text-xs text-slate-500 sm:text-sm">
                {{ contactFormMode === 'edit'
                  ? 'Update contact details in your tenant database.'
                  : 'Create a contact manually in your tenant database.' }}
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:px-2 sm:py-1 sm:shadow-none"
              :aria-label="contactFormMode === 'edit' ? 'Close edit contact form' : 'Close add contact form'"
              :disabled="addContactSubmitting || contactFormLoading"
              @click="closeContactFormModal"
            >
              <svg class="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="hidden text-sm font-semibold text-slate-600 sm:inline">Close</span>
            </button>
          </div>
          <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submitContactForm">
            <div
              v-if="contactFormLoading"
              class="flex min-h-0 flex-1 items-center justify-center px-4 py-12 sm:px-6"
            >
              <p class="text-sm font-medium text-slate-500">
                Loading contact…
              </p>
            </div>
            <template v-else>
            <div class="tenant-add-contact-form min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
            <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700" for="add-contact-first-name">First name <span class="text-red-600">*</span></label>
                <input
                  id="add-contact-first-name"
                  v-model="addContactForm.firstName"
                  type="text"
                  required
                  autocomplete="given-name"
                  placeholder="John"
                  :class="ADD_CONTACT_INPUT_CLASS"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700" for="add-contact-last-name">Last name <span class="text-red-600">*</span></label>
                <input
                  id="add-contact-last-name"
                  v-model="addContactForm.lastName"
                  type="text"
                  required
                  autocomplete="family-name"
                  placeholder="Doe"
                  :class="ADD_CONTACT_INPUT_CLASS"
                >
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700" for="add-contact-email">Email <span class="text-red-600">*</span></label>
              <input
                id="add-contact-email"
                v-model="addContactForm.email"
                type="email"
                required
                autocomplete="email"
                placeholder="john.doe@example.com"
                :class="ADD_CONTACT_INPUT_CLASS"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700" for="add-contact-phone">Phone</label>
              <input
                id="add-contact-phone"
                :value="addContactForm.phone"
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                placeholder="(555) 123-4567"
                :class="ADD_CONTACT_INPUT_CLASS"
                @keydown="onContactPhoneKeydown"
                @input="onContactPhoneInput"
                @paste="onContactPhonePaste"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700" for="add-contact-company">Company</label>
              <input
                id="add-contact-company"
                v-model="addContactForm.company"
                type="text"
                autocomplete="organization"
                placeholder="Acme Inc."
                :class="ADD_CONTACT_INPUT_CLASS"
              >
            </div>
            <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
              <div :class="addContactTypeOptions.length ? '' : 'min-[480px]:col-span-2'">
                <label class="block text-sm font-medium text-slate-700" for="add-contact-channel">Channel</label>
                <input
                  id="add-contact-channel"
                  v-model="addContactForm.channel"
                  type="text"
                  autocomplete="off"
                  placeholder="e.g. email"
                  :class="ADD_CONTACT_INPUT_CLASS"
                >
              </div>
              <div v-if="addContactTypeOptions.length">
                <label class="block text-sm font-medium text-slate-700" for="add-contact-type">Contact type <span class="text-red-600">*</span></label>
                <select
                  id="add-contact-type"
                  v-model="addContactForm.contactType"
                  required
                  :class="`${ADD_CONTACT_INPUT_CLASS} cursor-pointer appearance-none`"
                >
                  <option
                    v-for="opt in addContactTypeOptions"
                    :key="opt.key"
                    :value="opt.key"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700" for="add-contact-status">Status</label>
                <input
                  id="add-contact-status"
                  v-model="addContactForm.status"
                  type="text"
                  placeholder="e.g. prospect"
                  :class="ADD_CONTACT_INPUT_CLASS"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700" for="add-contact-stage">Stage</label>
                <input
                  id="add-contact-stage"
                  v-model="addContactForm.stage"
                  type="text"
                  placeholder="e.g. qualified"
                  :class="ADD_CONTACT_INPUT_CLASS"
                >
              </div>
            </div>
            <fieldset class="space-y-3 rounded-xl border border-slate-200/80 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
              <legend class="px-1 text-sm font-medium text-slate-700">
                Address
              </legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:gap-4">
                <div class="sm:col-span-4">
                  <label class="block text-sm font-medium text-slate-700" for="add-contact-street">Street address</label>
                  <input
                    id="add-contact-street"
                    v-model="addContactForm.addressStreet"
                    type="text"
                    autocomplete="street-address"
                    placeholder="123 Main Street"
                    :class="ADD_CONTACT_INPUT_CLASS"
                  >
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-slate-700" for="add-contact-unit">Unit</label>
                  <input
                    id="add-contact-unit"
                    v-model="addContactForm.addressUnit"
                    type="text"
                    autocomplete="address-line2"
                    placeholder="Apt 4B"
                    :class="ADD_CONTACT_INPUT_CLASS"
                  >
                </div>
              </div>
              <div class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700" for="add-contact-city">City</label>
                  <input
                    id="add-contact-city"
                    v-model="addContactForm.addressCity"
                    type="text"
                    autocomplete="address-level2"
                    placeholder="New York"
                    :class="ADD_CONTACT_INPUT_CLASS"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700" for="add-contact-state">State</label>
                  <input
                    id="add-contact-state"
                    v-model="addContactForm.addressState"
                    type="text"
                    autocomplete="address-level1"
                    placeholder="NY"
                    :class="ADD_CONTACT_INPUT_CLASS"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700" for="add-contact-county">County</label>
                  <input
                    id="add-contact-county"
                    v-model="addContactForm.addressCounty"
                    type="text"
                    autocomplete="off"
                    placeholder="El Paso"
                    :class="ADD_CONTACT_INPUT_CLASS"
                  >
                </div>
              </div>
            </fieldset>
            <p
              v-if="addContactError"
              class="text-sm text-red-600"
              role="alert"
            >
              {{ addContactError }}
            </p>
            </div>
            <div
              class="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-4"
            >
              <button
                type="submit"
                class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 disabled:opacity-50 sm:order-2 sm:w-auto"
                :disabled="addContactSubmitting || contactFormLoading"
              >
                {{ addContactSubmitting
                  ? 'Saving…'
                  : contactFormMode === 'edit'
                    ? 'Save changes'
                    : 'Add contact' }}
              </button>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 sm:order-1 sm:w-auto"
                :disabled="addContactSubmitting || contactFormLoading"
                @click="closeContactFormModal"
              >
                Cancel
              </button>
            </div>
            </template>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { contactTypeKeyBadgeClass } from '~~/shared/utils/contactTypeBadgeClass'
import { normalizeContactCounty, formatContactAddress } from '~~/shared/utils/contactAddress'
import { formatUsPhoneInput, formatUsPhoneNumber, isUsPhoneInputKeyAllowed } from '~~/shared/utils/usNumberFormatter'
import type {
  TenantContactDetail,
  TenantContactListRow,
  TenantContactsListPayload,
  TenantContactTypeOption
} from '~/types/tenantContact'

definePageMeta({ layout: 'default' })

function typeKeyBadgeClass(kind: string): string {
  return contactTypeKeyBadgeClass(kind)
}

const PAGE_SIZE = 25

const marketingApi = useTenantMarketingApi()
const toast = useAppToast()

const addContactOpen = ref(false)
const contactFormMode = ref<'add' | 'edit'>('add')
const editingContactId = ref('')
const contactFormLoading = ref(false)
let contactModalEscListener: ((e: KeyboardEvent) => void) | null = null
const addContactSubmitting = ref(false)
const addContactError = ref('')
const addContactForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  contactType: '',
  channel: '',
  status: '',
  stage: '',
  addressStreet: '',
  addressUnit: '',
  addressCity: '',
  addressState: '',
  addressCounty: ''
})


const ADD_CONTACT_INPUT_CLASS =
  'mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20'

function extractContactFormErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    if ('data' in error) {
      const data = (error as { data?: { message?: string; statusMessage?: string } }).data
      const message = data?.message ?? data?.statusMessage
      if (message) return String(message)
    }
    if ('statusMessage' in error) {
      return String((error as { statusMessage?: string }).statusMessage)
    }
    if ('message' in error) {
      return String((error as { message?: string }).message)
    }
  }
  return fallback
}

function emptyContactForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    contactType: '',
    channel: '',
    status: '',
    stage: '',
    addressStreet: '',
    addressUnit: '',
    addressCity: '',
    addressState: '',
    addressCounty: ''
  }
}

function populateContactFormFromDetail(contact: TenantContactDetail) {
  addContactForm.value = {
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    phone: contact.phone ? formatUsPhoneInput(contact.phone) : '',
    company: contact.company ?? '',
    contactType: contact.contactType?.[0] ?? defaultAddContactType(),
    channel: contact.channel ?? '',
    status: contact.status ?? '',
    stage: contact.stage ?? '',
    addressStreet: contact.address?.street ?? '',
    addressUnit: contact.address?.unit ?? '',
    addressCity: contact.address?.city ?? '',
    addressState: contact.address?.state ?? '',
    addressCounty: contact.address?.county ?? ''
  }
}

function onContactPhoneKeydown(event: KeyboardEvent) {
  if (!isUsPhoneInputKeyAllowed(event)) {
    event.preventDefault()
  }
}

function onContactPhoneInput(event: Event) {
  const target = event.target as HTMLInputElement
  const formatted = formatUsPhoneInput(target.value)
  addContactForm.value.phone = formatted
  if (target.value !== formatted) {
    target.value = formatted
  }
}

function onContactPhonePaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text') ?? ''
  const target = event.target as HTMLInputElement
  const start = target.selectionStart ?? addContactForm.value.phone.length
  const end = target.selectionEnd ?? start
  const merged = addContactForm.value.phone.slice(0, start) + pasted + addContactForm.value.phone.slice(end)
  const formatted = formatUsPhoneInput(merged)
  addContactForm.value.phone = formatted
  target.value = formatted
}

function buildContactFormBody(email: string) {
  const body: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    company?: string
    contactType?: string
    channel?: string
    status?: string
    stage?: string
    address?: {
      street?: string
      unit?: string
      city?: string
      state?: string
      county?: string
    }
  } = {
    firstName: addContactForm.value.firstName.trim(),
    lastName: addContactForm.value.lastName.trim(),
    email
  }
  const phone = addContactForm.value.phone.trim()
  const company = addContactForm.value.company.trim()
  const contactType = addContactForm.value.contactType.trim()
  const channel = addContactForm.value.channel.trim()
  const status = addContactForm.value.status.trim()
  const stage = addContactForm.value.stage.trim()
  if (phone) body.phone = phone
  if (company) body.company = company
  if (contactType) body.contactType = contactType
  if (channel) body.channel = channel
  if (status) body.status = status
  if (stage) body.stage = stage
  body.address = {
    street: addContactForm.value.addressStreet.trim(),
    unit: addContactForm.value.addressUnit.trim(),
    city: addContactForm.value.addressCity.trim(),
    state: addContactForm.value.addressState.trim(),
    county: normalizeContactCounty(addContactForm.value.addressCounty)
  }
  return body
}

function showContactFormError(message: string) {
  addContactError.value = message
  if (message.toLowerCase().includes('email already exists')) {
    toast.error('A contact with this email already exists.')
  } else if (message.toLowerCase().includes('phone number already exists')) {
    toast.error('A contact with this phone number already exists.')
  } else {
    toast.error(message)
  }
}

function openAddContactModal() {
  contactFormMode.value = 'add'
  editingContactId.value = ''
  contactFormLoading.value = false
  addContactError.value = ''
  addContactForm.value = {
    ...emptyContactForm(),
    contactType: defaultAddContactType()
  }
  addContactOpen.value = true
}

async function openEditContactModal(contactId: string) {
  contactFormMode.value = 'edit'
  editingContactId.value = contactId
  contactFormLoading.value = true
  addContactError.value = ''
  addContactForm.value = emptyContactForm()
  addContactOpen.value = true
  try {
    const res = await $fetch<{ contact: TenantContactDetail }>(
      `/api/v1/tenant/contacts/${encodeURIComponent(contactId)}`,
      {
        credentials: 'include',
        ...serverAuthHeaders()
      }
    )
    populateContactFormFromDetail({
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
    })
  } catch (e: unknown) {
    const message = extractContactFormErrorMessage(e, 'Failed to load contact')
    addContactError.value = message
    toast.error(message)
    addContactOpen.value = false
  } finally {
    contactFormLoading.value = false
  }
}

function closeContactFormModal() {
  if (addContactSubmitting.value || contactFormLoading.value) return
  addContactOpen.value = false
  editingContactId.value = ''
  contactFormMode.value = 'add'
  addContactError.value = ''
}

async function submitContactForm() {
  const firstName = addContactForm.value.firstName.trim()
  const lastName = addContactForm.value.lastName.trim()
  if (!firstName) {
    addContactError.value = 'First name is required.'
    toast.error('First name is required.')
    return
  }
  if (!lastName) {
    addContactError.value = 'Last name is required.'
    toast.error('Last name is required.')
    return
  }
  const email = addContactForm.value.email.trim()
  if (!email) {
    addContactError.value = 'Email is required.'
    toast.error('Email is required.')
    return
  }
  if (addContactTypeOptions.value.length && !addContactForm.value.contactType.trim()) {
    addContactError.value = 'Contact type is required.'
    toast.error('Please select a contact type.')
    return
  }
  addContactSubmitting.value = true
  addContactError.value = ''
  try {
    const body = buildContactFormBody(email)
    const wasEdit = contactFormMode.value === 'edit'
    const editedId = editingContactId.value
    if (wasEdit) {
      await marketingApi.updateContact(editedId, body)
      patchContactRowFromForm(editedId, body)
      toast.success('Contact updated successfully.')
    } else {
      await marketingApi.createContact(body)
      toast.success('Contact added successfully.')
    }
    addContactOpen.value = false
    editingContactId.value = ''
    contactFormMode.value = 'add'
    void refreshContactsSilently()
  } catch (e: unknown) {
    const fallback = contactFormMode.value === 'edit' ? 'Failed to update contact' : 'Failed to add contact'
    showContactFormError(extractContactFormErrorMessage(e, fallback))
  } finally {
    addContactSubmitting.value = false
  }
}

export type { TenantContactListRow, TenantContactTypeOption }

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

const pending = ref(true)
const loadError = ref('')
const data = ref<TenantContactsListPayload | null>(null)
const searchQuery = ref('')
/** `'all'`, `'__none__'` (no types), or lowercase contact type key. */
const contactTypeFilter = ref('all')
/** `'all'`, `'subscribed'`, or `'unsubscribed'`. */
const subscriptionFilter = ref<'all' | 'subscribed' | 'unsubscribed'>('all')
const currentPage = ref(1)
const subscriptionSavingId = ref('')
const subscriptionActionError = ref('')
const viewContactOpen = ref(false)
const viewContactLoading = ref(false)
const viewContactError = ref('')
const viewContactDetail = ref<TenantContactDetail | null>(null)
const ownerAvatarLoadFailed = ref(false)

const addContactTypeOptions = computed(() => {
  const api = data.value?.contactTypes ?? []
  return [...api]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map((t) => ({ key: t.key, label: t.label }))
})

function defaultAddContactType(): string {
  return addContactTypeOptions.value[0]?.key ?? ''
}

const KIND_FILTER_NONE = '__none__'

function rowHasAnyContactType(row: TenantContactListRow): boolean {
  return Boolean(row.contactType?.length)
}

const hasContactsWithoutKind = computed(() =>
  (data.value?.contacts ?? []).some((row) => !rowHasAnyContactType(row))
)

const contactTypeFilterOptions = computed(() => {
  const api = data.value?.contactTypes ?? []
  const ordered = [...api].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
  const base = ordered.map((t) => ({ key: t.key, label: t.label }))
  const keysFromApi = new Set(base.map((o) => o.key.toLowerCase()))
  const extras: { key: string; label: string }[] = []
  for (const row of data.value?.contacts ?? []) {
    const keys = row.contactType?.length ? row.contactType : []
    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i]).trim().toLowerCase()
      if (!k || keysFromApi.has(k)) continue
      keysFromApi.add(k)
      const label = row.contactType?.length ? row.contactTypeLabels[i] || k : row.primaryTypeLabel || k
      extras.push({ key: k, label })
    }
  }
  extras.sort((a, b) => a.label.localeCompare(b.label))
  return [...base, ...extras]
})

const subscriptionFilterSelectOptions = [
  { value: 'all', label: 'All subscriptions' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' }
] as const

const contactTypeSelectOptions = computed(() => {
  const options: { value: string; label: string }[] = [{ value: 'all', label: 'All types' }]
  if (hasContactsWithoutKind.value) {
    options.push({ value: KIND_FILTER_NONE, label: 'No type' })
  }
  for (const opt of contactTypeFilterOptions.value) {
    options.push({ value: opt.key, label: opt.label })
  }
  return options
})

const filteredContacts = computed(() => {
  let list = data.value?.contacts ?? []
  const kind = contactTypeFilter.value
  if (kind !== 'all') {
    if (kind === KIND_FILTER_NONE) {
      list = list.filter((row) => !rowHasAnyContactType(row))
    } else {
      const k = kind.toLowerCase()
      list = list.filter((row) => {
        const keys = (row.contactType ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean)
        return keys.includes(k)
      })
    }
  }
  if (subscriptionFilter.value === 'subscribed') {
    list = list.filter((row) => !row.is_unsubscribe)
  } else if (subscriptionFilter.value === 'unsubscribed') {
    list = list.filter((row) => row.is_unsubscribe)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => {
    const blob = [
      row.firstName,
      row.lastName,
      row.name,
      row.email,
      row.company,
      row.phone,
      row.primaryTypeLabel,
      ...(row.contactType ?? []),
      ...(row.contactTypeLabels ?? []),
      row.address?.street,
      row.address?.unit,
      row.address?.city,
      row.address?.state,
      row.address?.county
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
})

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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredContacts.value.length / PAGE_SIZE))
)

const paginatedContacts = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredContacts.value.slice(start, start + PAGE_SIZE)
})

const paginationMeta = computed(() => {
  const total = filteredContacts.value.length
  if (!total) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage.value * PAGE_SIZE, total)
  return { from, to, total }
})

watch([searchQuery, contactTypeFilter, subscriptionFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
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

function hasDetailValue(value: unknown): boolean {
  if (value == null) return false
  const formatted = typeof value === 'string' ? value.trim() : formatDetailValue(value)
  return formatted !== '' && formatted !== '—'
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

const ownerPhoneDisplay = computed(() => {
  const phone = ownerMetadata(viewContactDetail.value).ownerPhone
  if (typeof phone !== 'string' && typeof phone !== 'number') return ''
  const formatted = formatUsPhoneNumber(String(phone))
  return formatted || String(phone).trim()
})

const contactDetailAddressFormatted = computed(() => {
  const c = viewContactDetail.value
  if (!c?.address) return ''
  return formatContactAddress({
    street: c.address.street,
    unit: c.address.unit,
    city: c.address.city,
    state: c.address.state,
    county: normalizeContactCounty(c.address.county)
  })
})

const contactDetailHasOwner = computed(() => {
  const meta = ownerMetadata(viewContactDetail.value)
  const hasAvatar =
    typeof meta.ownerAvatarUrl === 'string' && meta.ownerAvatarUrl.trim().length > 0
  return Boolean(
    hasAvatar ||
      ownerEmailDisplay.value ||
      ownerPhoneDisplay.value ||
      hasDetailValue(meta.ownerFirstName) ||
      hasDetailValue(meta.ownerLastName)
  )
})

function editFromContactDetail() {
  const id = viewContactDetail.value?.id
  if (!id) return
  closeContactDetail()
  void openEditContactModal(id)
}

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
        ...serverAuthHeaders()
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

watch([addContactOpen, viewContactOpen], ([addOpen, viewOpen]) => {
  if (!import.meta.client) return

  document.body.style.overflow = addOpen || viewOpen ? 'hidden' : ''

  if (contactModalEscListener) {
    window.removeEventListener('keydown', contactModalEscListener)
    contactModalEscListener = null
  }

  if (addOpen || viewOpen) {
    contactModalEscListener = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (addContactOpen.value && !addContactSubmitting.value && !contactFormLoading.value) {
        closeContactFormModal()
      } else if (viewContactOpen.value) {
        closeContactDetail()
      }
    }
    window.addEventListener('keydown', contactModalEscListener)
  }
})

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
      ...serverAuthHeaders()
    })
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

function patchContactRowFromForm(
  contactId: string,
  body: ReturnType<typeof buildContactFormBody>
) {
  const rows = data.value?.contacts
  if (!rows?.length) return
  const index = rows.findIndex((row) => row.id === contactId)
  if (index < 0) return

  const existing = rows[index]!
  const typeKey = body.contactType?.trim().toLowerCase() ?? ''
  const typeOpt = data.value?.contactTypes?.find((t) => t.key === typeKey)
  const typeKeys = typeKey ? [typeKey] : existing.contactType
  const typeLabels = typeOpt ? [typeOpt.label] : existing.contactTypeLabels
  const firstName = body.firstName?.trim() ?? existing.firstName
  const lastName = body.lastName?.trim() ?? existing.lastName

  rows[index] = {
    ...existing,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(' ').trim() || existing.name,
    email: body.email,
    phone: body.phone?.trim() ?? existing.phone,
    company: body.company?.trim() ?? existing.company,
    channel: body.channel?.trim() ?? existing.channel,
    contactType: typeKeys,
    contactTypeLabels: typeLabels,
    primaryTypeLabel: typeLabels[0] ?? existing.primaryTypeLabel,
    address: {
      street: body.address?.street ?? existing.address.street,
      unit: body.address?.unit ?? existing.address.unit,
      city: body.address?.city ?? existing.address.city,
      state: body.address?.state ?? existing.address.state,
      county: body.address?.county ?? existing.address.county
    },
    updatedAt: new Date().toISOString()
  }
}

function normalizeContactsPayload(res: TenantContactsListPayload): TenantContactsListPayload {
  const contacts = (res.contacts ?? []).map((row) => ({
    ...row,
    contactType: Array.isArray(row.contactType) ? row.contactType : [],
    contactTypeLabels: Array.isArray(row.contactTypeLabels) ? row.contactTypeLabels : [],
    primaryTypeLabel: row.primaryTypeLabel ?? '—',
    is_unsubscribe: row.is_unsubscribe === true
  }))
  return {
    contacts,
    contactTypes: res.contactTypes ?? [],
    total: res.total ?? 0,
    truncated: res.truncated ?? false
  }
}

const CONTACTS_CACHE_KEY = 'tenant-contacts-index'

async function fetchContactsPayload(): Promise<TenantContactsListPayload> {
  return $fetch<TenantContactsListPayload>('/api/v1/tenant/contacts', {
    credentials: 'include',
    ...serverAuthHeaders()
  })
}

function applyContactsPayload(res: TenantContactsListPayload) {
  data.value = normalizeContactsPayload(res)
  useNuxtApp().payload.data[CONTACTS_CACHE_KEY] = data.value
  if (
    !data.value.contacts.some((row) => !rowHasAnyContactType(row)) &&
    contactTypeFilter.value === KIND_FILTER_NONE
  ) {
    contactTypeFilter.value = 'all'
  }
}

async function refreshContactsSilently() {
  try {
    applyContactsPayload(await fetchContactsPayload())
  } catch {
    // Keep the optimistic row; a full reload can recover on next visit.
  }
}

async function load(options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = readNuxtPayloadCache(CONTACTS_CACHE_KEY, useNuxtApp()) as
      | TenantContactsListPayload
      | undefined
    if (cached && Array.isArray(cached.contacts)) {
      applyContactsPayload(cached)
      pending.value = false
      loadError.value = ''
      return
    }
  }

  pending.value = true
  loadError.value = ''
  try {
    applyContactsPayload(await fetchContactsPayload())
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load contacts')
        : 'Failed to load contacts'
    data.value = null
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  load()
})

onBeforeUnmount(() => {
  if (contactModalEscListener) {
    window.removeEventListener('keydown', contactModalEscListener)
    contactModalEscListener = null
  }
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>
