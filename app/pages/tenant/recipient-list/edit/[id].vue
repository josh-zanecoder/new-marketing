<template>
  <div class="w-full min-w-0 antialiased">
      <NuxtLink
        :to="`/tenant/recipient-list/${listId}`"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-700"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm shadow-slate-900/[0.04] transition group-hover:border-indigo-200 group-hover:bg-indigo-50/80 group-hover:text-indigo-700">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        Back to list
      </NuxtLink>

      <header class="mb-8 sm:mb-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Edit recipient list
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
          Update name, audience, or registry filters. Saving refreshes who’s on the list.
        </p>
      </header>

      <div class="space-y-8">
      <div
        v-if="data && !data.tenantIdConfigured"
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
        v-if="loadError"
        class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm sm:text-[0.9375rem]"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {{ loadError }}
      </div>

      <div v-if="loadPending" class="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
        <div class="h-10 max-w-sm animate-pulse rounded-xl bg-slate-100" />
        <div class="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
        <div class="h-32 animate-pulse rounded-xl bg-slate-50" />
      </div>

      <form
        v-else-if="data"
        class="space-y-8"
        @submit.prevent="submitUpdate"
      >
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <!-- List details: left on wide screens -->
          <div class="min-w-0 lg:col-span-5 xl:col-span-4">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] lg:sticky lg:top-6">
              <div class="border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                <h2 class="text-base font-semibold text-slate-900">
                  List details
                </h2>
                <p class="mt-1 text-sm text-slate-500 sm:text-[0.9375rem]">
                  Name and audience define the base set of contacts.
                </p>
              </div>
              <div class="space-y-6 p-5 sm:p-6">
                <div>
                  <label for="rl-name" class="mb-2 block text-sm font-medium text-slate-700">List name</label>
                  <input
                    id="rl-name"
                    v-model="form.name"
                    type="text"
                    required
                    maxlength="200"
                    placeholder="e.g. Texas prospects"
                    class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
                  >
                </div>

                <div>
                  <label for="rl-audience" class="mb-2 block text-sm font-medium text-slate-700">Audience</label>
                  <select
                    id="rl-audience"
                    v-model="form.audience"
                    class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-[15px]"
                    :disabled="!audienceOptions.length"
                    required
                  >
                    <option v-if="!audienceOptions.length" disabled value="">
                      No audiences from filters
                    </option>
                    <option
                      v-for="opt in audienceOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                  <p
                    v-if="data.tenantIdConfigured && !audienceOptions.length"
                    class="mt-2 text-sm text-slate-500"
                  >
                    Add at least one recipient filter in admin (per contact type) to choose an audience here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Audience filters: right on wide screens -->
          <div class="min-w-0 lg:col-span-7 xl:col-span-8">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="border-b border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 class="text-base font-semibold text-slate-900">
                      Audience filters
                    </h2>
                    <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                      Narrow the list with registry rules. Skip this to include everyone in the audience.
                    </p>
                  </div>
                  <div
                    v-if="form.filterRows.length > 1"
                    class="mt-1 inline-flex shrink-0 items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1.5 text-xs font-semibold text-sky-950 shadow-sm shadow-sky-900/[0.04] ring-1 ring-sky-100/60"
                    role="status"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                    {{ form.filterRows.length }} conditions — use <span class="font-semibold">And / Or</span> between them
                  </div>
                </div>
              </div>
              <div class="space-y-8 p-5 sm:p-6">
            <p
              v-if="data.tenantIdConfigured && !filtersForAudience.length"
              class="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm leading-relaxed text-slate-600 sm:px-5"
            >
              No filters are set up for this audience yet. Ask an admin to add recipient filters, or save with audience only.
            </p>

            <div
              v-for="(row, idx) in form.filterRows"
              :key="idx"
              class="relative"
            >
              <div
                v-if="showCombineBeforeFormRow(idx)"
                class="relative mb-6 flex flex-col items-center gap-3"
                role="group"
                :aria-label="`How to combine condition ${idx} with condition ${idx + 1}`"
              >
                <div class="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-slate-200 via-indigo-200/60 to-slate-200 sm:block sm:-top-4 sm:h-[calc(100%+1rem)]" aria-hidden="true" />
                <div class="relative z-[1] w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:p-5">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex items-start gap-3">
                      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100/80" aria-hidden="true">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </span>
                      <div>
                        <p class="text-sm font-semibold text-slate-900">
                          Connect to the next rule
                        </p>
                        <p class="mt-0.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                          <strong class="font-medium text-slate-800">And</strong> means every rule must pass.
                          <strong class="font-medium text-slate-800">Or</strong> means at least one can pass.
                        </p>
                      </div>
                    </div>
                    <div
                      class="flex w-full shrink-0 rounded-xl border border-slate-200/90 bg-slate-100/70 p-1 sm:w-auto"
                      role="radiogroup"
                      aria-label="Combine filters"
                    >
                      <button
                        type="button"
                        class="min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors sm:min-w-[7.5rem] sm:px-4 sm:text-sm"
                        :class="form.criterionJoins[joinSlotBeforeFormRow(idx)] === 'and'
                          ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-indigo-200/80'
                          : 'text-slate-600 hover:text-slate-900'"
                        @click="form.criterionJoins[joinSlotBeforeFormRow(idx)] = 'and'"
                      >
                        And
                        <span class="mt-0.5 block text-[10px] font-normal text-slate-500 sm:text-xs">all match</span>
                      </button>
                      <button
                        type="button"
                        class="min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors sm:min-w-[7.5rem] sm:px-4 sm:text-sm"
                        :class="form.criterionJoins[joinSlotBeforeFormRow(idx)] === 'or'
                          ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-indigo-200/80'
                          : 'text-slate-600 hover:text-slate-900'"
                        @click="form.criterionJoins[joinSlotBeforeFormRow(idx)] = 'or'"
                      >
                        Or
                        <span class="mt-0.5 block text-[10px] font-normal text-slate-500 sm:text-xs">any match</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:px-5">
                  <div class="flex items-center gap-3">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 tabular-nums">
                      {{ idx + 1 }}
                    </span>
                    <div>
                      <p class="text-sm font-semibold text-slate-900">
                        Condition {{ idx + 1 }}
                      </p>
                      <p class="text-xs text-slate-500">
                        {{ row.recipientFilterId ? 'Pick a value to finish this rule' : 'Choose which registry field to filter on' }}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:border-red-200/90 hover:bg-red-50 sm:text-sm"
                    @click="removeFilterRow(idx)"
                  >
                    <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>

                <div class="p-4 sm:p-5">
                  <template v-if="!row.recipientFilterId">
                    <label :for="`rl-filter-${idx}`" class="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Registry field</label>
                    <select
                      :id="`rl-filter-${idx}`"
                      v-model="row.recipientFilterId"
                      required
                      class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
                      @change="onRowFilterChange(row)"
                    >
                      <option disabled value="">
                        Select a filter…
                      </option>
                      <option
                        v-for="f in selectableFiltersForRow(idx)"
                        :key="f.id"
                        :value="f.id"
                      >
                        {{ filterOptionLabel(f) }}
                      </option>
                    </select>
                  </template>

                  <div
                    v-else
                    class="rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-4 sm:px-5 sm:py-5"
                  >
                    <p class="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Match this rule
                    </p>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end sm:gap-4">
                      <div class="sm:col-span-5">
                        <label :for="`rl-filter-${idx}`" class="mb-1.5 block text-xs font-medium text-slate-600">Field</label>
                        <select
                          :id="`rl-filter-${idx}`"
                          v-model="row.recipientFilterId"
                          class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
                          @change="onRowFilterChange(row)"
                        >
                          <option
                            v-for="f in selectableFiltersForRow(idx)"
                            :key="f.id"
                            :value="f.id"
                          >
                            {{ filterOptionLabel(f) }}
                          </option>
                        </select>
                      </div>
                      <div class="flex items-center justify-center sm:col-span-2 sm:pb-2">
                        <span class="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/25" title="must equal">
                          <span aria-hidden="true">=</span>
                          <span>equals</span>
                        </span>
                      </div>
                      <div class="sm:col-span-5">
                        <label :for="`rl-list-property-value-${idx}`" class="mb-1.5 block text-xs font-medium text-slate-600">Value</label>
                        <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                          <select
                            :id="`rl-list-property-value-${idx}`"
                            v-model="row.listPropertyValue"
                            required
                            class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
                          >
                            <option disabled value="">
                              Choose a value…
                            </option>
                            <option
                              v-for="opt in rowRegistryTokens(row)"
                              :key="opt"
                              :value="opt"
                            >
                              {{ opt }}
                            </option>
                          </select>
                        </template>
                        <p
                          v-else-if="showPropertyRowFor(row) && rowRegistryTokens(row).length === 1"
                          class="break-words rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:text-[15px]"
                        >
                          {{ rowRegistryTokens(row)[0] }}
                        </p>
                        <input
                          v-else-if="showPropertyRowFor(row)"
                          :id="`rl-list-property-value-${idx}`"
                          v-model="row.listPropertyValue"
                          type="text"
                          required
                          maxlength="2000"
                          class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
                          :placeholder="propertyValuePlaceholderFor(row)"
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="filtersForAudience.length && canAddFilter"
              type="button"
              class="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-sm font-semibold text-slate-800 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-950 sm:py-4 sm:text-[15px]"
              @click="addFilterRow"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-indigo-600 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span class="text-left">
                <span class="block">{{ form.filterRows.length ? 'Add another condition' : 'Add a filter condition' }}</span>
                <span class="mt-0.5 block text-xs font-normal text-slate-500 group-hover:text-indigo-800/90">Stack rules, then connect them with And or Or above</span>
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

        <div class="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:justify-end sm:gap-4 sm:pt-2">
          <NuxtLink
            :to="`/tenant/recipient-list/${listId}`"
            class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:text-[15px]"
            :class="{ 'pointer-events-none opacity-50': saving }"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 sm:px-8 sm:text-[15px]"
            :disabled="saving || !canSubmitPropertyValue || !audienceOptions.length"
          >
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
      </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

const route = useRoute()

const {
  listId,
  loadPending,
  loadError,
  saveError,
  saving,
  data,
  form,
  audienceOptions,
  filtersForAudience,
  selectableFiltersForRow,
  canAddFilter,
  showPropertyRowFor,
  rowRegistryTokens,
  propertyValuePlaceholderFor,
  showCombineBeforeFormRow,
  joinSlotBeforeFormRow,
  canSubmitPropertyValue,
  onRowFilterChange,
  addFilterRow,
  removeFilterRow,
  filterOptionLabel,
  submitUpdate
} = useRecipientListForm({
  mode: 'edit',
  listId: computed(() => String(route.params.id ?? ''))
})
</script>
