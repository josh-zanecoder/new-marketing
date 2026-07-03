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
                  {{ contactTypes.length }} {{ contactTypes.length === 1 ? 'type' : 'types' }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-start">
                <span v-if="contactTypesPending" class="text-sm font-medium text-slate-500">Loading…</span>
                <button
                  type="button"
                  class="btn-cta group self-start"
                  @click="openContactTypeModal"
                >
                  <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                class="btn-cta group mt-6"
                @click="openContactTypeModal"
              >
                <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add contact type
              </button>
            </div>

            <div v-else>
              <div :class="tenantRecordListClass">
                <UiRfRecordCard
                  v-for="ct in contactTypes"
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

                  <UiRfRecordField label="Key">
                    <UiRfTableCellText :text="ct.key" monospace />
                  </UiRfRecordField>
                  <UiRfRecordField label="Label">
                    <UiRfTableCellText :text="ct.label" />
                  </UiRfRecordField>

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
                      <tr v-for="ct in contactTypes" :key="`row-${ct.id}`">
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
            </div>

          <Teleport to="body">
            <div
              v-if="contactTypeModalOpen"
              class="filter-modal-backdrop"
              @click.self="closeContactTypeModal"
            >
              <div
                class="filter-modal"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="contactTypeEditingId ? 'ct-modal-title-edit' : 'ct-modal-title-add'"
              >
                <div class="filter-modal__header">
                  <div>
                    <h2
                      :id="contactTypeEditingId ? 'ct-modal-title-edit' : 'ct-modal-title-add'"
                      class="filter-form-title"
                    >
                      {{ contactTypeEditingId ? 'Edit Contact Type' : 'Add Contact Type' }}
                    </h2>
                    <p v-if="contactTypeEditingId" class="filter-form-hint">
                      Update the selected contact type.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="filter-modal__close"
                    aria-label="Close"
                    @click="closeContactTypeModal"
                  >
                    <svg class="filter-modal__close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="filter-modal__form filter-form" @submit.prevent="submitContactTypeForm">
                  <div class="filter-modal__body">
                    <div class="field">
                      <label for="ct-key">
                        Key
                        <span class="field-required" aria-hidden="true">*</span>
                      </label>
                      <input id="ct-key" v-model="contactTypeForm.key" type="text" required aria-required="true" class="field-input" placeholder="e.g. prospect">
                    </div>
                    <div class="field">
                      <label for="ct-label">
                        Label
                        <span class="field-required" aria-hidden="true">*</span>
                      </label>
                      <input id="ct-label" v-model="contactTypeForm.label" type="text" required aria-required="true" class="field-input" placeholder="e.g. Prospect">
                    </div>
                    <label class="toggle-row">
                      <input v-model="contactTypeForm.enabled" type="checkbox" class="toggle-check">
                      <span class="toggle-label">Enabled</span>
                    </label>
                    <p v-if="contactTypeFormError" class="form-error">{{ contactTypeFormError }}</p>
                  </div>
                  <div class="filter-modal__footer modal-footer">
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
                  {{ filters.length }} {{ filters.length === 1 ? 'filter' : 'filters' }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-3 self-start">
                <span v-if="filtersPending" class="text-sm font-medium text-slate-500">Loading…</span>
                <button
                  type="button"
                  class="btn-cta group self-start"
                  @click="openRecipientFilterModal"
                >
                  <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              v-else-if="!filtersDisplay.length"
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
                class="btn-cta group mt-6"
                @click="openRecipientFilterModal"
              >
                <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Filter
              </button>
            </div>

            <div v-else>
              <div :class="tenantRecordListClass">
                <UiRfRecordCard
                  v-for="f in filtersDisplay"
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

                  <UiRfRecordField label="Contact type">
                    {{ contactTypeTableLabel(f.contactType) }}
                  </UiRfRecordField>
                  <UiRfRecordField label="Property">
                    {{ propertyFieldLabel(f.property) }}
                  </UiRfRecordField>
                  <UiRfRecordField label="Type">
                    {{
                      f.property === 'address'
                        ? addressPropertyTypeLabel(f.propertyType || 'state')
                        : f.property === 'contact_profile'
                          ? contactProfilePropertyTypeLabel(f.propertyType || 'profile_type')
                          : f.property === 'relationship_partner'
                            ? relationshipPartnerPropertyTypeLabel(f.propertyType || 'partner_email')
                            : '—'
                    }}
                  </UiRfRecordField>
                  <UiRfRecordField label="Values" full-width>
                    <UiRfTableCellChips
                      :items="f.valueTokens"
                      :format-item="formatRegistryLabelForDisplay"
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
                        <th>Values</th>
                        <th>Status</th>
                        <th :class="tenantDataThActionsClass">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="f in filtersDisplay" :key="`row-${f.id}`">
                        <td class="td-name">
                          <UiRfTableCellText :text="f.name" />
                        </td>
                        <td class="td-contact">{{ contactTypeTableLabel(f.contactType) }}</td>
                        <td class="td-muted">{{ propertyFieldLabel(f.property) }}</td>
                        <td class="td-muted">
                          {{
                            f.property === 'address'
                              ? addressPropertyTypeLabel(f.propertyType || 'state')
                              : f.property === 'contact_profile'
                                ? contactProfilePropertyTypeLabel(f.propertyType || 'profile_type')
                                : f.property === 'relationship_partner'
                                  ? relationshipPartnerPropertyTypeLabel(f.propertyType || 'partner_email')
                                  : '—'
                          }}
                        </td>
                        <td class="td-values">
                          <UiRfTableCellChips
                            :items="f.valueTokens"
                            :format-item="formatRegistryLabelForDisplay"
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
            </div>

          <Teleport to="body">
            <div
              v-if="recipientFilterModalOpen"
              class="filter-modal-backdrop"
              @click.self="closeRecipientFilterModal"
            >
              <div
                class="filter-modal filter-modal--wide"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="editingId ? 'rf-modal-title-edit' : 'rf-modal-title-add'"
              >
                <div class="filter-modal__header">
                  <div>
                    <h2
                      :id="editingId ? 'rf-modal-title-edit' : 'rf-modal-title-add'"
                      class="filter-form-title"
                    >
                      {{ editingId ? 'Edit Filter' : 'Add Filter' }}
                    </h2>
                    <p v-if="editingId" class="filter-form-hint">
                      Updating the selected filter.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="filter-modal__close"
                    aria-label="Close"
                    @click="closeRecipientFilterModal"
                  >
                    <svg class="filter-modal__close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="filter-modal__form filter-form" @submit.prevent="submitFilterForm">
                  <div class="filter-modal__body">
                  <div class="field">
                    <label for="rf-name">
                      Name
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="rf-name"
                      v-model="form.name"
                      type="text"
                      required
                      aria-required="true"
                      class="field-input"
                      placeholder="e.g. Texas prospects"
                    >
                  </div>

                  <div class="field">
                    <label for="rf-contact-type">Contact type</label>
                    <select
                      id="rf-contact-type"
                      v-model="form.contactType"
                      class="field-input"
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

                  <div class="field">
                    <label for="rf-property">Property</label>
                    <select
                      id="rf-property"
                      v-model="form.property"
                      class="field-input"
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

                  <div v-if="form.property === 'address'" class="field">
                    <label for="rf-property-type">Property type</label>
                    <select
                      id="rf-property-type"
                      v-model="form.propertyType"
                      class="field-input"
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

                  <div v-else-if="form.property === 'contact_profile'" class="field">
                    <label for="rf-contact-profile-type">Type or sub type</label>
                    <select
                      id="rf-contact-profile-type"
                      v-model="form.propertyType"
                      class="field-input"
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

                  <div v-else-if="form.property === 'relationship_partner'" class="field">
                    <label for="rf-relationship-partner-type">Partner field</label>
                    <select
                      id="rf-relationship-partner-type"
                      v-model="form.propertyType"
                      class="field-input"
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

                  <div class="field">
                    <label for="rf-property-value">Property value</label>
                    <input
                      id="rf-property-value"
                      v-model="form.propertyValue"
                      type="text"
                      class="field-input"
                      placeholder="Optional — e.g. TX or AL, AK, AZ"
                    >
                  </div>

                  <label class="toggle-row">
                    <input v-model="form.enabled" type="checkbox" class="toggle-check">
                    <span class="toggle-label">Enabled</span>
                  </label>

                  <p v-if="formError" class="form-error">{{ formError }}</p>
                  </div>

                  <div class="filter-modal__footer modal-footer">
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
                class="btn-cta group self-start"
                @click="openDynamicVariableModal"
              >
                <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              class="btn-cta group mt-6"
              @click="openDynamicVariableModal"
            >
              <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Dynamic Variable
            </button>
          </div>

          <div v-else>
            <div :class="tenantRecordListClass">
              <UiRfRecordCard
                v-for="v in dynamicVariables"
                :key="`card-${v.id}`"
              >
                <template #header>
                  <div class="rf-record-card__title">
                    <UiRfTableCellText
                      :text="v.label"
                      :limit="mobileRecordFieldCharLimit"
                    />
                  </div>
                  <div class="rf-record-card__subtitle">
                    <UiRfTableCellText
                      :text="v.key"
                      monospace
                      :limit="mobileRecordFieldCharLimit"
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
                    :limit="mobileRecordFieldCharLimit"
                  />
                </UiRfRecordField>
                <UiRfRecordField label="Contact path">
                  <UiRfTableCellText :text="v.contactPath" monospace />
                </UiRfRecordField>
                <UiRfRecordField label="Scopes" full-width>
                  <UiRfTableCellChips :items="v.scopes" />
                </UiRfRecordField>
                <UiRfRecordField label="Fallback">
                  <UiRfTableCellText :text="v.fallbackValue" />
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
                <table :class="tenantDataTableClass">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Key</th>
                      <th>Contact path</th>
                      <th>Scopes</th>
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
                        <UiRfTableCellText :text="v.label" />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.key" monospace />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.contactPath" monospace />
                      </td>
                      <td class="td-values">
                        <UiRfTableCellChips :items="v.scopes" />
                      </td>
                      <td class="td-muted">
                        <UiRfTableCellText :text="v.fallbackValue" />
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
              class="filter-modal-backdrop"
              @click.self="closeDynamicVariableModal"
            >
              <div
                class="filter-modal filter-modal--wide"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="dynamicEditingId ? 'dv-modal-title-edit' : 'dv-modal-title-add'"
              >
                <div class="filter-modal__header">
                  <div>
                    <h2
                      :id="dynamicEditingId ? 'dv-modal-title-edit' : 'dv-modal-title-add'"
                      class="filter-form-title"
                    >
                      {{ dynamicEditingId ? 'Edit Dynamic Variable' : 'Add Dynamic Variable' }}
                    </h2>
                    <p v-if="dynamicEditingId" class="filter-form-hint">
                      Updating the selected variable.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn-modal-close"
                    aria-label="Close"
                    @click="closeDynamicVariableModal"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form class="filter-modal__form filter-form" @submit.prevent="submitDynamicVariableForm">
                  <div class="filter-modal__body">
                  <div class="field">
                    <label for="dv-key">
                      Key
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input id="dv-key" v-model="dynamicForm.key" type="text" required aria-required="true" class="field-input" placeholder="e.g. user.firstName">
                  </div>

                  <div class="field">
                    <label for="dv-label">
                      Label
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input id="dv-label" v-model="dynamicForm.label" type="text" required aria-required="true" class="field-input" placeholder="e.g. First name">
                  </div>

                  <div class="field">
                    <label for="dv-contact-path">
                      Contact path
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input id="dv-contact-path" v-model="dynamicForm.contactPath" type="text" required aria-required="true" class="field-input" placeholder="e.g. firstName or address.state">
                  </div>

                  <div class="field">
                    <label for="dv-source-type">Variable source</label>
                    <select id="dv-source-type" v-model="dynamicForm.sourceType" class="field-input">
                      <option value="recipient">Recipient</option>
                      <option value="user">User</option>
                    </select>
                  </div>

                  <div class="field">
                    <label for="dv-description">Description</label>
                    <input id="dv-description" v-model="dynamicForm.description" type="text" class="field-input" placeholder="Optional">
                  </div>

                  <div class="field">
                    <label for="dv-fallback">
                      Fallback value
                      <span class="field-required" aria-hidden="true">*</span>
                    </label>
                    <input id="dv-fallback" v-model="dynamicForm.fallbackValue" type="text" required aria-required="true" class="field-input" placeholder="e.g. N/A">
                    <p class="filter-form-hint">
                      Per-tenant default when the contact has no AE (or recipient field is blank).
                    </p>
                  </div>

                  <div class="field">
                    <label for="dv-sort">Sort order</label>
                    <input id="dv-sort" v-model.number="dynamicForm.sortOrder" type="number" class="field-input" min="0" step="1">
                  </div>

                  <div class="field">
                    <label>Scopes</label>
                    <div class="flex gap-3">
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

                  <label class="toggle-row">
                    <input v-model="dynamicForm.enabled" type="checkbox" class="toggle-check">
                    <span class="toggle-label">Enabled</span>
                  </label>

                  <label class="toggle-row">
                    <input v-model="dynamicForm.requiredForSend" type="checkbox" class="toggle-check">
                    <span class="toggle-label">Required for send</span>
                  </label>

                  <p v-if="dynamicFormError" class="form-error">{{ dynamicFormError }}</p>
                  </div>

                  <div class="filter-modal__footer modal-footer">
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
  recipientFiltersRecordListClass,
  recipientFiltersDataViewTableClass,
  recipientFiltersTableWrapClass,
  recipientFiltersTableClass,
  recipientFiltersTableClassCompact,
  recipientFiltersThActionsClass,
  recipientFiltersTdActionsClass,
  type RecipientFilterAddressPropertyTypeValue,
  type RecipientFilterContactProfilePropertyTypeValue,
  type RecipientFilterPropertyFieldValue,
  type RecipientFilterRelationshipPartnerPropertyTypeValue
} from '~/components/tenant-tabs/RecipientFiltersTab.vue'
import { formatRegistryLabelForDisplay } from '~/utils/registryLabelDisplay'
import { MOBILE_RECORD_FIELD_CHAR_LIMIT } from '~/utils/truncateTabCellText'

definePageMeta({ layout: 'admin' })

const mobileRecordFieldCharLimit = MOBILE_RECORD_FIELD_CHAR_LIMIT

const tenantRecordListClass = recipientFiltersRecordListClass
const tenantDataViewTableClass = recipientFiltersDataViewTableClass
const tenantDataTableWrapClass = recipientFiltersTableWrapClass
const tenantDataTableClass = recipientFiltersTableClass
const tenantDataTableClassCompact = recipientFiltersTableClassCompact
const tenantDataThActionsClass = recipientFiltersThActionsClass
const tenantDataTdActionsClass = recipientFiltersTdActionsClass

const route = useRoute()
const dbName = computed(() =>
  decodeURIComponent(String(route.params.dbName || ''))
)

const tab = ref<'overview' | 'filters' | 'dynamicVariables'>('overview')

interface ContactTypeRow {
  id: string
  key: string
  label: string
  enabled: boolean
  sortOrder: number
}

type PropertyFieldValue = RecipientFilterPropertyFieldValue
type AddressPropertyTypeValue = RecipientFilterAddressPropertyTypeValue
type ContactProfilePropertyTypeValue = RecipientFilterContactProfilePropertyTypeValue
type RelationshipPartnerPropertyTypeValue = RecipientFilterRelationshipPartnerPropertyTypeValue

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
}

interface FilterRow {
  id: string
  tenantId: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
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

function propertyValueTokens(raw: string | null | undefined): string[] {
  if (raw == null || !String(raw).trim()) return []
  return String(raw)
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const filtersDisplay = computed(() =>
  filters.value.map((f) => ({
    ...f,
    valueTokens: propertyValueTokens(f.propertyValue)
  }))
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
  property: 'none' as PropertyFieldValue,
  propertyType: 'state' as
    | AddressPropertyTypeValue
    | ContactProfilePropertyTypeValue
    | RelationshipPartnerPropertyTypeValue,
  propertyValue: '',
  enabled: true
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
  (p) => {
    if (p === 'address') {
      const ok = recipientFilterAddressPropertyTypeOptions.some((o) => o.value === form.propertyType)
      if (!ok) form.propertyType = 'state'
    } else if (p === 'contact_profile') {
      const ok = recipientFilterContactProfilePropertyTypeOptions.some((o) => o.value === form.propertyType)
      if (!ok) form.propertyType = 'profile_type'
    } else if (p === 'relationship_partner') {
      const ok = recipientFilterRelationshipPartnerPropertyTypeOptions.some(
        (o) => o.value === form.propertyType
      )
      if (!ok) form.propertyType = 'partner_email'
    }
  }
)

function propertyFieldLabel(value: string): string {
  const opt = recipientFilterPropertyFieldOptions.find((o) => o.value === value)
  return opt?.label ?? formatRegistryLabelForDisplay(value)
}

function addressPropertyTypeLabel(value: string): string {
  const opt = recipientFilterAddressPropertyTypeOptions.find((o) => o.value === value)
  return opt?.label ?? formatRegistryLabelForDisplay(value)
}

function contactProfilePropertyTypeLabel(value: string): string {
  const opt = recipientFilterContactProfilePropertyTypeOptions.find((o) => o.value === value)
  return opt?.label ?? formatRegistryLabelForDisplay(value)
}

function relationshipPartnerPropertyTypeLabel(value: string): string {
  const opt = recipientFilterRelationshipPartnerPropertyTypeOptions.find((o) => o.value === value)
  return opt?.label ?? formatRegistryLabelForDisplay(value)
}

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

function tenantByDbUrl() {
  return `/api/v1/admin/tenants/db/${encodeURIComponent(dbName.value)}`
}

/** Recipient-filter APIs are keyed by registry tenantId, not URL dbName. */
function filtersApiPrefix(): string | null {
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
  const prefix = filtersApiPrefix()
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
  const prefix = filtersApiPrefix()
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

function dynamicApiPrefix(): string | null {
  const id = tenant.value?.tenantId
  if (!id) return null
  return `/api/v1/admin/tenants/${encodeURIComponent(id)}`
}

async function loadDynamicVariables() {
  dynamicPending.value = true
  const prefix = dynamicApiPrefix()
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
  form.property = (recipientFilterPropertyFieldOptions as readonly { value: string }[]).some(
    (o) => o.value === f.property
  )
    ? (f.property as PropertyFieldValue)
    : 'none'
  if (form.property === 'address') {
    const t = f.propertyType
    form.propertyType = (recipientFilterAddressPropertyTypeOptions as readonly { value: string }[]).some(
      (o) => o.value === t
    )
      ? (t as AddressPropertyTypeValue)
      : 'state'
  } else if (form.property === 'contact_profile') {
    const t = f.propertyType
    form.propertyType = (recipientFilterContactProfilePropertyTypeOptions as readonly { value: string }[]).some(
      (o) => o.value === t
    )
      ? (t as ContactProfilePropertyTypeValue)
      : 'profile_type'
  } else if (form.property === 'relationship_partner') {
    const t = f.propertyType
    form.propertyType = (recipientFilterRelationshipPartnerPropertyTypeOptions as readonly {
      value: string
    }[]).some((o) => o.value === t)
      ? (t as RelationshipPartnerPropertyTypeValue)
      : 'partner_email'
  } else {
    form.propertyType = 'state'
  }
  form.propertyValue = f.propertyValue ?? ''
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.contactType = contactTypes.value[0]?.key ?? ''
  form.property = 'none'
  form.propertyType = 'state'
  form.propertyValue = ''
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
  const prefix = filtersApiPrefix()
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
    const msg =
      e &&
      typeof e === 'object' &&
      'data' in e &&
      e.data &&
      typeof e.data === 'object' &&
      'message' in e.data
        ? String((e.data as { message?: string }).message)
        : 'Save failed'
    contactTypeFormError.value = msg
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
  const prefix = filtersApiPrefix()
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
      propertyType:
        form.property === 'address' ||
        form.property === 'contact_profile' ||
        form.property === 'relationship_partner'
          ? form.propertyType
          : 'none',
      propertyValue: form.propertyValue,
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
    const msg =
      e &&
      typeof e === 'object' &&
      'data' in e &&
      e.data &&
      typeof e.data === 'object' &&
      'message' in e.data
        ? String((e.data as { message?: string }).message)
        : 'Save failed'
    formError.value = msg
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
  const prefix = dynamicApiPrefix()
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
  if (!dynamicForm.fallbackValue.trim()) {
    dynamicFormError.value = 'Fallback value is required.'
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
    const msg =
      e &&
      typeof e === 'object' &&
      'data' in e &&
      e.data &&
      typeof e.data === 'object' &&
      'message' in e.data
        ? String((e.data as { message?: string }).message)
        : 'Save failed'
    dynamicFormError.value = msg
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
  const prefix = filtersApiPrefix()
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
  const prefix = filtersApiPrefix()
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
  const prefix = dynamicApiPrefix()
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

.filters-split {
  display: grid;
  gap: 1.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .filters-split {
    grid-template-columns: minmax(16rem, 20rem) minmax(32rem, 1fr);
    gap: 1.75rem;
  }
}

.filter-form-card {
  position: relative;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 1.35rem 1.35rem 1.5rem;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
}

@media (min-width: 1024px) {
  .filter-form-card {
    position: sticky;
    top: 1.25rem;
  }
}

.filter-form-title {
  margin: 0 0 0.35rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: #0f172a;
}

.filter-form-hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.4;
}

.filter-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field > label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
}

.field-required {
  margin-left: 0.15rem;
  color: #dc2626;
  font-weight: 700;
}

.field-input {
  width: 100%;
  border-radius: 0.625rem;
  border: 1px solid #e2e8f0;
  padding: 0.55rem 0.75rem;
  font-size: 0.9375rem;
  color: #0f172a;
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field-input:hover {
  border-color: #cbd5e1;
}

.field-input:focus {
  outline: none;
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
}

.field .toggle-row {
  margin-bottom: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.toggle-check {
  width: 1rem;
  height: 1rem;
  min-width: 1rem;
  min-height: 1rem;
  flex-shrink: 0;
  margin: 0;
  border-radius: 0.25rem;
  border-color: #cbd5e1;
  accent-color: #2563eb;
}

.toggle-label {
  user-select: none;
}

.form-error {
  margin: 0;
  font-size: 0.875rem;
  color: #dc2626;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  border: none;
  background: #0f172a;
  color: #fff;
  padding: 0.55rem 1.15rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #1e293b;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  padding: 0.55rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.btn-secondary:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.btn-primary--compact {
  padding: 0.45rem 0.9rem;
  font-size: 0.8125rem;
}

.filter-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(15 23 42 / 0.4);
  backdrop-filter: blur(4px);
}

.filter-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 28rem;
  max-height: min(90vh, 42rem);
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 20px 50px rgb(15 23 42 / 0.18);
}

.filter-modal--wide {
  max-width: 32rem;
}

.filter-modal__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 1.35rem 0.75rem;
}

.filter-modal__form {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.filter-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.35rem 0.5rem;
  -webkit-overflow-scrolling: touch;
}

.filter-modal__footer {
  flex-shrink: 0;
  padding: 0 1.35rem 1.35rem;
  background: #fff;
}

.filter-modal__footer.modal-footer {
  margin-top: 0;
  padding-top: 1rem;
}
</style>
