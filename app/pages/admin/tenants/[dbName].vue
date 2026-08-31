<template>
  <section class="mx-auto min-w-0 max-w-6xl">
    <nav class="mb-4 text-sm text-slate-500">
      <NuxtLink to="/admin/tenants" class="hover:text-primary-600">
        Tenants
      </NuxtLink>
      <span class="mx-1.5">/</span>
      <span class="text-slate-800">{{ tenant?.name || dbName }}</span>
    </nav>

    <header v-if="tenant">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">
        {{ tenant.name }}
      </h1>
      <p class="mt-1.5 mb-5 text-sm text-slate-500">
        Registry database: <span class="font-mono text-slate-700">{{ tenant.dbName }}</span>
      </p>
    </header>

    <div v-else-if="tenantPending" class="py-12 text-center text-slate-500">
      Loading…
    </div>

    <div v-else class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      Tenant not found or you do not have access.
    </div>

    <template v-if="tenant">
      <div class="tab-list">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': tab === 'overview' }"
          @click="tab = 'overview'"
        >
          Overview
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': tab === 'filters' }"
          @click="tab = 'filters'"
        >
          Recipient filters
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': tab === 'dynamicVariables' }"
          @click="tab = 'dynamicVariables'"
        >
          Dynamic variables
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': tab === 'deletedTemplates' }"
          @click="tab = 'deletedTemplates'"
        >
          Deleted templates
        </button>
      </div>

      <TenantTabsOverviewTab
        v-show="tab === 'overview'"
        :tenant="tenant"
      />

      <TenantTabsRecipientFiltersTab v-show="tab === 'filters'">
        <div
          v-if="tenant && !tenant.tenantId"
          class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          This tenant has no <strong>tenant ID</strong> in the registry. Set one on the client record before creating recipient filters.
        </div>

        <template #contact-types>
          <div class="min-w-0 space-y-5">
            <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div class="min-w-0 space-y-1">
                <h2 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  Contact types
                </h2>
                <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
                  Define keys and labels used when building recipient filters for this tenant.
                </p>
                <p class="text-sm text-slate-400">
                  <template v-if="contactTypeSearchQuery.trim()">
                    {{ filteredContactTypes.length }} of {{ contactTypes.length }}
                    {{ contactTypes.length === 1 ? 'type' : 'types' }}
                  </template>
                  <template v-else>
                    {{ contactTypes.length }} {{ contactTypes.length === 1 ? 'type' : 'types' }}
                  </template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-start">
                <span v-if="contactTypesPending" class="text-sm font-medium text-slate-500">Loading…</span>
                <button
                  type="button"
                  class="btn-cta btn-cta--compact group self-start"
                  @click="openContactTypeModal"
                >
                  <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Contact Type
                </button>
              </div>
            </header>

            <div
              v-if="contactTypesPending && !contactTypes.length"
              class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
            >
              Loading contact types…
            </div>

            <div
              v-else-if="!contactTypes.length"
              class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/[0.03] sm:py-20"
            >
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
                No contact types yet
              </h3>
              <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                Create your first contact type to use in recipient filters.
              </p>
              <button
                type="button"
                class="btn-cta btn-cta--compact group mt-6"
                @click="openContactTypeModal"
              >
                <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add contact type
              </button>
            </div>

            <div v-else class="space-y-3">
              <div class="relative min-w-0 w-full sm:max-w-md">
                <label class="sr-only" for="contact-type-search">Search contact types</label>
                <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="contact-type-search"
                  v-model="contactTypeSearchQuery"
                  type="search"
                  autocomplete="off"
                  placeholder="Search by key or label…"
                  class="w-full rounded-lg border border-slate-200/90 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
              </div>

              <div
                v-if="!filteredContactTypes.length"
                class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm shadow-slate-900/[0.03] sm:py-16"
              >
                <h3 class="text-lg font-semibold tracking-tight text-slate-900">
                  No matching contact types
                </h3>
                <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                  Try a different search term.
                </p>
              </div>

              <template v-else>
              <div :class="tenantRecordListClass">
                <UiRfRecordCard
                  v-for="ct in filteredContactTypes"
                  :key="`card-${ct.id}`"
                >
                  <template #header>
                    <h3 class="rf-record-card__title">
                      {{ ct.label }}
                    </h3>
                    <p class="rf-record-card__subtitle">
                      <code>{{ ct.key }}</code>
                    </p>
                  </template>
                  <template #status>
                    <span class="status-pill" :class="ct.enabled ? 'status-pill--on' : 'status-pill--off'">
                      {{ ct.enabled ? 'On' : 'Off' }}
                    </span>
                  </template>

                  <div class="rf-record-field-pair">
                    <UiRfRecordField label="Key">
                      <UiRfTableCellText :text="ct.key" monospace />
                    </UiRfRecordField>
                    <UiRfRecordField label="Label">
                      <UiRfTableCellText :text="ct.label" />
                    </UiRfRecordField>
                  </div>

                  <template #actions>
                    <div class="row-actions">
                      <button type="button" class="btn-row btn-row--edit" @click="startEditContactType(ct)">
                        Edit
                      </button>
                      <button
                        type="button"
                        class="btn-row btn-row--danger"
                        :disabled="contactTypeDeletingId === ct.id"
                        @click="openDeleteModal('contactType', ct.id)"
                      >
                        {{ contactTypeDeletingId === ct.id ? '…' : 'Delete' }}
                      </button>
                    </div>
                  </template>
                </UiRfRecordCard>
              </div>

              <div :class="tenantDataViewTableClass">
                <div :class="tenantDataTableWrapClass">
                  <table :class="tenantDataTableClassCompact">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Label</th>
                        <th>Status</th>
                        <th :class="tenantDataThActionsClass">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="ct in filteredContactTypes" :key="`row-${ct.id}`">
                        <td class="td-name">
                          <UiRfTableCellText :text="ct.key" />
                        </td>
                        <td class="td-muted">
                          <UiRfTableCellText :text="ct.label" />
                        </td>
                        <td>
                          <span class="status-pill" :class="ct.enabled ? 'status-pill--on' : 'status-pill--off'">{{ ct.enabled ? 'On' : 'Off' }}</span>
                        </td>
                        <td :class="tenantDataTdActionsClass">
                          <div class="row-actions">
                            <button type="button" class="btn-row btn-row--edit" @click="startEditContactType(ct)">
                              Edit
                            </button>
                            <button
                              type="button"
                              class="btn-row btn-row--danger"
                              :disabled="contactTypeDeletingId === ct.id"
                              @click="openDeleteModal('contactType', ct.id)"
                            >
                              {{ contactTypeDeletingId === ct.id ? '…' : 'Delete' }}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              </template>
            </div>

          <Teleport to="body">
            <div
              v-if="contactTypeModalOpen"
              class="compact-modal-backdrop"
              @click.self="closeContactTypeModal"
            >
              <div
                class="compact-modal"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="contactTypeEditingId ? 'ct-modal-title-edit' : 'ct-modal-title-add'"
              >
                <div class="compact-modal__header">
                  <div class="min-w-0">
                    <h3
                      :id="contactTypeEditingId ? 'ct-modal-title-edit' : 'ct-modal-title-add'"
                      class="compact-modal__title"
                    >
                      {{ contactTypeEditingId ? 'Edit Contact Type' : 'Add Contact Type' }}
                    </h3>
                    <p v-if="contactTypeEditingId" class="compact-modal__subtitle">
                      Update the selected contact type.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="compact-modal__close"
                    aria-label="Close"
                    @click="closeContactTypeModal"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="compact-modal-form" @submit.prevent="submitContactTypeForm">
                  <div class="compact-modal-field">
                    <label for="ct-key" class="compact-modal-label">
                      Key
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="ct-key"
                      v-model="contactTypeForm.key"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input compact-modal-input--mono"
                      placeholder="e.g. prospect"
                    >
                  </div>

                  <div class="compact-modal-field">
                    <label for="ct-label" class="compact-modal-label">
                      Label
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="ct-label"
                      v-model="contactTypeForm.label"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input"
                      placeholder="e.g. Prospect"
                    >
                  </div>

                  <div class="compact-modal-field compact-modal-field--full compact-modal-toggles">
                    <label class="toggle-row">
                      <input v-model="contactTypeForm.enabled" type="checkbox" class="toggle-check">
                      <span class="toggle-label">Enabled</span>
                    </label>
                  </div>

                  <div v-if="contactTypeFormError" class="compact-modal-error compact-modal-field--full">
                    {{ contactTypeFormError }}
                  </div>

                  <div class="compact-modal-footer compact-modal-field--full">
                    <button type="button" class="btn-modal-cancel" @click="closeContactTypeModal">
                      Cancel
                    </button>
                    <button type="submit" class="btn-modal-submit" :disabled="contactTypeSaving">
                      {{ contactTypeSaving ? 'Saving…' : contactTypeEditingId ? 'Save Changes' : 'Add Contact Type' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Teleport>
          </div>
        </template>

        <template #recipient-filters>
          <div class="min-w-0 space-y-5">
            <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div class="min-w-0 space-y-1">
                <h2 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  Recipient Filters
                </h2>
                <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
                  Rules that determine which contacts receive campaigns based on type and properties.
                </p>
                <p class="text-sm text-slate-400">
                  <template v-if="recipientFiltersHasActiveFilters">
                    {{ filteredFiltersDisplay.length }} of {{ filters.length }}
                    {{ filters.length === 1 ? 'filter' : 'filters' }}
                  </template>
                  <template v-else>
                    {{ filters.length }} {{ filters.length === 1 ? 'filter' : 'filters' }}
                  </template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-start">
                <span v-if="filtersPending" class="text-sm font-medium text-slate-500">Loading…</span>
                <button
                  type="button"
                  class="btn-cta btn-cta--compact group self-start"
                  @click="openRecipientFilterModal"
                >
                  <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Filter
                </button>
              </div>
            </header>

            <div
              v-if="filtersPending && !filters.length"
              class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
            >
              Loading filters…
            </div>

            <div
              v-else-if="!filters.length"
              class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/[0.03] sm:py-20"
            >
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
                No recipient filters yet
              </h3>
              <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                Create your first filter to target contacts by type and property.
              </p>
              <button
                type="button"
                class="btn-cta btn-cta--compact group mt-6"
                @click="openRecipientFilterModal"
              >
                <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Filter
              </button>
            </div>

            <div v-else class="space-y-3">
              <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div class="relative min-w-0 w-full sm:flex-1 sm:max-w-md">
                  <label class="sr-only" for="recipient-filter-search">Search recipient filters</label>
                  <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    id="recipient-filter-search"
                    v-model="recipientFilterSearchQuery"
                    type="search"
                    autocomplete="off"
                    placeholder="Search by name, type, property, or value…"
                    class="w-full rounded-lg border border-slate-200/90 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                </div>
                <TenantFilterSelect
                  id="recipient-filter-contact-type-filter"
                  v-model="recipientFilterContactTypeFilter"
                  label="Filter by contact type"
                  variant="field"
                  :options="recipientFilterContactTypeFilterSelectOptions"
                  class="w-full shrink-0 sm:w-[11.5rem]"
                />
                <TenantFilterSelect
                  id="recipient-filter-property-filter"
                  v-model="recipientFilterPropertyFilter"
                  label="Filter by property"
                  variant="field"
                  :options="recipientFilterPropertyFilterSelectOptions"
                  class="w-full shrink-0 sm:w-[11.5rem]"
                />
              </div>

              <div
                v-if="!filteredFiltersDisplay.length"
                class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm shadow-slate-900/[0.03] sm:py-16"
              >
                <h3 class="text-lg font-semibold tracking-tight text-slate-900">
                  No matching recipient filters
                </h3>
                <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
                  {{ recipientFilterNoMatchesHint }}
                </p>
              </div>

              <template v-else>
              <div :class="tenantRecordListClass">
                <UiRfRecordCard
                  v-for="f in filteredFiltersDisplay"
                  :key="`card-${f.id}`"
                >
                  <template #header>
                    <div class="rf-record-card__title">
                      <UiRfTableCellText
                        :text="f.name"
                        :limit="mobileRecordFieldCharLimit"
                      />
                    </div>
                  </template>
                  <template #status>
                    <span
                      class="status-pill"
                      :class="f.enabled ? 'status-pill--on' : 'status-pill--off'"
                    >
                      {{ f.enabled ? 'On' : 'Off' }}
                    </span>
                  </template>

                  <div class="rf-record-field-pair">
                    <UiRfRecordField label="Contact type">
                      {{ contactTypeTableLabel(f.contactType) }}
                    </UiRfRecordField>
                    <UiRfRecordField label="Property">
                      {{ propertyFieldLabel(f.property) }}
                    </UiRfRecordField>
                  </div>
                  <UiRfRecordField label="Type">
                    {{ recipientFilterTypeLabel(f) }}
                  </UiRfRecordField>
                  <UiRfRecordField label="Values" full-width>
                    <span v-if="f.valuesFromContacts" class="value-chip">From contacts</span>
                    <UiRfTableCellChips
                      v-else
                      :items="f.valueTokens"
                      :format-item="f.formatValueToken"
                    />
                  </UiRfRecordField>

                  <template #actions>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="btn-row btn-row--edit"
                        @click="startEdit(f)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="btn-row btn-row--danger"
                        :disabled="deletingId === f.id"
                        @click="openDeleteModal('filter', f.id)"
                      >
                        {{ deletingId === f.id ? '…' : 'Delete' }}
                      </button>
                    </div>
                  </template>
                </UiRfRecordCard>
              </div>

              <div :class="tenantDataViewTableClass">
                <div :class="tenantDataTableWrapClass">
                  <table :class="tenantDataTableClass">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact type</th>
                        <th>Property</th>
                        <th>Type</th>
                        <th class="rf-table__col-values">Values</th>
                        <th>Status</th>
                        <th :class="tenantDataThActionsClass">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="f in filteredFiltersDisplay" :key="`row-${f.id}`">
                        <td class="td-name">
                          <UiRfTableCellText :text="f.name" ellipsis :lines="2" />
                        </td>
                        <td class="td-contact">
                          <UiRfTableCellText
                            :text="contactTypeTableLabel(f.contactType)"
                            ellipsis
                            :lines="2"
                          />
                        </td>
                        <td class="td-muted">
                          <UiRfTableCellText
                            :text="propertyFieldLabel(f.property)"
                            ellipsis
                            :lines="2"
                          />
                        </td>
                        <td class="td-muted">
                          <UiRfTableCellText
                            :text="recipientFilterTypeLabel(f)"
                            ellipsis
                            :lines="2"
                          />
                        </td>
                        <td class="td-values rf-table__col-values">
                          <span v-if="f.valuesFromContacts" class="value-chip">From contacts</span>
                          <UiRfTableCellChips
                            v-else
                            :items="f.valueTokens"
                            :format-item="f.formatValueToken"
                          />
                        </td>
                        <td>
                          <span
                            class="status-pill"
                            :class="f.enabled ? 'status-pill--on' : 'status-pill--off'"
                          >{{ f.enabled ? 'On' : 'Off' }}</span>
                        </td>
                        <td :class="tenantDataTdActionsClass">
                          <div class="row-actions">
                            <button
                              type="button"
                              class="btn-row btn-row--edit"
                              @click="startEdit(f)"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              class="btn-row btn-row--danger"
                              :disabled="deletingId === f.id"
                              @click="openDeleteModal('filter', f.id)"
                            >
                              {{ deletingId === f.id ? '…' : 'Delete' }}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              </template>
            </div>

          <Teleport to="body">
            <div
              v-if="recipientFilterModalOpen"
              class="compact-modal-backdrop"
              @click.self="closeRecipientFilterModal"
            >
              <div
                class="compact-modal"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="editingId ? 'rf-modal-title-edit' : 'rf-modal-title-add'"
              >
                <div class="compact-modal__header">
                  <div class="min-w-0">
                    <h3
                      :id="editingId ? 'rf-modal-title-edit' : 'rf-modal-title-add'"
                      class="compact-modal__title"
                    >
                      {{ editingId ? 'Edit Filter' : 'Add Filter' }}
                    </h3>
                    <p v-if="editingId" class="compact-modal__subtitle">
                      Updating the selected filter.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="compact-modal__close"
                    aria-label="Close"
                    @click="closeRecipientFilterModal"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="compact-modal-form" @submit.prevent="submitFilterForm">
                  <div class="compact-modal-field">
                    <label for="rf-name" class="compact-modal-label">
                      Name
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="rf-name"
                      v-model="form.name"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input"
                      placeholder="e.g. Texas prospects"
                    >
                  </div>

                  <div class="compact-modal-field">
                    <label for="rf-contact-type" class="compact-modal-label">Contact type</label>
                    <select
                      id="rf-contact-type"
                      v-model="form.contactType"
                      class="compact-modal-input"
                    >
                      <option
                        v-for="ct in contactTypes"
                        :key="ct.id"
                        :value="ct.key"
                      >
                        {{ contactTypeSelectLabel(ct) }}
                      </option>
                    </select>
                  </div>

                  <div class="compact-modal-field">
                    <label for="rf-property" class="compact-modal-label">Property</label>
                    <select
                      id="rf-property"
                      v-model="form.property"
                      class="compact-modal-input"
                    >
                      <option
                        v-for="opt in recipientFilterPropertyFieldOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-if="form.property === 'address'" class="compact-modal-field">
                    <label for="rf-property-type" class="compact-modal-label">Property type</label>
                    <select
                      id="rf-property-type"
                      v-model="form.propertyType"
                      class="compact-modal-input"
                    >
                      <option
                        v-for="opt in recipientFilterAddressPropertyTypeOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-else-if="form.property === 'contact_profile'" class="compact-modal-field">
                    <label for="rf-contact-profile-type" class="compact-modal-label">Type or sub type</label>
                    <select
                      id="rf-contact-profile-type"
                      v-model="form.propertyType"
                      class="compact-modal-input"
                    >
                      <option
                        v-for="opt in recipientFilterContactProfilePropertyTypeOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-else-if="form.property === 'relationship_partner'" class="compact-modal-field">
                    <label for="rf-relationship-partner-type" class="compact-modal-label">Partner field</label>
                    <select
                      id="rf-relationship-partner-type"
                      v-model="form.propertyType"
                      class="compact-modal-input"
                    >
                      <option
                        v-for="opt in recipientFilterRelationshipPartnerPropertyTypeOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div
                    v-if="formSupportsContactValues"
                    class="compact-modal-field compact-modal-field--full compact-modal-toggles"
                  >
                    <label class="toggle-row">
                      <input
                        v-model="form.valuesFromContacts"
                        type="checkbox"
                        class="toggle-check"
                      >
                      <span class="toggle-label">{{ contactValuesLabel }}</span>
                    </label>
                  </div>

                  <div v-if="form.valuesFromContacts" class="compact-modal-field compact-modal-field--full">
                    <span class="compact-modal-label">Property value</span>
                    <p class="mt-1.5 text-xs text-slate-500">
                      Tenants pick from the
                      {{ propertyFieldLabel(form.property).toLowerCase() }} values found on their
                      {{ contactTypeTableLabel(form.contactType) }} contacts, so no value is set here.
                    </p>
                  </div>

                  <div v-else class="compact-modal-field compact-modal-field--full">
                    <label for="rf-property-value" class="compact-modal-label">
                      Property value
                      <span class="compact-modal-label-hint">(optional)</span>
                    </label>
                    <input
                      id="rf-property-value"
                      v-model="form.propertyValue"
                      type="text"
                      class="compact-modal-input"
                      :placeholder="propertyValuePlaceholder"
                    >
                    <p class="mt-1.5 text-xs text-slate-500">
                      {{ propertyValueHint }}
                    </p>
                  </div>

                  <div class="compact-modal-field compact-modal-field--full compact-modal-toggles">
                    <label class="toggle-row">
                      <input v-model="form.enabled" type="checkbox" class="toggle-check">
                      <span class="toggle-label">Enabled</span>
                    </label>
                  </div>

                  <div v-if="formError" class="compact-modal-error compact-modal-field--full">
                    {{ formError }}
                  </div>

                  <div class="compact-modal-footer compact-modal-field--full">
                    <button type="button" class="btn-modal-cancel" @click="closeRecipientFilterModal">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn-modal-submit"
                      :disabled="saving"
                    >
                      {{ saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Filter' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Teleport>
          </div>
        </template>
      </TenantTabsRecipientFiltersTab>

      <TenantTabsDynamicFieldsTab v-show="tab === 'dynamicVariables'">
        <div class="min-w-0 space-y-5">
          <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div class="min-w-0 space-y-1">
              <h2 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Dynamic Variables
              </h2>
              <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
                Configure template merge fields and map them to contact paths for this tenant.
              </p>
              <p class="text-sm text-slate-400">
                {{ dynamicVariables.length }} {{ dynamicVariables.length === 1 ? 'variable' : 'variables' }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3 self-start">
              <span v-if="dynamicPending" class="text-sm font-medium text-slate-500">Loading…</span>
              <button
                type="button"
                class="btn-cta btn-cta--compact group self-start"
                @click="openDynamicVariableModal"
              >
                <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Dynamic Variable
              </button>
            </div>
          </header>

          <div
            v-if="dynamicPending && !dynamicVariables.length"
            class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
          >
            Loading variables…
          </div>

          <div
            v-else-if="!dynamicVariables.length"
            class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/[0.03] sm:py-20"
          >
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
              <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
              No dynamic variables yet
            </h3>
            <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
              Create your first variable to use merge fields in campaign templates.
            </p>
            <button
              type="button"
              class="btn-cta btn-cta--compact group mt-6"
              @click="openDynamicVariableModal"
            >
              <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Dynamic Variable
            </button>
          </div>

          <div v-else>
            <div :class="[tenantRecordListClass, 'rf-record-list--dynamic-vars']">
              <UiRfRecordCard
                v-for="v in dynamicVariables"
                :key="`card-${v.id}`"
              >
                <template #header>
                  <div class="rf-record-card__title">
                    <UiRfTableCellText
                      :text="v.label"
                      ellipsis
                      :lines="2"
                    />
                  </div>
                  <div class="rf-record-card__subtitle">
                    <UiRfTableCellText
                      :text="v.key"
                      monospace
                      ellipsis
                      :lines="2"
                    />
                  </div>
                </template>
                <template #status>
                  <span class="status-pill" :class="v.enabled ? 'status-pill--on' : 'status-pill--off'">
                    {{ v.enabled ? 'On' : 'Off' }}
                  </span>
                </template>

                <UiRfRecordField label="Key">
                  <UiRfTableCellText
                    :text="v.key"
                    monospace
                    ellipsis
                    :lines="2"
                  />
                </UiRfRecordField>
                <UiRfRecordField label="Contact path">
                  <UiRfTableCellText
                    :text="v.contactPath"
                    monospace
                    ellipsis
                    :lines="2"
                  />
                </UiRfRecordField>
                <UiRfRecordField label="Scopes" full-width>
                  <UiRfTableCellChips :items="v.scopes" />
                </UiRfRecordField>
                <UiRfRecordField label="Fallback">
                  <UiRfTableCellText
                    :text="v.fallbackValue"
                    ellipsis
                    :lines="2"
                  />
                </UiRfRecordField>

                <template #actions>
                  <div class="row-actions">
                    <button type="button" class="btn-row btn-row--edit" @click="startEditDynamicVariable(v)">
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn-row btn-row--danger"
                      :disabled="dynamicDeletingId === v.id"
                      @click="openDeleteModal('dynamicVariable', v.id)"
                    >
                      {{ dynamicDeletingId === v.id ? '…' : 'Delete' }}
                    </button>
                  </div>
                </template>
              </UiRfRecordCard>
            </div>

            <div :class="tenantDataViewTableClass">
              <div :class="tenantDataTableWrapClass">
                <table :class="dynamicVariablesTableClass">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Key</th>
                      <th>Contact path</th>
                      <th class="rf-table__col-values">Scopes</th>
                      <th>Fallback</th>
                      <th>Status</th>
                      <th :class="tenantDataThActionsClass">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="v in dynamicVariables" :key="`row-${v.id}`">
                      <td class="td-name">
                        <UiRfTableCellText :text="v.label" ellipsis :lines="2" />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.key" monospace ellipsis :lines="2" />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.contactPath" monospace ellipsis :lines="2" />
                      </td>
                      <td class="td-values rf-table__col-values">
                        <UiRfTableCellChips :items="v.scopes" />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.fallbackValue" ellipsis :lines="2" />
                      </td>
                      <td>
                        <span class="status-pill" :class="v.enabled ? 'status-pill--on' : 'status-pill--off'">{{ v.enabled ? 'On' : 'Off' }}</span>
                      </td>
                      <td :class="tenantDataTdActionsClass">
                        <div class="row-actions">
                          <button type="button" class="btn-row btn-row--edit" @click="startEditDynamicVariable(v)">
                            Edit
                          </button>
                          <button
                            type="button"
                            class="btn-row btn-row--danger"
                            :disabled="dynamicDeletingId === v.id"
                            @click="openDeleteModal('dynamicVariable', v.id)"
                          >
                            {{ dynamicDeletingId === v.id ? '…' : 'Delete' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Teleport to="body">
            <div
              v-if="dynamicVariableModalOpen"
              class="compact-modal-backdrop"
              @click.self="closeDynamicVariableModal"
            >
              <div
                class="compact-modal"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="dynamicEditingId ? 'dv-modal-title-edit' : 'dv-modal-title-add'"
              >
                <div class="compact-modal__header">
                  <div class="min-w-0">
                    <h3
                      :id="dynamicEditingId ? 'dv-modal-title-edit' : 'dv-modal-title-add'"
                      class="compact-modal__title"
                    >
                      {{ dynamicEditingId ? 'Edit Dynamic Variable' : 'Add Dynamic Variable' }}
                    </h3>
                    <p v-if="dynamicEditingId" class="compact-modal__subtitle">
                      Updating the selected variable.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="compact-modal__close"
                    aria-label="Close"
                    @click="closeDynamicVariableModal"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="compact-modal-form" @submit.prevent="submitDynamicVariableForm">
                  <div class="compact-modal-field">
                    <label for="dv-key" class="compact-modal-label">
                      Key
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="dv-key"
                      v-model="dynamicForm.key"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input compact-modal-input--mono"
                      placeholder="e.g. user.firstName"
                    >
                  </div>

                  <div class="compact-modal-field">
                    <label for="dv-label" class="compact-modal-label">
                      Label
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="dv-label"
                      v-model="dynamicForm.label"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input"
                      placeholder="e.g. First name"
                    >
                  </div>

                  <div class="compact-modal-field">
                    <label for="dv-contact-path" class="compact-modal-label">
                      Contact path
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="dv-contact-path"
                      v-model="dynamicForm.contactPath"
                      type="text"
                      required
                      aria-required="true"
                      class="compact-modal-input compact-modal-input--mono"
                      placeholder="e.g. user.firstName or ownerAvatarUrl"
                    >
                  </div>

                  <div class="compact-modal-field">
                    <label for="dv-source-type" class="compact-modal-label">Variable source</label>
                    <select id="dv-source-type" v-model="dynamicForm.sourceType" class="compact-modal-input">
                      <option value="recipient">Recipient</option>
                      <option value="user">User</option>
                    </select>
                  </div>

                  <div class="compact-modal-field">
                    <label for="dv-description" class="compact-modal-label">
                      Description
                      <span class="compact-modal-label-hint">(optional)</span>
                    </label>
                    <input id="dv-description" v-model="dynamicForm.description" type="text" class="compact-modal-input">
                  </div>

                  <div class="compact-modal-field">
                    <label for="dv-sort" class="compact-modal-label">Sort order</label>
                    <input id="dv-sort" v-model.number="dynamicForm.sortOrder" type="number" class="compact-modal-input" min="0" step="1">
                  </div>

                  <div class="compact-modal-field compact-modal-field--full">
                    <label for="dv-fallback" class="compact-modal-label">
                      Fallback value
                      <span class="compact-modal-label-hint">(optional)</span>
                    </label>
                    <input
                      id="dv-fallback"
                      v-model="dynamicForm.fallbackValue"
                      type="text"
                      class="compact-modal-input"
                      placeholder="e.g. N/A"
                      title="Per-tenant default when the contact has no value for this field."
                    >
                  </div>

                  <div class="compact-modal-field compact-modal-field--full">
                    <span class="compact-modal-label">Scopes</span>
                    <div class="compact-modal-toggles">
                      <label class="toggle-row">
                        <input
                          :checked="dynamicForm.scopes.includes('subject')"
                          type="checkbox"
                          class="toggle-check"
                          @change="toggleDynamicScope('subject', ($event.target as HTMLInputElement).checked)"
                        >
                        <span class="toggle-label">Subject</span>
                      </label>
                      <label class="toggle-row">
                        <input
                          :checked="dynamicForm.scopes.includes('body')"
                          type="checkbox"
                          class="toggle-check"
                          @change="toggleDynamicScope('body', ($event.target as HTMLInputElement).checked)"
                        >
                        <span class="toggle-label">Body</span>
                      </label>
                    </div>
                  </div>

                  <div class="compact-modal-field compact-modal-field--full compact-modal-toggles">
                    <label class="toggle-row">
                      <input v-model="dynamicForm.enabled" type="checkbox" class="toggle-check">
                      <span class="toggle-label">Enabled</span>
                    </label>
                    <label class="toggle-row">
                      <input v-model="dynamicForm.requiredForSend" type="checkbox" class="toggle-check">
                      <span class="toggle-label">Required for send</span>
                    </label>
                  </div>

                  <div v-if="dynamicFormError" class="compact-modal-error compact-modal-field--full">
                    {{ dynamicFormError }}
                  </div>

                  <div class="compact-modal-footer compact-modal-field--full">
                    <button type="button" class="btn-modal-cancel" @click="closeDynamicVariableModal">
                      Cancel
                    </button>
                    <button type="submit" class="btn-modal-submit" :disabled="dynamicSaving">
                      {{ dynamicSaving ? 'Saving…' : dynamicEditingId ? 'Save Changes' : 'Add Dynamic Variable' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Teleport>
        </div>
      </TenantTabsDynamicFieldsTab>

      <TenantTabsDeletedEmailTemplatesTab v-show="tab === 'deletedTemplates'">
        <TenantAdminDeletedEmailTemplatesPanel :tenant-id="tenant.tenantId" />
      </TenantTabsDeletedEmailTemplatesTab>
    </template>

    <ClientConfirmationModal
      :open="!!deletePending"
      :title="deleteModalTitle"
      :message="deleteModalMessage"
      confirm-text="Delete"
      variant="danger"
      :confirm-loading="deleteConfirmLoading"
      @confirm="confirmDelete"
      @cancel="cancelDeleteModal"
    />
  </section>
</template>

<script setup lang="ts">
import {
  recipientFilterAddressPropertyTypeOptions,
  recipientFilterContactProfilePropertyTypeOptions,
  recipientFilterPropertyFieldOptions,
  recipientFilterRelationshipPartnerPropertyTypeOptions,
  resolveRecipientFilterPropertyField,
  resolveRecipientFilterPropertyType,
  type RecipientFilterPropertyFieldValue,
  type RecipientFilterPropertyTypeValue
} from '~/utils/recipientFilterOptions'
import {
  propertyFieldLabel,
  recipientFilterPropertyTypeForSave,
  recipientFilterTypeLabel,
  recipientFilterValueDisplay
} from '~/utils/recipientFilterDisplay'
import {
  recipientFilterPropertyAcceptsValueList,
  recipientFilterPropertyValueTokens
} from '~~/shared/utils/recipientFilterPropertyValue'
import { recipientFilterSupportsContactValues } from '~~/shared/utils/recipientFilterContactField'
import {
  dynamicVariablesTableClass,
  recipientFiltersDataViewTableClass as tenantDataViewTableClass,
  recipientFiltersRecordListClass as tenantRecordListClass,
  recipientFiltersTableClass as tenantDataTableClass,
  recipientFiltersTableClassCompact as tenantDataTableClassCompact,
  recipientFiltersTableWrapClass as tenantDataTableWrapClass,
  recipientFiltersTdActionsClass as tenantDataTdActionsClass,
  recipientFiltersThActionsClass as tenantDataThActionsClass
} from '~/utils/tenantFilterTableClasses'
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import { formatRegistryLabelForDisplay } from '~/utils/registryLabelDisplay'
import { MOBILE_RECORD_FIELD_CHAR_LIMIT } from '~/utils/truncateTabCellText'

definePageMeta({ layout: 'admin' })

const mobileRecordFieldCharLimit = MOBILE_RECORD_FIELD_CHAR_LIMIT

const route = useRoute()
const dbName = computed(() =>
  decodeURIComponent(String(route.params.dbName || ''))
)

const tab = ref<'overview' | 'filters' | 'dynamicVariables' | 'deletedTemplates'>('overview')

interface ContactTypeRow {
  id: string
  key: string
  label: string
  enabled: boolean
  sortOrder: number
}

interface TenantDetail {
  name: string
  email: string | null
  dbName: string
  tenantId: string | null
  apiKeyPrefix: string | null
  createdAt: string
  crmAppUrl: string | null
  kafkaOutboundTopic: string | null
  defaultCampaignSenderEmail: string | null
  defaultCampaignSenderName: string | null
  brevoApiKeyConfigured?: boolean
  brevoApiKeyPrefix?: string | null
  brevoWebhookSecretConfigured?: boolean
  brevoWebhookSecretPrefix?: string | null
  emailProvider?: 'BREVO' | 'ZC_MAIL'
  zcMailBaseUrl?: string | null
  zcMailTenant?: string | null
  zcMailArchive?: boolean
  zcMailApiKeyConfigured?: boolean
  zcMailApiKeyPrefix?: string | null
}

interface FilterRow {
  id: string
  tenantId: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  valuesFromContacts: boolean
  enabled: boolean
}

interface DynamicVariableRow {
  id: string
  key: string
  label: string
  description: string
  contactPath: string
  sourceType: 'recipient' | 'user'
  scopes: Array<'subject' | 'body'>
  enabled: boolean
  sortOrder: number
  fallbackValue: string
  requiredForSend: boolean
}

const tenant = ref<TenantDetail | null>(null)
const tenantPending = ref(true)

const filters = ref<FilterRow[]>([])
const filtersPending = ref(false)
const contactTypes = ref<ContactTypeRow[]>([])
const contactTypesPending = ref(false)
const dynamicVariables = ref<DynamicVariableRow[]>([])
const dynamicPending = ref(false)

const filtersDisplay = computed(() =>
  filters.value.map((f) => ({
    ...f,
    valueTokens: recipientFilterPropertyValueTokens(f.propertyValue, f.property, f.propertyType),
    formatValueToken: (item: string) =>
      recipientFilterValueDisplay(item, f.property, f.propertyType)
  }))
)

const contactTypeSearchQuery = ref('')
const recipientFilterSearchQuery = ref('')
const recipientFilterContactTypeFilter = ref('all')
const recipientFilterPropertyFilter = ref('all')

const filteredContactTypes = computed(() => {
  const q = contactTypeSearchQuery.value.trim().toLowerCase()
  if (!q) return contactTypes.value
  return contactTypes.value.filter((ct) => {
    const key = String(ct.key ?? '').toLowerCase()
    const label = String(ct.label ?? '').toLowerCase()
    return key.includes(q) || label.includes(q)
  })
})

const filteredFiltersDisplay = computed(() => {
  let out = filtersDisplay.value
  if (recipientFilterContactTypeFilter.value !== 'all') {
    const ct = recipientFilterContactTypeFilter.value.toLowerCase()
    out = out.filter((f) => String(f.contactType ?? '').trim().toLowerCase() === ct)
  }
  if (recipientFilterPropertyFilter.value !== 'all') {
    const prop = recipientFilterPropertyFilter.value.toLowerCase()
    out = out.filter((f) => String(f.property ?? '').trim().toLowerCase() === prop)
  }
  const q = recipientFilterSearchQuery.value.trim().toLowerCase()
  if (q) {
    out = out.filter((f) => {
      const blob = [
        f.name,
        f.contactType,
        contactTypeTableLabel(f.contactType),
        f.property,
        propertyFieldLabel(f.property),
        recipientFilterTypeLabel(f),
        f.propertyValue,
        ...f.valueTokens
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }
  return out
})

const recipientFiltersHasActiveFilters = computed(
  () =>
    Boolean(recipientFilterSearchQuery.value.trim()) ||
    recipientFilterContactTypeFilter.value !== 'all' ||
    recipientFilterPropertyFilter.value !== 'all'
)

const editingId = ref<string | null>(null)
const saving = ref(false)
const deletingId = ref<string | null>(null)
const formError = ref('')
const dynamicEditingId = ref<string | null>(null)
const dynamicSaving = ref(false)
const dynamicDeletingId = ref<string | null>(null)
const dynamicFormError = ref('')
const dynamicVariableModalOpen = ref(false)
const contactTypeEditingId = ref<string | null>(null)
const contactTypeSaving = ref(false)
const contactTypeDeletingId = ref<string | null>(null)
const contactTypeFormError = ref('')
const contactTypeModalOpen = ref(false)
const recipientFilterModalOpen = ref(false)

const form = reactive({
  name: '',
  contactType: '',
  property: 'none' as RecipientFilterPropertyFieldValue,
  propertyType: 'state' as RecipientFilterPropertyTypeValue,
  propertyValue: '',
  valuesFromContacts: false,
  enabled: true
})

const formAcceptsValueList = computed(() =>
  recipientFilterPropertyAcceptsValueList(form.property, form.propertyType)
)

const propertyValuePlaceholder = computed(() =>
  formAcceptsValueList.value ? 'e.g. TX or AL, AK, AZ' : 'e.g. NEXA Mortgage, LLC'
)

const propertyValueHint = computed(() =>
  formAcceptsValueList.value
    ? 'Separate multiple values with commas or new lines.'
    : 'Matched as one exact value, including commas and other punctuation.'
)

const formSupportsContactValues = computed(() =>
  recipientFilterSupportsContactValues(
    form.property,
    recipientFilterPropertyTypeForSave(form.property, form.propertyType)
  )
)

const contactValuesLabel = computed(
  () => `Use the ${propertyFieldLabel(form.property).toLowerCase()} values from this tenant's contacts`
)

/** Keep the option off for properties whose contact values would not make a usable dropdown. */
watch(formSupportsContactValues, (supported) => {
  if (!supported) form.valuesFromContacts = false
})

const contactTypeForm = reactive({
  key: '',
  label: '',
  enabled: true
})

const dynamicForm = reactive({
  key: '',
  label: '',
  description: '',
  contactPath: '',
  sourceType: 'recipient' as 'recipient' | 'user',
  scopes: ['subject', 'body'] as Array<'subject' | 'body'>,
  enabled: true,
  sortOrder: 0,
  fallbackValue: '',
  requiredForSend: false
})

watch(
  () => form.property,
  (property) => {
    form.propertyType = resolveRecipientFilterPropertyType(property, form.propertyType)
  }
)

function contactTypeSelectLabel(ct: ContactTypeRow): string {
  const lab = String(ct.label ?? '').trim()
  if (lab) return lab
  return formatRegistryLabelForDisplay(ct.key)
}

function contactTypeTableLabel(contactTypeKey: string): string {
  const k = String(contactTypeKey ?? '').trim().toLowerCase()
  const row = contactTypes.value.find((c) => String(c.key ?? '').trim().toLowerCase() === k)
  const lab = row?.label?.trim()
  if (lab) return lab
  return formatRegistryLabelForDisplay(contactTypeKey)
}

/** Contact types present on saved filters plus tenant contact type registry. */
const recipientFilterContactTypeOptions = computed((): { value: string; label: string }[] => {
  const seen = new Set<string>()
  for (const f of filters.value) {
    const k = String(f.contactType ?? '').trim().toLowerCase()
    if (k) seen.add(k)
  }
  for (const ct of contactTypes.value) {
    if (ct.enabled === false) continue
    const k = String(ct.key ?? '').trim().toLowerCase()
    if (k) seen.add(k)
  }
  if (!seen.size) return []
  const labelByKey = new Map<string, string>()
  const orderByKey = new Map<string, number>()
  for (const ct of contactTypes.value) {
    const k = String(ct.key ?? '').trim().toLowerCase()
    if (!k) continue
    labelByKey.set(k, String(ct.label ?? '').trim() || k)
    orderByKey.set(k, Number(ct.sortOrder ?? 0))
  }
  const keys = [...seen]
  keys.sort((a, b) => {
    const oa = orderByKey.has(a) ? orderByKey.get(a)! : 9999
    const ob = orderByKey.has(b) ? orderByKey.get(b)! : 9999
    if (oa !== ob) return oa - ob
    return a.localeCompare(b)
  })
  return keys.map((value) => ({
    value,
    label: labelByKey.get(value) ?? formatRegistryLabelForDisplay(value)
  }))
})

/** Distinct property values from saved recipient filters. */
const recipientFilterPropertyOptions = computed((): { value: string; label: string }[] => {
  const seen = new Set<string>()
  for (const f of filters.value) {
    const p = String(f.property ?? '').trim().toLowerCase()
    if (p) seen.add(p)
  }
  if (!seen.size) return []
  return [...seen]
    .sort((a, b) => propertyFieldLabel(a).localeCompare(propertyFieldLabel(b)))
    .map((value) => ({
      value,
      label: propertyFieldLabel(value)
    }))
})

const recipientFilterContactTypeFilterSelectOptions = computed(() => [
  { value: 'all', label: 'All contact types' },
  ...recipientFilterContactTypeOptions.value
])

const recipientFilterPropertyFilterSelectOptions = computed(() => [
  { value: 'all', label: 'All properties' },
  ...recipientFilterPropertyOptions.value
])

const recipientFilterNoMatchesHint = computed(() => {
  const hasSearch = Boolean(recipientFilterSearchQuery.value.trim())
  const hasContactType = recipientFilterContactTypeFilter.value !== 'all'
  const hasProperty = recipientFilterPropertyFilter.value !== 'all'
  if (hasSearch && (hasContactType || hasProperty)) return 'Try a different search or filter.'
  if (hasSearch) return 'Try a different search term.'
  if (hasContactType && hasProperty) {
    return 'No filters match these contact type and property selections.'
  }
  if (hasContactType) return 'No filters match this contact type.'
  if (hasProperty) return 'No filters match this property.'
  return 'Try a different search or filter.'
})

watch(recipientFilterContactTypeOptions, (opts) => {
  if (recipientFilterContactTypeFilter.value === 'all') return
  if (!opts.some((o) => o.value === recipientFilterContactTypeFilter.value)) {
    recipientFilterContactTypeFilter.value = 'all'
  }
})

watch(recipientFilterPropertyOptions, (opts) => {
  if (recipientFilterPropertyFilter.value === 'all') return
  if (!opts.some((o) => o.value === recipientFilterPropertyFilter.value)) {
    recipientFilterPropertyFilter.value = 'all'
  }
})

function tenantByDbUrl() {
  return `/api/v1/admin/tenants/db/${encodeURIComponent(dbName.value)}`
}

/** Tenant-scoped admin APIs are keyed by registry tenantId, not URL dbName. */
function tenantApiPrefix(): string | null {
  const id = tenant.value?.tenantId
  if (!id) return null
  return `/api/v1/admin/tenants/${encodeURIComponent(id)}`
}

async function loadTenant() {
  tenantPending.value = true
  tenant.value = null
  try {
    const res = await $fetch<{ tenant: TenantDetail }>(tenantByDbUrl())
    tenant.value = res.tenant
  } catch {
    tenant.value = null
  } finally {
    tenantPending.value = false
  }
}

async function loadFilters() {
  filtersPending.value = true
  const prefix = tenantApiPrefix()
  if (!prefix) {
    filters.value = []
    filtersPending.value = false
    return
  }
  try {
    const res = await $fetch<{ filters: FilterRow[] }>(
      `${prefix}/recipient-filters`
    )
    filters.value = res.filters ?? []
  } catch {
    filters.value = []
  } finally {
    filtersPending.value = false
  }
}

async function loadContactTypes() {
  contactTypesPending.value = true
  const prefix = tenantApiPrefix()
  if (!prefix) {
    contactTypes.value = []
    contactTypesPending.value = false
    return
  }
  try {
    const res = await $fetch<{ contactTypes: ContactTypeRow[] }>(
      `${prefix}/contact-types`
    )
    contactTypes.value = res.contactTypes ?? []
    const first = contactTypes.value[0]
    if (!form.contactType && first) {
      form.contactType = first.key
    }
  } catch {
    contactTypes.value = []
  } finally {
    contactTypesPending.value = false
  }
}

async function loadDynamicVariables() {
  dynamicPending.value = true
  const prefix = tenantApiPrefix()
  if (!prefix) {
    dynamicVariables.value = []
    dynamicPending.value = false
    return
  }
  try {
    const res = await $fetch<{ variables: DynamicVariableRow[] }>(
      `${prefix}/dynamic-variables`
    )
    dynamicVariables.value = res.variables ?? []
  } catch {
    dynamicVariables.value = []
  } finally {
    dynamicPending.value = false
  }
}

function fillForm(f: FilterRow) {
  form.name = f.name
  form.enabled = f.enabled
  form.contactType = f.contactType
  form.property = resolveRecipientFilterPropertyField(f.property)
  form.propertyType = resolveRecipientFilterPropertyType(form.property, f.propertyType)
  form.propertyValue = f.propertyValue ?? ''
  form.valuesFromContacts = f.valuesFromContacts === true
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.contactType = contactTypes.value[0]?.key ?? ''
  form.property = 'none'
  form.propertyType = 'state'
  form.propertyValue = ''
  form.valuesFromContacts = false
  form.enabled = true
  formError.value = ''
}

function openContactTypeModal() {
  resetContactTypeForm()
  contactTypeModalOpen.value = true
}

function closeContactTypeModal() {
  contactTypeModalOpen.value = false
  resetContactTypeForm()
}

function openRecipientFilterModal() {
  resetForm()
  recipientFilterModalOpen.value = true
}

function closeRecipientFilterModal() {
  recipientFilterModalOpen.value = false
  resetForm()
}

function startEditContactType(ct: ContactTypeRow) {
  contactTypeEditingId.value = ct.id
  contactTypeForm.key = ct.key
  contactTypeForm.label = ct.label
  contactTypeForm.enabled = ct.enabled
  contactTypeFormError.value = ''
  contactTypeModalOpen.value = true
}

function resetContactTypeForm() {
  contactTypeEditingId.value = null
  contactTypeForm.key = ''
  contactTypeForm.label = ''
  contactTypeForm.enabled = true
  contactTypeFormError.value = ''
}

function submitContactTypeForm(event: Event) {
  contactTypeFormError.value = ''
  const formEl = event.currentTarget as HTMLFormElement
  if (!formEl.checkValidity()) {
    formEl.reportValidity()
    return
  }
  saveContactType()
}

async function saveContactType() {
  contactTypeFormError.value = ''
  const prefix = tenantApiPrefix()
  if (!prefix) {
    contactTypeFormError.value = 'This tenant has no tenant ID in the registry.'
    return
  }
  if (!contactTypeForm.key.trim()) {
    contactTypeFormError.value = 'Key is required.'
    return
  }
  if (!contactTypeForm.label.trim()) {
    contactTypeFormError.value = 'Label is required.'
    return
  }
  contactTypeSaving.value = true
  try {
    const body = {
      key: contactTypeForm.key.trim(),
      label: contactTypeForm.label.trim(),
      enabled: contactTypeForm.enabled
    }
    if (contactTypeEditingId.value) {
      await $fetch(`${prefix}/contact-types/${contactTypeEditingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      await $fetch(`${prefix}/contact-types`, {
        method: 'POST',
        body
      })
    }
    resetContactTypeForm()
    contactTypeModalOpen.value = false
    await loadContactTypes()
    const first = contactTypes.value[0]
    if (!editingId.value && !form.contactType && first) {
      form.contactType = first.key
    }
  } catch (e: unknown) {
    contactTypeFormError.value = fetchErrorMessage(e, 'Save failed')
  } finally {
    contactTypeSaving.value = false
  }
}

function fillDynamicForm(v: DynamicVariableRow) {
  dynamicForm.key = v.key
  dynamicForm.label = v.label
  dynamicForm.description = v.description ?? ''
  dynamicForm.contactPath = v.contactPath
  dynamicForm.sourceType = v.sourceType === 'user' ? 'user' : 'recipient'
  dynamicForm.scopes = (v.scopes?.length ? [...v.scopes] : ['subject', 'body']) as Array<'subject' | 'body'>
  dynamicForm.enabled = !!v.enabled
  dynamicForm.sortOrder = Number.isFinite(v.sortOrder) ? v.sortOrder : 0
  dynamicForm.fallbackValue = v.fallbackValue ?? ''
  dynamicForm.requiredForSend = !!v.requiredForSend
}

function resetDynamicForm() {
  dynamicEditingId.value = null
  dynamicForm.key = ''
  dynamicForm.label = ''
  dynamicForm.description = ''
  dynamicForm.contactPath = ''
  dynamicForm.sourceType = 'recipient'
  dynamicForm.scopes = ['subject', 'body']
  dynamicForm.enabled = true
  dynamicForm.sortOrder = 0
  dynamicForm.fallbackValue = ''
  dynamicForm.requiredForSend = false
  dynamicFormError.value = ''
}

function startEdit(f: FilterRow) {
  editingId.value = f.id
  fillForm(f)
  formError.value = ''
  recipientFilterModalOpen.value = true
}

function submitFilterForm(event: Event) {
  formError.value = ''
  const formEl = event.currentTarget as HTMLFormElement
  if (!formEl.checkValidity()) {
    formEl.reportValidity()
    return
  }
  saveFilter()
}

async function saveFilter() {
  formError.value = ''
  const prefix = tenantApiPrefix()
  if (!prefix) {
    formError.value = 'This tenant has no tenant ID in the registry.'
    return
  }
  if (!form.name.trim()) {
    formError.value = 'Name is required.'
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      contactType: form.contactType,
      property: form.property,
      propertyType: recipientFilterPropertyTypeForSave(form.property, form.propertyType),
      propertyValue: form.valuesFromContacts ? '' : form.propertyValue,
      valuesFromContacts: form.valuesFromContacts,
      enabled: form.enabled
    }
    if (editingId.value) {
      await $fetch(`${prefix}/recipient-filters/${editingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      await $fetch(`${prefix}/recipient-filters`, {
        method: 'POST',
        body
      })
    }
    resetForm()
    recipientFilterModalOpen.value = false
    await loadFilters()
  } catch (e: unknown) {
    formError.value = fetchErrorMessage(e, 'Save failed')
  } finally {
    saving.value = false
  }
}

function toggleDynamicScope(scope: 'subject' | 'body', checked: boolean) {
  const set = new Set(dynamicForm.scopes)
  if (checked) set.add(scope)
  else set.delete(scope)
  dynamicForm.scopes = [...set] as Array<'subject' | 'body'>
}

function openDynamicVariableModal() {
  resetDynamicForm()
  dynamicVariableModalOpen.value = true
}

function closeDynamicVariableModal() {
  dynamicVariableModalOpen.value = false
  resetDynamicForm()
}

function startEditDynamicVariable(v: DynamicVariableRow) {
  dynamicEditingId.value = v.id
  fillDynamicForm(v)
  dynamicFormError.value = ''
  dynamicVariableModalOpen.value = true
}

function submitDynamicVariableForm(event: Event) {
  dynamicFormError.value = ''
  const formEl = event.currentTarget as HTMLFormElement
  if (!formEl.checkValidity()) {
    formEl.reportValidity()
    return
  }
  saveDynamicVariable()
}

async function saveDynamicVariable() {
  dynamicFormError.value = ''
  const prefix = tenantApiPrefix()
  if (!prefix) {
    dynamicFormError.value = 'This tenant has no tenant ID in the registry.'
    return
  }
  if (!dynamicForm.key.trim()) {
    dynamicFormError.value = 'Key is required.'
    return
  }
  if (!dynamicForm.label.trim()) {
    dynamicFormError.value = 'Label is required.'
    return
  }
  if (!dynamicForm.contactPath.trim()) {
    dynamicFormError.value = 'Contact path is required.'
    return
  }
  dynamicSaving.value = true
  try {
    const body = {
      key: dynamicForm.key.trim(),
      label: dynamicForm.label.trim(),
      description: dynamicForm.description.trim(),
      contactPath: dynamicForm.contactPath.trim(),
      sourceType: dynamicForm.sourceType,
      scopes: dynamicForm.scopes,
      enabled: dynamicForm.enabled,
      sortOrder: Number(dynamicForm.sortOrder) || 0,
      fallbackValue: dynamicForm.fallbackValue.trim(),
      requiredForSend: dynamicForm.requiredForSend
    }
    if (dynamicEditingId.value) {
      await $fetch(`${prefix}/dynamic-variables/${dynamicEditingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      await $fetch(`${prefix}/dynamic-variables`, {
        method: 'POST',
        body
      })
    }
    resetDynamicForm()
    dynamicVariableModalOpen.value = false
    await loadDynamicVariables()
  } catch (e: unknown) {
    dynamicFormError.value = fetchErrorMessage(e, 'Save failed')
  } finally {
    dynamicSaving.value = false
  }
}

type DeleteKind = 'filter' | 'contactType' | 'dynamicVariable'

interface DeletePending {
  kind: DeleteKind
  id: string
}

const deletePending = ref<DeletePending | null>(null)
const deleteConfirmLoading = ref(false)

const deleteModalTitle = computed(() => {
  if (!deletePending.value) return ''
  const titles: Record<DeleteKind, string> = {
    filter: 'Delete recipient filter',
    contactType: 'Delete contact type',
    dynamicVariable: 'Delete dynamic variable'
  }
  return titles[deletePending.value.kind]
})

const deleteModalMessage = computed(() => {
  const pending = deletePending.value
  if (!pending) return ''
  if (pending.kind === 'filter') {
    const row = filters.value.find((f) => f.id === pending.id)
    return row
      ? `Permanently delete “${row.name}”? This cannot be undone.`
      : 'Delete this recipient filter? This cannot be undone.'
  }
  if (pending.kind === 'contactType') {
    const row = contactTypes.value.find((ct) => ct.id === pending.id)
    return row
      ? `Permanently delete “${row.label}”? This cannot be undone.`
      : 'Delete this contact type? This cannot be undone.'
  }
  const row = dynamicVariables.value.find((v) => v.id === pending.id)
  return row
    ? `Permanently delete “${row.label}”? This cannot be undone.`
    : 'Delete this dynamic variable? This cannot be undone.'
})

function openDeleteModal(kind: DeleteKind, id: string) {
  deletePending.value = { kind, id }
}

function cancelDeleteModal() {
  if (deleteConfirmLoading.value) return
  deletePending.value = null
}

async function confirmDelete() {
  const pending = deletePending.value
  if (!pending || deleteConfirmLoading.value) return
  deleteConfirmLoading.value = true
  try {
    if (pending.kind === 'filter') {
      await removeFilter(pending.id)
    } else if (pending.kind === 'contactType') {
      await removeContactType(pending.id)
    } else {
      await removeDynamicVariable(pending.id)
    }
    deletePending.value = null
  } finally {
    deleteConfirmLoading.value = false
  }
}

async function removeFilter(id: string) {
  const prefix = tenantApiPrefix()
  if (!prefix) return
  deletingId.value = id
  try {
    await $fetch(`${prefix}/recipient-filters/${id}`, { method: 'DELETE' })
    if (editingId.value === id) resetForm()
    await loadFilters()
  } finally {
    deletingId.value = null
  }
}

async function removeContactType(id: string) {
  const prefix = tenantApiPrefix()
  if (!prefix) return
  contactTypeDeletingId.value = id
  try {
    await $fetch(`${prefix}/contact-types/${id}`, { method: 'DELETE' })
    if (contactTypeEditingId.value === id) resetContactTypeForm()
    await loadContactTypes()
    if (!contactTypes.value.some((ct) => ct.key === form.contactType)) {
      form.contactType = contactTypes.value[0]?.key ?? ''
    }
  } finally {
    contactTypeDeletingId.value = null
  }
}

async function removeDynamicVariable(id: string) {
  const prefix = tenantApiPrefix()
  if (!prefix) return
  dynamicDeletingId.value = id
  try {
    await $fetch(`${prefix}/dynamic-variables/${id}`, { method: 'DELETE' })
    if (dynamicEditingId.value === id) resetDynamicForm()
    await loadDynamicVariables()
  } finally {
    dynamicDeletingId.value = null
  }
}

watch(
  dbName,
  async (name) => {
    if (!name) return
    await loadTenant()
    await loadContactTypes()
    await loadFilters()
    await loadDynamicVariables()
  },
  { immediate: true }
)
</script>

<style scoped>
.tab-list {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-list::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  padding: 0.65rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: 0.5rem 0.5rem 0 0;
  transition: color 0.15s ease, background-color 0.15s ease;
}

@media (min-width: 640px) {
  .tab-btn {
    padding: 0.65rem 1.1rem;
    font-size: 0.9375rem;
  }
}

.tab-btn:hover {
  color: #0f172a;
  background: #f8fafc;
}

.tab-btn--active {
  border-bottom-color: #4f46e5;
  color: #4f46e5;
  background: #fafaff;
}
</style>
