<template>
  <div class="w-full min-w-0">
    <div class="mx-auto max-w-6xl">
    <NuxtLink
      to="/tenant/recipient-list"
      class="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 sm:mb-8"
    >
      <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </span>
      Recipient lists
    </NuxtLink>

    <div
      v-if="loadError"
      class="mb-6 flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900 shadow-sm"
      role="alert"
    >
      <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {{ loadError }}
    </div>

    <div v-if="pending" class="space-y-4">
      <div class="h-9 max-w-lg animate-pulse rounded-xl bg-zinc-100" />
      <div class="h-28 animate-pulse rounded-2xl bg-zinc-100" />
      <div class="h-72 animate-pulse rounded-2xl border border-zinc-200/80 bg-white shadow-sm" />
    </div>

    <template v-else-if="payload">
      <header class="mb-6 sm:mb-10">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div class="min-w-0 flex-1 space-y-3 sm:space-y-4">
            <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-[2rem] lg:leading-tight">
              {{ payload.list.name }}
            </h1>
            <div
              v-if="payload.list.audience"
              class="flex flex-wrap items-center gap-2 sm:gap-2.5"
            >
              <span
                class="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold capitalize text-zinc-800 ring-1 ring-zinc-200/80"
              >
                {{ payload.list.audience }}
              </span>
            </div>
            <p
              v-if="payload.list.updatedAt"
              class="flex items-center gap-2 text-sm text-zinc-500"
            >
              <svg class="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="tabular-nums">Last updated {{ formatDate(payload.list.updatedAt) }}</span>
            </p>
          </div>
          <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <NuxtLink
              :to="`/tenant/recipient-list/edit/${listId}`"
              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-zinc-900/15 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:px-5 sm:py-3"
            >
              <svg class="h-4 w-4 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit list
            </NuxtLink>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-200 hover:bg-red-50/80 sm:px-5 sm:py-3"
              @click="deleteConfirmOpen = true"
            >
              <svg class="h-4 w-4 text-red-600/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </header>

      <section class="mb-8 sm:mb-10">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-zinc-900">
              Inclusion criteria
            </h2>
            <p class="mt-1 max-w-2xl text-sm text-zinc-600">
              Registry rules applied on top of the audience. Edit the list to change them.
            </p>
          </div>
          <span
            v-if="hasListCriteria"
            class="inline-flex w-fit items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold tabular-nums text-zinc-700 ring-1 ring-zinc-200/80"
          >
            {{ criteriaRuleCount }} {{ criteriaRuleCount === 1 ? 'rule' : 'rules' }}
          </span>
        </div>
        <div
          v-if="!hasListCriteria"
          class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300/90 bg-gradient-to-b from-zinc-50/50 to-white px-6 py-10 text-center shadow-sm sm:flex-row sm:items-center sm:gap-5 sm:py-9 sm:text-left"
        >
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-zinc-200/80">
            <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <p class="text-base font-semibold text-zinc-900">
              Audience only
            </p>
            <p class="mt-1 max-w-md text-sm leading-relaxed text-zinc-600">
              No extra filters — everyone in this audience can be included (subject to campaign rules).
            </p>
          </div>
        </div>
        <div
          v-else
          class="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-100/80 sm:p-5"
          role="group"
          aria-label="List filter criteria"
        >
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Active filters
          </p>
          <div class="flex min-h-[3rem] min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
            <template v-for="(seg, i) in criteriaSegments" :key="i">
              <span
                v-if="seg.kind === 'criterion'"
                class="inline-flex max-w-full items-center gap-2 rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50/80 to-white px-3 py-2 text-sm shadow-sm ring-1 ring-zinc-100/60"
              >
                <span class="shrink-0 text-xs font-semibold tracking-wide text-zinc-500">{{ recipientCriterionPropertyLabel(seg.property) }}</span>
                <span class="shrink-0 rounded-md bg-zinc-900/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">equals</span>
                <span class="min-w-0 break-words font-semibold text-zinc-900">{{ seg.value }}</span>
              </span>
              <span
                v-else
                class="inline-flex shrink-0 items-center justify-center rounded-lg bg-violet-100 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-violet-900 ring-1 ring-violet-200/90"
              >
                {{ seg.op }}
              </span>
            </template>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-zinc-900">
              Recipients
            </h2>
            <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80">
                {{ payload.members.total.toLocaleString() }}
                {{ payload.members.total === 1 ? 'contact' : 'contacts' }}
              </span>
              <span class="text-zinc-400">·</span>
              <span class="text-zinc-500">Matching this list right now</span>
            </p>
          </div>
          <p
            v-if="pageLoading"
            class="inline-flex items-center gap-2 text-sm font-medium text-violet-700"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Loading…
          </p>
        </div>

        <div
          v-if="!payload.members.total"
          class="rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/30 px-6 py-14 text-center shadow-sm"
        >
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200/80">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-zinc-900">
            No matching contacts
          </p>
          <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-600">
            Adjust filters or audience, or wait if sync is still in progress.
          </p>
        </div>

        <div
          v-else
          class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md shadow-zinc-950/[0.06] ring-1 ring-zinc-100/80"
        >
          <ul class="divide-y divide-zinc-100 lg:hidden">
            <li v-for="m in payload.members.items" :key="`mobile-${m.id}`" class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-zinc-900">
                    {{ m.name }}
                  </p>
                  <p class="mt-0.5 truncate text-xs text-zinc-600" :title="m.email">
                    {{ m.email }}
                  </p>
                </div>
                <div class="flex shrink-0 flex-col items-stretch gap-1.5">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                    @click="viewMember(m.id)"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                    @click="editMember(m.id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg border border-red-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
                    @click="openRemoveMember(m)"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div v-if="m.contactType?.length" class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="t in m.contactType"
                  :key="`${m.id}-mobile-${t}`"
                  class="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-800 ring-1 ring-zinc-200/80"
                >
                  {{ t }}
                </span>
              </div>
              <p v-if="m.company" class="mt-2 truncate text-xs text-zinc-500" :title="m.company">
                {{ m.company }}
              </p>
              <p
                v-if="formatAddress(m.address) !== '—'"
                class="mt-1 line-clamp-2 text-xs text-zinc-500"
                :title="formatAddress(m.address)"
              >
                {{ formatAddress(m.address) }}
              </p>
            </li>
          </ul>

          <div class="hidden overflow-x-auto lg:block">
            <table class="min-w-full text-left text-sm">
              <thead>
                <tr class="border-b border-zinc-200 bg-zinc-50/90">
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Name
                  </th>
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Email
                  </th>
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Kind
                  </th>
                  <th scope="col" class="hidden whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:table-cell sm:px-6">
                    Company
                  </th>
                  <th scope="col" class="hidden whitespace-nowrap px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500 lg:table-cell lg:px-6">
                    Location
                  </th>
                  <th scope="col" class="whitespace-nowrap px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-500 sm:px-6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-100">
                <tr
                  v-for="m in payload.members.items"
                  :key="m.id"
                  class="bg-white transition-colors hover:bg-violet-50/30"
                >
                  <td class="whitespace-nowrap px-4 py-3.5 font-semibold text-zinc-900 sm:px-6">
                    {{ m.name }}
                  </td>
                  <td class="max-w-[14rem] truncate px-4 py-3.5 text-zinc-700 sm:max-w-xs sm:px-6" :title="m.email">
                    {{ m.email }}
                  </td>
                  <td class="max-w-[12rem] px-4 py-3.5 sm:px-6">
                    <div v-if="m.contactType?.length" class="flex flex-wrap gap-1">
                      <span
                        v-for="t in m.contactType"
                        :key="`${m.id}-${t}`"
                        class="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-800 ring-1 ring-zinc-200/80"
                      >
                        {{ t }}
                      </span>
                    </div>
                    <span
                      v-else
                      class="text-xs text-zinc-400"
                    >
                      —
                    </span>
                  </td>
                  <td class="hidden max-w-[10rem] truncate px-4 py-3.5 text-zinc-700 sm:table-cell sm:max-w-[12rem] sm:px-6" :title="m.company || undefined">
                    {{ m.company || '—' }}
                  </td>
                  <td class="hidden max-w-[12rem] truncate px-4 py-3.5 text-zinc-700 lg:table-cell lg:max-w-[16rem] lg:px-6" :title="formatAddress(m.address)">
                    {{ formatAddress(m.address) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-right sm:px-6">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                        @click="viewMember(m.id)"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                        @click="editMember(m.id)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center rounded-lg border border-red-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
                        @click="openRemoveMember(m)"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="payload.members.totalPages > 1"
            class="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4"
          >
            <p class="min-w-0 text-xs tabular-nums text-zinc-600 sm:text-sm">
              <span class="font-semibold text-zinc-900">{{ payload.members.page }}</span>
              <span class="text-zinc-300"> / </span>
              <span>{{ payload.members.totalPages }}</span>
              <span class="hidden text-zinc-400 sm:inline"> · {{ payload.members.pageSize }}/page</span>
            </p>
            <nav class="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Recipients pagination">
              <button
                type="button"
                class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                :disabled="page <= 1 || pageLoading"
                @click="goPage(page - 1)"
              >
                <span class="sm:hidden">Prev</span>
                <span class="hidden sm:inline">Previous</span>
              </button>
              <span class="whitespace-nowrap px-1 text-xs font-medium tabular-nums text-zinc-500 sm:hidden">
                {{ page }}/{{ payload.members.totalPages }}
              </span>
              <button
                type="button"
                class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                :disabled="page >= payload.members.totalPages || pageLoading"
                @click="goPage(page + 1)"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </section>
    </template>

    <ClientConfirmationModal
      :open="deleteConfirmOpen"
      title="Delete recipient list"
      :message="deleteDetailMessage"
      confirm-text="Delete list"
      variant="danger"
      @confirm="confirmDeleteDetail"
      @cancel="deleteConfirmOpen = false"
    />
    <ClientConfirmationModal
      :open="removeMemberOpen"
      title="Remove from list"
      :message="removeMemberMessage"
      confirm-text="Remove from list"
      variant="danger"
      @confirm="confirmRemoveMember"
      @cancel="cancelRemoveMember"
    />

    <Teleport to="body">
      <div
        v-if="viewMemberOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipient-member-detail-title"
      >
        <div
          class="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="closeViewMember"
        />
        <div
          class="relative flex max-h-[min(92dvh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/25 ring-1 ring-zinc-900/[0.04] sm:rounded-2xl"
        >
          <div class="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <span class="h-1 w-10 rounded-full bg-zinc-200" />
          </div>

          <div
            v-if="viewMemberLoading"
            class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-zinc-500">
              Loading contact…
            </p>
          </div>

          <template v-else-if="viewMemberError">
            <div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <p class="max-w-sm text-sm text-red-700" role="alert">
                {{ viewMemberError }}
              </p>
              <button
                type="button"
                class="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                @click="closeViewMember"
              >
                Close
              </button>
            </div>
          </template>

          <template v-else-if="viewMemberDetail">
            <div class="shrink-0 border-b border-zinc-100 bg-gradient-to-br from-zinc-50 via-white to-violet-50/40 px-4 py-5 sm:px-6">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-4">
                  <div
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 to-violet-700 text-lg font-semibold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {{ viewMemberInitials }}
                  </div>
                  <div class="min-w-0 pt-0.5">
                    <h2
                      id="recipient-member-detail-title"
                      class="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
                    >
                      {{ viewMemberDetail.name || 'Contact details' }}
                    </h2>
                    <p v-if="viewMemberDetail.company" class="mt-1 truncate text-sm text-zinc-500">
                      {{ viewMemberDetail.company }}
                    </p>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset"
                        :class="viewMemberDetail.is_unsubscribe
                          ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
                          : 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'"
                      >
                        {{ viewMemberDetail.is_unsubscribe ? 'Unsubscribed' : 'Subscribed' }}
                      </span>
                      <span
                        v-for="(label, idx) in viewMemberDetail.contactTypeLabels"
                        :key="`${viewMemberDetail.id}-type-${idx}`"
                        class="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-zinc-800 ring-1 ring-inset ring-zinc-200/80"
                      >
                        {{ label }}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-600 transition hover:bg-white hover:text-zinc-900"
                  aria-label="Close contact details"
                  @click="closeViewMember"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="mt-5 grid gap-2 sm:grid-cols-2">
                <a
                  v-if="viewMemberDetail.email"
                  :href="`mailto:${viewMemberDetail.email}`"
                  class="group flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-3 shadow-sm transition hover:border-violet-200 hover:bg-white"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Email</span>
                    <span class="block truncate text-sm font-medium text-zinc-900 group-hover:text-violet-700">{{ viewMemberDetail.email }}</span>
                  </span>
                </a>
                <a
                  v-if="viewMemberDetail.phone"
                  :href="`tel:${viewMemberDetail.phone}`"
                  class="group flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/80 px-3.5 py-3 shadow-sm transition hover:border-violet-200 hover:bg-white"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Phone</span>
                    <span class="block truncate text-sm font-medium text-zinc-900 group-hover:text-violet-700">{{ formatUsPhoneNumber(viewMemberDetail.phone) }}</span>
                  </span>
                </a>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div class="space-y-4">
                <section class="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 sm:p-5">
                  <h3 class="text-sm font-semibold text-zinc-900">
                    Details
                  </h3>
                  <dl class="mt-4 grid gap-4 sm:grid-cols-2">
                    <div v-if="hasDetailValue(viewMemberDetail.status)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Status</dt>
                      <dd class="mt-1 text-sm font-medium text-zinc-900">{{ viewMemberDetail.status }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewMemberDetail.stage)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Stage</dt>
                      <dd class="mt-1 text-sm font-medium text-zinc-900">{{ viewMemberDetail.stage }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewMemberDetail.channel)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Channel</dt>
                      <dd class="mt-1 text-sm font-medium text-zinc-900">{{ viewMemberDetail.channel }}</dd>
                    </div>
                    <div v-if="hasDetailValue(viewMemberDetail.source)">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Source</dt>
                      <dd class="mt-1 text-sm font-medium text-zinc-900">{{ viewMemberDetail.source }}</dd>
                    </div>
                  </dl>
                </section>

                <section class="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5">
                  <h3 class="text-sm font-semibold text-zinc-900">
                    Address
                  </h3>
                  <p v-if="viewMemberAddress" class="mt-3 text-sm leading-relaxed text-zinc-700">
                    {{ viewMemberAddress }}
                  </p>
                  <p v-else class="mt-3 text-sm text-zinc-400">
                    No address on file
                  </p>
                </section>

                <section
                  v-if="viewMemberDetail.createdAt || viewMemberDetail.updatedAt"
                  class="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/40 px-4 py-3 sm:px-5"
                >
                  <dl class="grid gap-3 sm:grid-cols-2">
                    <div v-if="viewMemberDetail.createdAt">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Created</dt>
                      <dd class="mt-1 text-xs font-medium text-zinc-600">{{ formatDate(viewMemberDetail.createdAt) }}</dd>
                    </div>
                    <div v-if="viewMemberDetail.updatedAt">
                      <dt class="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-zinc-400">Updated</dt>
                      <dd class="mt-1 text-xs font-medium text-zinc-600">{{ formatDate(viewMemberDetail.updatedAt) }}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>

            <div class="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:order-2 sm:w-auto"
                @click="editFromViewMember"
              >
                Edit contact
              </button>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:order-1 sm:w-auto"
                @click="closeViewMember"
              >
                Close
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <TenantContactEditModal
      :open="editMemberOpen"
      :contact-id="editMemberContactId"
      @close="closeEditMember"
      @saved="onMemberSaved"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TenantContactDetail,
  TenantRecipientListDetailPayload,
  TenantRecipientListMemberRow
} from '~/types/tenantContact'
import { formatContactAddress, normalizeContactCounty } from '~~/shared/utils/contactAddress'
import { formatUsPhoneNumber } from '~~/shared/utils/usNumberFormatter'
import { recipientCriterionPropertyLabel } from '~/utils/recipientFilterDisplay'

definePageMeta({ layout: 'default' })

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

const route = useRoute()
const marketingApi = useTenantMarketingApi()
const toast = useAppToast()
const listId = computed(() => String(route.params.id ?? ''))

const pending = ref(true)
const pageLoading = ref(false)
const loadError = ref('')
const payload = ref<TenantRecipientListDetailPayload | null>(null)
const page = ref(1)
const deleteConfirmOpen = ref(false)
const deleteDetailPending = ref(false)

const removeMemberOpen = ref(false)
const removeMemberPending = ref(false)
const memberPendingRemove = ref<TenantRecipientListMemberRow | null>(null)

const viewMemberOpen = ref(false)
const viewMemberLoading = ref(false)
const viewMemberError = ref('')
const viewMemberDetail = ref<TenantContactDetail | null>(null)
let viewMemberEscListener: ((e: KeyboardEvent) => void) | null = null

const editMemberOpen = ref(false)
const editMemberContactId = ref('')

const deleteDetailMessage = computed(() => {
  const name = payload.value?.list?.name?.trim()
  const label = name ? `“${name}”` : 'this list'
  return `Permanently delete ${label}? Campaigns that used it will have the list unlinked (they become manual audience with any saved recipients). This cannot be undone.`
})

const removeMemberMessage = computed(() => {
  const m = memberPendingRemove.value
  const label = m?.name?.trim() || m?.email?.trim() || 'this contact'
  return `Remove ${label} from this list? They will stay in Contacts, but will not be included in this list (including after sync).`
})

const viewMemberInitials = computed(() => {
  const c = viewMemberDetail.value
  if (!c) return '?'
  const first = c.firstName?.charAt(0) || c.name?.charAt(0) || ''
  const last = c.lastName?.charAt(0) || ''
  const value = `${first}${last}`.toUpperCase()
  return value || c.email?.charAt(0)?.toUpperCase() || '?'
})

const viewMemberAddress = computed(() => {
  const c = viewMemberDetail.value
  if (!c?.address) return ''
  return formatContactAddress({
    street: c.address.street,
    unit: c.address.unit,
    city: c.address.city,
    state: c.address.state,
    county: normalizeContactCounty(c.address.county)
  })
})

type CriteriaSegment =
  | { kind: 'criterion'; property: string; value: string }
  | { kind: 'op'; op: 'AND' | 'OR' }

/** Chips + AND/OR indicators for the criteria row. */
const criteriaSegments = computed((): CriteriaSegment[] => {
  const list = payload.value?.list
  if (!list) return []
  const chain = list.criteriaChain
  if (chain?.rows?.length) {
    const rows = chain.rows
    const joins = chain.joins
    const fallback: 'AND' | 'OR' = list.filterMode === 'or' ? 'OR' : 'AND'
    const out: CriteriaSegment[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      out.push({ kind: 'criterion', property: r.property, value: r.value })
      if (i < rows.length - 1) {
        const j = joins?.[i]
        const op: 'AND' | 'OR' =
          j === 'or' ? 'OR' : j === 'and' ? 'AND' : fallback
        out.push({ kind: 'op', op })
      }
    }
    return out
  }
  const filters = list.filters ?? []
  if (!filters.length) return []
  const sep: 'AND' | 'OR' = list.filterMode === 'or' ? 'OR' : 'AND'
  const out: CriteriaSegment[] = []
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i]!
    out.push({ kind: 'criterion', property: f.property, value: f.value })
    if (i < filters.length - 1) out.push({ kind: 'op', op: sep })
  }
  return out
})

const hasListCriteria = computed(() => criteriaSegments.value.length > 0)

const criteriaRuleCount = computed(
  () => criteriaSegments.value.filter((s) => s.kind === 'criterion').length
)

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

function formatAddress(addr: Record<string, unknown>): string {
  const formatted = formatContactAddress({
    street: typeof addr.street === 'string' ? addr.street : undefined,
    unit: typeof addr.unit === 'string' ? addr.unit : undefined,
    city: typeof addr.city === 'string' ? addr.city : undefined,
    state: typeof addr.state === 'string' ? addr.state : undefined,
    county: typeof addr.county === 'string' ? addr.county : undefined
  })
  return formatted || '—'
}

function hasDetailValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return String(value).trim().length > 0
}

async function viewMember(contactId: string) {
  viewMemberOpen.value = true
  viewMemberLoading.value = true
  viewMemberError.value = ''
  viewMemberDetail.value = null
  try {
    const res = await $fetch<{ contact: TenantContactDetail }>(
      `/api/v1/tenant/contacts/${encodeURIComponent(contactId)}`,
      {
        credentials: 'include',
        ...serverAuthHeaders()
      }
    )
    viewMemberDetail.value = {
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
    viewMemberError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load contact')
        : 'Failed to load contact'
  } finally {
    viewMemberLoading.value = false
  }
}

function closeViewMember() {
  viewMemberOpen.value = false
  viewMemberDetail.value = null
  viewMemberError.value = ''
}

function editFromViewMember() {
  const id = viewMemberDetail.value?.id
  closeViewMember()
  if (id) editMember(id)
}

function editMember(contactId: string) {
  editMemberContactId.value = contactId
  editMemberOpen.value = true
}

function closeEditMember() {
  editMemberOpen.value = false
  editMemberContactId.value = ''
}

function onMemberSaved(updated: {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  company: string
  channel: string
  contactType: string[]
  address: {
    street: string
    unit: string
    city: string
    state: string
    county: string
  }
}) {
  const items = payload.value?.members?.items
  if (!items?.length) return
  const idx = items.findIndex((m) => m.id === updated.id)
  if (idx < 0) return
  const existing = items[idx]!
  items[idx] = {
    ...existing,
    firstName: updated.firstName,
    lastName: updated.lastName,
    name: updated.name || existing.name,
    email: updated.email,
    phone: updated.phone,
    company: updated.company,
    channel: updated.channel,
    contactType: updated.contactType.length ? updated.contactType : existing.contactType,
    address: {
      ...existing.address,
      ...updated.address
    }
  }
}

function openRemoveMember(member: TenantRecipientListMemberRow) {
  memberPendingRemove.value = member
  removeMemberOpen.value = true
}

function cancelRemoveMember() {
  if (removeMemberPending.value) return
  removeMemberOpen.value = false
  memberPendingRemove.value = null
}

async function confirmRemoveMember() {
  const list = listId.value
  const member = memberPendingRemove.value
  if (!list || !member?.id || removeMemberPending.value) return
  removeMemberPending.value = true
  try {
    await marketingApi.removeRecipientListMember(list, member.id)
    removeMemberOpen.value = false
    memberPendingRemove.value = null
    toast.success('Contact removed from list.')
    await load(page.value)
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to remove contact')
        : 'Failed to remove contact'
    loadError.value = message
    toast.error(message)
    removeMemberOpen.value = false
  } finally {
    removeMemberPending.value = false
  }
}

async function load(p: number) {
  const id = listId.value
  if (!id) {
    loadError.value = 'Missing list id'
    pending.value = false
    return
  }
  const isInitial = !payload.value
  if (!isInitial) pageLoading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<TenantRecipientListDetailPayload>(
      `/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`,
      {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { page: p, limit: 50 }
      }
    )
    payload.value = res
    page.value = res.members.page
    // If this page is empty after a remove but earlier pages exist, step back.
    if (!res.members.items.length && res.members.page > 1 && res.members.total > 0) {
      await load(res.members.page - 1)
      return
    }
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load')
        : 'Failed to load'
    payload.value = null
  } finally {
    pending.value = false
    pageLoading.value = false
  }
}

async function goPage(p: number) {
  if (p < 1) return
  await load(p)
}

async function confirmDeleteDetail() {
  const id = listId.value
  if (!id || deleteDetailPending.value) return
  deleteDetailPending.value = true
  try {
    await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
      ...serverAuthHeaders()
    })
    deleteConfirmOpen.value = false
    clearNuxtPayloadCache(TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY)
    await navigateTo('/tenant/recipient-list')
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to delete list')
        : 'Failed to delete list'
    deleteConfirmOpen.value = false
  } finally {
    deleteDetailPending.value = false
  }
}

watch(viewMemberOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (viewMemberEscListener) {
    window.removeEventListener('keydown', viewMemberEscListener)
    viewMemberEscListener = null
  }
  if (open) {
    viewMemberEscListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewMember()
    }
    window.addEventListener('keydown', viewMemberEscListener)
  }
})

onBeforeUnmount(() => {
  if (viewMemberEscListener) {
    window.removeEventListener('keydown', viewMemberEscListener)
    viewMemberEscListener = null
  }
  if (import.meta.client) document.body.style.overflow = ''
})

watch(
  listId,
  () => {
    pending.value = true
    page.value = 1
    load(1)
  },
  { immediate: true }
)
</script>
