<template>
  <div class="w-full min-w-0">
    <div class="mx-auto w-full max-w-3xl">
      <NuxtLink
        to="/tenant/recipient-list"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        Back to lists
      </NuxtLink>

      <header class="mb-8 sm:mb-10">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          New recipient list
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
          Pick an audience, then optionally add filters to narrow who’s included.
        </p>
      </header>

      <div
        v-if="data && !data.tenantIdConfigured"
        class="mb-6 flex gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-50/30 px-4 py-3.5 text-sm text-amber-950 shadow-sm shadow-amber-900/5"
        role="status"
      >
        <div class="mt-0.5 shrink-0 text-amber-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p class="font-medium text-amber-950">
            Tenant ID not set
          </p>
          <p class="mt-1 text-amber-900/90">
            Your tenant has no <strong class="font-semibold">tenant ID</strong> in the registry. You can still save audience-only lists;
            admin-defined recipient filters appear once a tenant ID is set.
          </p>
        </div>
      </div>

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

      <div v-if="loadPending" class="mb-8 space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <div class="h-10 max-w-sm animate-pulse rounded-xl bg-zinc-100" />
        <div class="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
        <div class="h-32 animate-pulse rounded-xl bg-zinc-50" />
      </div>

      <form
        v-else-if="data"
        class="space-y-6"
        @submit.prevent="submitCreate"
      >
        <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
          <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Details
            </h2>
          </div>
          <div class="space-y-6 p-5 sm:p-6">
            <div>
              <label for="rl-name" class="mb-2 block text-sm font-medium text-zinc-700">List name</label>
              <input
                id="rl-name"
                v-model="form.name"
                type="text"
                required
                maxlength="200"
                placeholder="e.g. Texas prospects"
                class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:text-[15px]"
              >
            </div>

            <div>
              <label for="rl-audience" class="mb-2 block text-sm font-medium text-zinc-700">Contact type</label>
              <p class="mb-2 text-xs leading-relaxed text-zinc-500">
                Only types that have recipient filters in admin appear here. Labels come from your tenant contact types.
              </p>
              <select
                id="rl-audience"
                v-model="form.audience"
                class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 sm:text-[15px]"
                :disabled="!audienceOptions.length"
                required
                :aria-describedby="data.tenantIdConfigured && !audienceOptions.length ? 'rl-audience-hint' : undefined"
              >
                <option v-if="!audienceOptions.length" disabled value="">
                  No contact types from filters
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
                id="rl-audience-hint"
                v-if="data.tenantIdConfigured && !audienceOptions.length"
                class="mt-2 text-sm text-zinc-500"
              >
                Add at least one recipient filter in admin (per contact type) to choose a type here.
              </p>
            </div>
          </div>

          <div class="border-t border-zinc-100 bg-gradient-to-b from-violet-50/40 via-zinc-50/40 to-zinc-50/50 px-5 py-5 sm:px-6">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-sm font-semibold text-zinc-900">
                  Audience filters
                </h2>
                <p class="mt-1 max-w-xl text-sm leading-relaxed text-zinc-600">
                  Narrow the list with registry rules. Skip this to include everyone in the audience.
                </p>
              </div>
              <div
                v-if="form.filterRows.length > 1"
                class="mt-1 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-violet-900 ring-1 ring-violet-200/70"
                role="status"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
                {{ form.filterRows.length }} conditions — use <span class="font-semibold">And / Or</span> between them
              </div>
            </div>
          </div>
          <div class="space-y-6 p-5 sm:p-6">
            <p
              v-if="data.tenantIdConfigured && !filtersForAudience.length"
              class="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 px-4 py-4 text-sm leading-relaxed text-zinc-700"
            >
              No filters are set up for this audience yet. Ask an admin to add recipient filters, or create the list using the audience only.
            </p>

            <div
              v-for="(row, idx) in form.filterRows"
              :key="idx"
              class="relative"
            >
              <!-- Connector between conditions -->
              <div
                v-if="showCombineBeforeFormRow(idx)"
                class="relative mb-6 flex flex-col items-center gap-3"
                role="group"
                :aria-label="`How to combine condition ${idx} with condition ${idx + 1}`"
              >
                <div class="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-zinc-200 via-violet-200/80 to-zinc-200 sm:block sm:-top-4 sm:h-[calc(100%+1rem)]" aria-hidden="true" />
                <div class="relative z-[1] w-full max-w-lg rounded-2xl border border-violet-200/80 bg-white p-4 shadow-sm shadow-violet-950/[0.04] ring-1 ring-violet-100/80">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex items-start gap-3">
                      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700" aria-hidden="true">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </span>
                      <div>
                        <p class="text-sm font-semibold text-zinc-900">
                          Connect to the next rule
                        </p>
                        <p class="mt-0.5 text-xs leading-relaxed text-zinc-600 sm:text-sm">
                          <strong class="font-medium text-zinc-800">And</strong> means every rule must pass.
                          <strong class="font-medium text-zinc-800">Or</strong> means at least one can pass.
                        </p>
                      </div>
                    </div>
                    <div
                      class="flex w-full shrink-0 rounded-xl border border-zinc-200/90 bg-zinc-100/60 p-1 sm:w-auto"
                      role="radiogroup"
                      aria-label="Combine filters"
                    >
                      <button
                        type="button"
                        class="min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition sm:min-w-[7.5rem] sm:px-4 sm:text-sm"
                        :class="form.criterionJoins[joinSlotBeforeFormRow(idx)] === 'and'
                          ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80'
                          : 'text-zinc-600 hover:text-zinc-900'"
                        @click="form.criterionJoins[joinSlotBeforeFormRow(idx)] = 'and'"
                      >
                        And
                        <span class="mt-0.5 block text-[10px] font-normal text-zinc-500 sm:text-xs">all match</span>
                      </button>
                      <button
                        type="button"
                        class="min-h-[2.5rem] flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition sm:min-w-[7.5rem] sm:px-4 sm:text-sm"
                        :class="form.criterionJoins[joinSlotBeforeFormRow(idx)] === 'or'
                          ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80'
                          : 'text-zinc-600 hover:text-zinc-900'"
                        @click="form.criterionJoins[joinSlotBeforeFormRow(idx)] = 'or'"
                      >
                        Or
                        <span class="mt-0.5 block text-[10px] font-normal text-zinc-500 sm:text-xs">any match</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-zinc-200/85 bg-white shadow-sm shadow-zinc-950/[0.03] ring-1 ring-zinc-100/80">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/50 px-4 py-3.5 sm:px-5">
                  <div class="flex items-center gap-3">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white tabular-nums">
                      {{ idx + 1 }}
                    </span>
                    <div>
                      <p class="text-sm font-semibold text-zinc-900">
                        Condition {{ idx + 1 }}
                      </p>
                      <p class="text-xs text-zinc-500">
                        {{ row.recipientFilterId ? 'Pick a value to finish this rule' : 'Choose which registry field to filter on' }}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-red-700 transition hover:border-red-200 hover:bg-red-50 sm:text-sm"
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
                    <label :for="`rl-filter-${idx}`" class="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">Registry field</label>
                    <select
                      :id="`rl-filter-${idx}`"
                      v-model="row.recipientFilterId"
                      required
                      class="w-full rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:text-[15px]"
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
                    class="rounded-xl border border-zinc-100 bg-gradient-to-b from-zinc-50/80 to-white px-4 py-4 sm:px-5 sm:py-5"
                  >
                    <p class="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Match this rule
                    </p>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end sm:gap-4">
                      <div class="sm:col-span-5">
                        <label :for="`rl-filter-${idx}`" class="mb-1.5 block text-xs font-medium text-zinc-600">Field</label>
                        <select
                          :id="`rl-filter-${idx}`"
                          v-model="row.recipientFilterId"
                          class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:text-[15px]"
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
                        <span class="inline-flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm" title="must equal">
                          <span aria-hidden="true">=</span>
                          <span>equals</span>
                        </span>
                      </div>
                      <div class="sm:col-span-5">
                        <label :for="`rl-list-property-value-${idx}`" class="mb-1.5 block text-xs font-medium text-zinc-600">Value</label>
                        <template v-if="showPropertyRowFor(row) && rowRegistryTokens(row).length > 1">
                          <select
                            :id="`rl-list-property-value-${idx}`"
                            v-model="row.listPropertyValue"
                            required
                            class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:text-[15px]"
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
                          class="break-words rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm sm:text-[15px]"
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
                          class="w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:text-[15px]"
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
              class="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/30 px-4 py-4 text-sm font-semibold text-zinc-800 transition hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-950 sm:py-4 sm:text-[15px]"
              @click="addFilterRow"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-zinc-200/80 transition group-hover:bg-violet-100 group-hover:ring-violet-200/80">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span class="text-left">
                <span class="block">{{ form.filterRows.length ? 'Add another condition' : 'Add a filter condition' }}</span>
                <span class="mt-0.5 block text-xs font-normal text-zinc-500 group-hover:text-violet-800/80">Stack rules, then connect them with And or Or above</span>
              </span>
            </button>

          </div>
        </div>

        <div
          v-if="saveError"
          class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900"
          role="alert"
        >
          {{ saveError }}
        </div>

        <div class="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <NuxtLink
            to="/tenant/recipient-list"
            class="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:text-[15px]"
            :class="{ 'pointer-events-none opacity-50': saving }"
          >
            Cancel
          </NuxtLink>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50 sm:px-8 sm:text-[15px]"
            :disabled="saving || !canSubmitPropertyValue || !audienceOptions.length"
          >
            {{ saving ? 'Saving…' : 'Create list' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">

definePageMeta({ layout: 'default' })

const {
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
  submitCreate
} = useRecipientListForm({ mode: 'create' })
</script>
