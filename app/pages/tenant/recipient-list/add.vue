<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <NuxtLink
      to="/tenant/recipient-list"
      class="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary-700"
    >
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm shadow-slate-900/[0.04] transition group-hover:border-primary-200 group-hover:bg-primary-50/80 group-hover:text-primary-700">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </span>
      <span class="whitespace-nowrap">Back to lists</span>
    </NuxtLink>

    <header class="space-y-1">
      <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Audience</p>
      <h1 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
        New recipient list
      </h1>
      <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
        <template v-if="isLoMode">
          Name the list, pick a loan officer, and include their borrowers.
        </template>
        <template v-else>
          Pick an audience, then optionally add filters to narrow who’s included.
        </template>
      </p>
    </header>

    <div class="space-y-6 sm:space-y-8">
      <div
        v-if="!isLoMode && data && !data.tenantIdConfigured"
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
            Tenant ID not set
          </p>
          <p class="mt-1.5 leading-relaxed text-amber-900/90">
            Your tenant has no <strong class="font-semibold">tenant ID</strong> in the registry. You can still save audience-only lists;
            admin-defined recipient filters appear once a tenant ID is set.
          </p>
        </div>
      </div>

      <div
        v-if="pageLoadError"
        class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm sm:text-[0.9375rem]"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {{ pageLoadError }}
      </div>

      <div v-if="pagePending" class="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:p-6">
        <div class="h-10 max-w-sm animate-pulse rounded-xl bg-slate-100" />
        <div class="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
        <div class="h-32 animate-pulse rounded-xl bg-slate-50" />
      </div>

      <!-- LO-scoped simple form (toggle ON) -->
      <form
        v-else-if="isLoMode"
        class="space-y-6 sm:space-y-8"
        @submit.prevent="loSubmitCreate"
      >
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          <div class="min-w-0 lg:col-span-5 xl:col-span-4">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] lg:sticky lg:top-6">
              <div class="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
                <h2 class="text-base font-semibold text-slate-900">List details</h2>
                <p class="mt-1 text-sm text-slate-500 sm:text-[0.9375rem]">
                  Name this borrower list.
                </p>
              </div>
              <div class="p-4 sm:p-6">
                <label for="rl-lo-name" class="mb-2 block text-sm font-medium text-slate-700">
                  List name
                  <span class="text-red-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="rl-lo-name"
                  v-model="loForm.name"
                  type="text"
                  required
                  aria-required="true"
                  maxlength="200"
                  placeholder="e.g. Jane Smith – Borrowers"
                  class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:text-[15px]"
                >
              </div>
            </div>
          </div>

          <div class="relative z-20 min-w-0 lg:col-span-7 xl:col-span-8">
            <div class="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6 sm:py-5">
                <h2 class="text-base font-semibold text-slate-900">Loan officer & borrowers</h2>
                <p class="mt-1 text-sm text-slate-500 sm:text-[0.9375rem]">
                  Pick a loan officer; this list includes only their borrowers.
                </p>
              </div>
              <div class="space-y-6 p-4 sm:p-6">
                <div class="space-y-2">
                  <p class="text-sm font-medium text-slate-700">
                    Loan officer email
                    <span class="text-red-600" aria-hidden="true">*</span>
                  </p>
                  <template v-if="loIsSelfOnlyAudience">
                    <p class="text-xs leading-relaxed text-slate-500 sm:text-sm">
                      This list includes only your borrowers.
                    </p>
                    <p class="rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                      <span class="font-semibold">{{ loForm.associatedLoanOfficerName || 'You' }}</span>
                      <span v-if="loForm.associatedLoanOfficerEmail" class="mt-0.5 block text-slate-600">
                        {{ loForm.associatedLoanOfficerEmail }}
                      </span>
                    </p>
                  </template>
                  <template v-else>
                    <p class="text-xs leading-relaxed text-slate-500 sm:text-sm">
                      This list includes only borrowers owned by the selected loan officer.
                    </p>
                    <CampaignSenderEmailPicker
                      v-model="loForm.associatedLoanOfficerEmail"
                      label="Loan officer"
                      @typed="loOnLoanOfficerTyped"
                      @select="loOnLoanOfficerSelect"
                    />
                    <p v-if="loForm.associatedLoanOfficerName" class="text-sm text-slate-600">
                      Associated with
                      <span class="font-semibold text-slate-900">{{ loForm.associatedLoanOfficerName }}</span>
                    </p>
                  </template>
                </div>

                <div class="space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-0">
                    <div
                      class="flex items-center gap-1"
                      role="tablist"
                      aria-label="Borrowers views"
                    >
                      <button
                        type="button"
                        role="tab"
                        class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition"
                        :class="loBorrowersTab === 'list'
                          ? 'border-primary-600 text-primary-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'"
                        :aria-selected="loBorrowersTab === 'list'"
                        @click="loSetBorrowersTab('list')"
                      >
                        Borrowers
                      </button>
                      <button
                        type="button"
                        role="tab"
                        class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition"
                        :class="loBorrowersTab === 'manual'
                          ? 'border-primary-600 text-primary-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'"
                        :aria-selected="loBorrowersTab === 'manual'"
                        @click="loSetBorrowersTab('manual')"
                      >
                        Manual Add
                      </button>
                    </div>
                    <div
                      v-if="loBorrowersTab === 'list' && loBorrowers.length"
                      class="pb-2"
                    >
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                        @click="loToggleAllBorrowers"
                      >
                        {{ loToggleAllBorrowersLabel }}
                      </button>
                    </div>
                  </div>

                  <div
                    v-if="loBorrowersTab === 'manual'"
                    role="tabpanel"
                    class="space-y-3"
                  >
                    <p class="text-sm text-slate-500">
                      Look up a borrower by email for this loan officer and include them in the list.
                    </p>
                    <div
                      v-if="!loForm.associatedLoanOfficerEmail.trim()"
                      class="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-500"
                    >
                      Select a loan officer first.
                    </div>
                    <template v-else>
                      <p class="text-xs text-slate-500">
                        Search is limited to borrowers owned by
                        <span class="font-semibold text-slate-700">
                          {{ loForm.associatedLoanOfficerName || loForm.associatedLoanOfficerEmail }}
                        </span>.
                      </p>
                      <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div class="relative min-w-0 flex-1">
                          <label for="rl-lo-manual-email" class="sr-only">Add borrower by email</label>
                          <input
                            id="rl-lo-manual-email"
                            v-model="loManualEmail"
                            type="email"
                            autocomplete="off"
                            placeholder="Search borrower email or name…"
                            class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
                            :disabled="loManualAddPending"
                            :aria-expanded="loManualSuggestionsOpen"
                            aria-autocomplete="list"
                            aria-controls="rl-lo-manual-suggestions"
                            @input="loOnManualEmailInput"
                            @focus="loOnManualEmailFocus"
                            @blur="loCloseManualSuggestions"
                            @keydown.enter.prevent="loAddBorrowerByEmail"
                            @keydown.escape="loCloseManualSuggestions"
                          >
                          <ul
                            v-if="loManualSuggestionsOpen && (loManualSuggestions.length || loManualSuggestionsLoading || loManualEmail.trim().length >= 2)"
                            id="rl-lo-manual-suggestions"
                            role="listbox"
                            class="absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
                          >
                            <li
                              v-if="loManualSuggestionsLoading"
                              class="px-3 py-2.5 text-sm text-slate-500"
                            >
                              Searching this LO’s borrowers…
                            </li>
                            <template v-else-if="loManualSuggestions.length">
                              <li
                                v-for="s in loManualSuggestions"
                                :key="s.id"
                                role="option"
                                class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-primary-50"
                                @mousedown.prevent="loSelectManualSuggestion(s)"
                              >
                                <span class="min-w-0 truncate font-medium text-slate-900">{{ s.name }}</span>
                                <span class="shrink-0 truncate text-slate-500">{{ s.email }}</span>
                              </li>
                            </template>
                            <li
                              v-else
                              class="px-3 py-2.5 text-sm text-slate-500"
                            >
                              No borrowers match for this loan officer.
                            </li>
                          </ul>
                        </div>
                        <button
                          type="button"
                          class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="loManualAddPending || !loManualEmail.trim()"
                          @click="loAddBorrowerByEmail"
                        >
                          {{ loManualAddPending ? 'Adding…' : 'Add' }}
                        </button>
                      </div>
                      <p
                        v-if="loManualAddError"
                        class="text-sm text-red-700"
                        role="alert"
                      >
                        {{ loManualAddError }}
                      </p>
                    </template>
                  </div>

                  <div
                    v-else
                    role="tabpanel"
                    class="space-y-3"
                  >
                    <div
                      v-if="loBorrowersLoading"
                      class="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-500"
                    >
                      Loading borrowers…
                    </div>
                    <div
                      v-else-if="loBorrowersError"
                      class="rounded-xl border border-red-200/90 bg-red-50 px-4 py-4 text-sm text-red-800"
                    >
                      {{ loBorrowersError }}
                    </div>
                    <div
                      v-else-if="!loForm.associatedLoanOfficerEmail.trim()"
                      class="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-500"
                    >
                      Select a loan officer to see their borrowers.
                    </div>
                    <div
                      v-else-if="!loBorrowers.length"
                      class="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-500"
                    >
                      No borrowers found for this loan officer. Use Manual Add to look one up by email.
                    </div>
                    <ul
                      v-else
                      class="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/80"
                    >
                      <li
                        v-for="b in loBorrowers"
                        :key="b.id"
                        class="flex items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <input
                          :id="`rl-lo-borrower-${b.id}`"
                          type="checkbox"
                          class="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                          :checked="loBorrowerChecked[b.id] !== false"
                          @change="loSetBorrowerChecked(b.id, ($event.target as HTMLInputElement).checked)"
                        >
                        <label
                          :for="`rl-lo-borrower-${b.id}`"
                          class="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3"
                        >
                          <span class="min-w-0 truncate font-medium text-slate-900">{{ b.name }}</span>
                          <span class="shrink-0 truncate text-slate-500">{{ b.email }}</span>
                        </label>
                      </li>
                    </ul>
                    <p
                      v-if="loBorrowerTotal > loBorrowers.length"
                      class="text-xs text-slate-500"
                    >
                      Showing {{ loBorrowers.length }} of {{ loBorrowerTotal }} borrowers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="loSaveError"
          class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-sm"
          role="alert"
        >
          {{ loSaveError }}
        </div>

        <TenantRecipientListFormActions
          :reasons="loSubmitBlockReasons"
          hint-heading="Complete the following to create the list:"
          submit-label="Create list"
          cancel-to="/tenant/recipient-list"
          :can-submit="loCanSubmitForm"
          :saving="loSaving"
        />
      </form>

      <!-- Classic form (toggle OFF) -->
      <form
        v-else-if="data"
        class="space-y-6 sm:space-y-8"
        @submit.prevent="submitCreate"
      >
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
          <div class="min-w-0 lg:col-span-5 xl:col-span-4">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] lg:sticky lg:top-6">
              <div class="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
                <h2 class="text-base font-semibold text-slate-900">
                  List details
                </h2>
                <p class="mt-1 text-sm text-slate-500 sm:text-[0.9375rem]">
                  Name and contact type define the base set of contacts.
                </p>
              </div>
              <div class="space-y-5 p-4 sm:space-y-6 sm:p-6">
                <div>
                  <label for="rl-name" class="mb-2 block text-sm font-medium text-slate-700">
                    List name
                    <span class="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rl-name"
                    v-model="form.name"
                    type="text"
                    required
                    aria-required="true"
                    maxlength="200"
                    placeholder="e.g. Texas prospects"
                    class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:text-[15px]"
                  >
                </div>

                <div>
                  <label for="rl-audience" class="mb-2 block text-sm font-medium text-slate-700">Contact type</label>
                  <p class="mb-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    Prospect, client, and contact appear when enabled under tenant contact types. Optional recipient filters (Admin) add rules below for each type.
                  </p>
                  <TenantFilterSelect
                    id="rl-audience"
                    v-model="form.audience"
                    label="Contact type"
                    variant="field"
                    :options="audienceFieldSelectOptions"
                    :disabled="!audienceOptions.length"
                    :aria-describedby="data.tenantIdConfigured && !audienceOptions.length ? 'rl-audience-hint' : undefined"
                  />
                  <p
                    v-if="data.tenantIdConfigured && !audienceOptions.length"
                    id="rl-audience-hint"
                    class="mt-2 text-sm text-slate-500"
                  >
                    Add at least one enabled contact type under tenant contact types (Admin), or add a recipient filter scoped to a contact type.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="min-w-0 lg:col-span-7 xl:col-span-8">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-6 sm:py-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                  <div class="min-w-0">
                    <h2 class="text-base font-semibold text-slate-900">
                      Audience filters
                    </h2>
                    <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                      Conditions inside a group stay together. And between groups means both groups. Or means either group.
                    </p>
                  </div>
                </div>
              </div>
              <div class="space-y-5 p-4 sm:p-6">
                <TenantRecipientListPreview :preview="filterPreview" />
                <p
                  v-if="data.tenantIdConfigured && !filtersForAudience.length"
                  class="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm leading-relaxed text-slate-600 sm:px-5"
                >
                  No filters are set up for this audience yet. Ask an admin to add recipient filters, or create the list using the audience only.
                </p>

                <template v-for="(group, gIdx) in form.filterGroups" :key="gIdx">
                <div
                  v-if="gIdx > 0"
                  class="flex items-center gap-3"
                  role="group"
                  :aria-label="`How to combine group ${gIdx} with group ${gIdx + 1}`"
                >
                  <div class="h-px flex-1 bg-slate-300" aria-hidden="true" />
                  <div
                    class="flex items-center gap-2 rounded-full border bg-white py-1 pl-3 pr-1 shadow-sm"
                    :class="form.groupJoins[gIdx - 1] === 'and' || form.groupJoins[gIdx - 1] === 'or' ? 'border-slate-200' : 'border-amber-300 ring-2 ring-amber-100'"
                  >
                    <span class="text-xs font-medium text-slate-500">{{ form.groupJoins[gIdx - 1] === 'or' ? 'Either group' : form.groupJoins[gIdx - 1] === 'and' ? 'Both groups' : 'Choose' }}</span>
                    <div class="flex rounded-full bg-slate-100 p-0.5" role="radiogroup" aria-label="Combine groups">
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs font-semibold"
                        :class="form.groupJoins[gIdx - 1] === 'and' ? 'bg-slate-900 text-white' : 'text-slate-600'"
                        @click="form.groupJoins[gIdx - 1] = 'and'"
                      >
                        And
                      </button>
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs font-semibold"
                        :class="form.groupJoins[gIdx - 1] === 'or' ? 'bg-amber-500 text-white' : 'text-slate-600'"
                        @click="form.groupJoins[gIdx - 1] = 'or'"
                      >
                        Or
                      </button>
                    </div>
                  </div>
                  <div class="h-px flex-1 bg-slate-300" aria-hidden="true" />
                </div>
                <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white tabular-nums">{{ gIdx + 1 }}</span>
                      <p class="text-sm font-semibold text-slate-900">Group {{ gIdx + 1 }}</p>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-semibold text-red-700 hover:underline"
                      @click="removeFilterGroup(gIdx)"
                    >
                      Remove group
                    </button>
                  </div>
                <div
                  v-for="(row, idx) in group.rows"
                  :key="idx"
                  class="relative"
                >
                  <div
                    v-if="showCombineBeforeFormRow(group, idx)"
                    class="flex items-center gap-3 py-3"
                    role="group"
                    :aria-label="`How to combine condition ${conditionNumber(gIdx, idx - 1)} with condition ${conditionNumber(gIdx, idx)}`"
                  >
                    <div class="h-px flex-1 bg-slate-200" aria-hidden="true" />
                    <div
                      class="flex shrink-0 rounded-full border bg-white p-0.5 shadow-sm"
                      :class="group.joins[joinSlotBeforeFormRow(group, idx)] === 'and' || group.joins[joinSlotBeforeFormRow(group, idx)] === 'or' ? 'border-slate-200' : 'border-amber-300 ring-2 ring-amber-100'"
                      role="radiogroup"
                      aria-label="Combine these conditions"
                    >
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs font-semibold"
                        :class="group.joins[joinSlotBeforeFormRow(group, idx)] === 'and' ? 'bg-slate-900 text-white' : 'text-slate-500'"
                        @click="group.joins[joinSlotBeforeFormRow(group, idx)] = 'and'"
                      >
                        And
                      </button>
                      <button
                        type="button"
                        class="rounded-full px-3 py-1 text-xs font-semibold"
                        :class="group.joins[joinSlotBeforeFormRow(group, idx)] === 'or' ? 'bg-amber-500 text-white' : 'text-slate-500'"
                        @click="group.joins[joinSlotBeforeFormRow(group, idx)] = 'or'"
                      >
                        Or
                      </button>
                    </div>
                    <div class="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  </div>

                  <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
                    <div class="flex items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-3 sm:items-center sm:gap-3 sm:px-5 sm:py-3.5">
                      <div class="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-[11px] font-bold text-white shadow-sm shadow-primary-600/25 tabular-nums sm:h-9 sm:w-9 sm:text-xs">
                          {{ conditionNumber(gIdx, idx) }}
                        </span>
                        <div class="min-w-0">
                          <p class="text-sm font-semibold text-slate-900">
                            Condition {{ conditionNumber(gIdx, idx) }}
                          </p>
                          <p class="truncate text-xs text-slate-500 sm:whitespace-normal sm:overflow-visible">
                            {{ conditionSummary(row) }}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-transparent p-2 text-xs font-semibold text-red-700 transition-colors hover:border-red-200/90 hover:bg-red-50 sm:px-3 sm:py-2 sm:text-sm"
                        :aria-label="`Remove condition ${idx + 1}`"
                        @click="removeFilterRow(gIdx, idx)"
                      >
                        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span class="hidden sm:inline">Remove</span>
                      </button>
                    </div>

                    <div class="p-3 sm:p-5">
                      <template v-if="!row.recipientFilterId">
                        <div class="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3 sm:px-4">
                          <label :for="`rl-filter-${gIdx}-${idx}`" class="mb-2 block text-xs font-semibold uppercase tracking-wide text-sky-800">Field</label>
                          <TenantFilterSelect
                            :id="`rl-filter-${gIdx}-${idx}`"
                            v-model="row.recipientFilterId"
                            label="Field"
                            variant="field"
                            :options="recipientFilterSelectOptions(idx)"
                            @change="onRowFilterChange(row)"
                          />
                        </div>
                      </template>

                      <div
                        v-else
                        class="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end sm:gap-3"
                      >
                          <div class="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-3 sm:col-span-5">
                            <label :for="`rl-filter-${gIdx}-${idx}`" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-sky-800">Field</label>
                            <TenantFilterSelect
                              :id="`rl-filter-${gIdx}-${idx}`"
                              v-model="row.recipientFilterId"
                              label="Field"
                              variant="field"
                              :options="recipientFilterSelectOptions(idx)"
                              @change="onRowFilterChange(row)"
                            />
                          </div>
                          <div class="flex items-center justify-start sm:col-span-2 sm:justify-center sm:pb-2">
                            <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" title="must equal">
                              <span aria-hidden="true">=</span>
                              <span>equals</span>
                            </span>
                          </div>
                          <div class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 sm:col-span-5">
                            <label :for="`rl-list-property-value-${gIdx}-${idx}`" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-emerald-800">Value</label>
                            <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                              <TenantFilterSelect
                                :id="`rl-list-property-value-${gIdx}-${idx}`"
                                v-model="row.listPropertyValue"
                                label="Value"
                                variant="field"
                                :options="registryValueSelectOptions(row)"
                              />
                            </template>
                            <p
                              v-else-if="showPropertyRowFor(row) && rowRegistryTokens(row).length === 1"
                              class="break-words rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:text-[15px]"
                            >
                              {{ rowRegistryValueDisplay(row) }}
                            </p>
                            <input
                              v-else-if="showPropertyRowFor(row)"
                              :id="`rl-list-property-value-${gIdx}-${idx}`"
                              v-model="row.listPropertyValue"
                              type="text"
                              required
                              maxlength="2000"
                              class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:text-[15px]"
                              :placeholder="propertyValuePlaceholderFor(row)"
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                <button
                  v-if="filtersForAudience.length && canAddFilter"
                  type="button"
                  class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary-300 hover:bg-white hover:text-primary-800"
                  @click="addFilterRow(gIdx)"
                >
                  Add a condition to this group
                </button>
                </div>
                </template>

                <button
                  v-if="filtersForAudience.length && canAddFilter"
                  type="button"
                  class="group flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-3 py-3.5 text-sm font-semibold text-slate-800 transition-colors hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-950 sm:gap-3 sm:px-4 sm:py-4 sm:text-[15px]"
                  @click="form.filterGroups.length ? addFilterGroup() : addFilterRow()"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-primary-600 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors group-hover:border-primary-200 group-hover:bg-primary-50 group-hover:text-primary-700 sm:h-10 sm:w-10">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  <span class="min-w-0 text-left">
                    <span class="block">{{ form.filterGroups.length ? 'Add another group' : 'Add a filter condition' }}</span>
                    <span class="mt-0.5 hidden text-xs font-normal text-slate-500 group-hover:text-primary-800/90 min-[400px]:block">A group is the part inside the parentheses, like (1 or 2)</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="saveError"
          class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-sm"
          role="alert"
        >
          {{ saveError }}
        </div>

        <TenantRecipientListFormActions
          :reasons="submitBlockReasons"
          hint-heading="Complete the following to create the list:"
          submit-label="Create list"
          cancel-to="/tenant/recipient-list"
          :can-submit="canSubmitForm"
          :saving="saving"
        />
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

const {
  allowTenantLoRecipientLists,
  loadDefaultCampaignSender,
  loaded: flagLoaded
} = useDefaultCampaignSender()
void loadDefaultCampaignSender()

const isLoMode = computed(() => flagLoaded.value && allowTenantLoRecipientLists.value === true)

const {
  loadPending: loLoadPending,
  loadError: loLoadError,
  saveError: loSaveError,
  saving: loSaving,
  form: loForm,
  borrowers: loBorrowers,
  borrowerTotal: loBorrowerTotal,
  borrowersLoading: loBorrowersLoading,
  borrowersError: loBorrowersError,
  borrowerChecked: loBorrowerChecked,
  setBorrowerChecked: loSetBorrowerChecked,
  toggleAllBorrowers: loToggleAllBorrowers,
  toggleAllBorrowersLabel: loToggleAllBorrowersLabel,
  manualEmail: loManualEmail,
  manualAddError: loManualAddError,
  manualAddPending: loManualAddPending,
  manualSuggestions: loManualSuggestions,
  manualSuggestionsOpen: loManualSuggestionsOpen,
  manualSuggestionsLoading: loManualSuggestionsLoading,
  onManualEmailInput: loOnManualEmailInput,
  onManualEmailFocus: loOnManualEmailFocus,
  closeManualSuggestions: loCloseManualSuggestions,
  selectManualSuggestion: loSelectManualSuggestion,
  borrowersTab: loBorrowersTab,
  setBorrowersTab: loSetBorrowersTab,
  addBorrowerByEmail: loAddBorrowerByEmail,
  submitBlockReasons: loSubmitBlockReasons,
  canSubmitForm: loCanSubmitForm,
  onLoanOfficerSelect: loOnLoanOfficerSelect,
  onLoanOfficerTyped: loOnLoanOfficerTyped,
  isSelfOnlyAudience: loIsSelfOnlyAudience,
  submitCreate: loSubmitCreate
} = useLoRecipientListSimpleForm({ mode: 'create' })

const {
  loadPending,
  loadError,
  saveError,
  saving,
  data,
  form,
  audienceOptions,
  audienceFieldSelectOptions,
  filtersForAudience,
  canAddFilter,
  showPropertyRowFor,
  rowRegistryTokens,
  propertyValuePlaceholderFor,
  showCombineBeforeFormRow,
  joinSlotBeforeFormRow,
  conditionNumber,
  conditionSummary,
  filterPreview,
  addFilterGroup,
  removeFilterGroup,
  canSubmitForm,
  submitBlockReasons,
  recipientFilterSelectOptions,
  registryValueSelectOptions,
  onRowFilterChange,
  addFilterRow,
  removeFilterRow,
  rowRegistryValueDisplay,
  submitCreate
} = useRecipientListForm({ mode: 'create' })

const pagePending = computed(() => {
  if (!flagLoaded.value) return true
  if (isLoMode.value) return loLoadPending.value
  return loadPending.value
})

const pageLoadError = computed(() => {
  if (isLoMode.value) return loLoadError.value
  return loadError.value
})
</script>
