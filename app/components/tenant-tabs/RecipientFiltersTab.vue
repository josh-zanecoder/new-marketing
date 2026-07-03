<script lang="ts">
/** Shared with `admin/tenants/[dbName].vue` recipient filter form. */
export const recipientFilterPropertyFieldOptions = [
  { value: 'none', label: 'None' },
  { value: 'address', label: 'Address' },
  { value: 'channel', label: 'Channel' },
  { value: 'company', label: 'Company' },
  { value: 'status', label: 'Status' },
  { value: 'stage', label: 'Stage' },
  { value: 'contact_profile', label: 'Contact profile' },
  { value: 'relationship_partner', label: 'Relationship partner' }
] as const

export const recipientFilterAddressPropertyTypeOptions = [
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'county', label: 'County' },
  { value: 'street', label: 'Street' }
] as const

/** When property is Contact profile (same pattern as address + state/city/…). */
export const recipientFilterContactProfilePropertyTypeOptions = [
  { value: 'profile_type', label: 'Type' },
  { value: 'profile_subtype', label: 'Sub Type' }
] as const

/** When property is Relationship partner (agent linkage). */
export const recipientFilterRelationshipPartnerPropertyTypeOptions = [
  { value: 'partner_email', label: 'Partner email' },
  { value: 'partner_external_id', label: 'Partner external ID' },
  { value: 'partner_owner_email', label: 'Partner owner email' },
  { value: 'partner_name', label: 'Partner name' }
] as const

export type RecipientFilterPropertyFieldValue =
  (typeof recipientFilterPropertyFieldOptions)[number]['value']

export type RecipientFilterAddressPropertyTypeValue =
  (typeof recipientFilterAddressPropertyTypeOptions)[number]['value']

export type RecipientFilterContactProfilePropertyTypeValue =
  (typeof recipientFilterContactProfilePropertyTypeOptions)[number]['value']

export type RecipientFilterRelationshipPartnerPropertyTypeValue =
  (typeof recipientFilterRelationshipPartnerPropertyTypeOptions)[number]['value']

/** Shared table classes for filter tabs (used in admin tenant detail slots). */
export const recipientFiltersRecordListClass = 'rf-record-list lg:hidden'

export const recipientFiltersDataViewTableClass = 'rf-data-view__table hidden lg:block'

export const recipientFiltersTableWrapClass =
  'rf-table-card overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]'

export const recipientFiltersTableClass = 'rf-table rf-table--wide w-full border-collapse text-left text-sm text-slate-900'

export const recipientFiltersTableClassCompact = 'rf-table rf-table--compact w-full border-collapse text-left text-sm text-slate-900'

export const recipientFiltersTableClassTenants =
  'rf-table rf-table--tenants w-full border-collapse text-left text-sm text-slate-900'

export const recipientFiltersThActionsClass = 'rf-table__th rf-table__th--actions'

export const recipientFiltersTdActionsClass = 'rf-table__td rf-table__td--actions'

export { TENANT_TAB_CELL_CHAR_LIMIT, truncateTabCellText } from '~/utils/truncateTabCellText'
</script>

<template>
  <section class="rf-shell">
    <div class="rf-intro">
      <div class="rf-intro__badge">Recipient Rules</div>
      <h2 class="rf-intro__title">Build and manage recipient filters</h2>
      <p class="rf-intro__text">
        Each row is stored by <strong>tenant ID</strong>. Set a <strong>contact type</strong>, then optionally add a
        <strong>property</strong>. For <strong>Address</strong> or <strong>Contact profile</strong>, pick a
        <strong>property type</strong> (e.g. state vs city, or type vs sub type), then enter
        <strong>property values</strong> — separate multiple keys with commas or new lines.
      </p>
    </div>

    <div class="rf-subtabs">
      <button
        type="button"
        class="rf-subtabs__btn"
        :class="{ 'rf-subtabs__btn--active': activeTab === 'contactTypes' }"
        @click="activeTab = 'contactTypes'"
      >
        Contact Types
      </button>
      <button
        type="button"
        class="rf-subtabs__btn"
        :class="{ 'rf-subtabs__btn--active': activeTab === 'recipientFilters' }"
        @click="activeTab = 'recipientFilters'"
      >
        Recipient Filters
      </button>
    </div>

    <div v-show="activeTab === 'contactTypes'" class="rf-content">
      <slot name="contact-types" />
    </div>

    <div v-show="activeTab === 'recipientFilters'" class="rf-content">
      <slot name="recipient-filters" />
    </div>
  </section>
</template>

<script setup lang="ts">
const activeTab = ref<'contactTypes' | 'recipientFilters'>('recipientFilters')
</script>

<style scoped>
.rf-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rf-intro {
  border: 1px solid #e2e8f0;
  border-radius: 0.9rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  padding: 1rem 1.15rem;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.rf-intro__badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.18rem 0.5rem;
  margin-bottom: 0.45rem;
}

.rf-intro__title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  line-height: 1.3;
  color: #0f172a;
}

.rf-intro__text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: #475569;
}

.rf-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.rf-subtabs {
  display: flex;
  gap: 0.4rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.15rem;
}

.rf-subtabs__btn {
  border: 1px solid transparent;
  border-bottom: 2px solid transparent;
  border-radius: 0.55rem 0.55rem 0 0;
  padding: 0.5rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}

.rf-subtabs__btn:hover {
  color: #334155;
  background: #f8fafc;
}

.rf-subtabs__btn--active {
  border-color: #bfdbfe;
  border-bottom-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

@media (max-width: 425px) {
  .rf-intro {
    padding: 0.75rem 0.85rem;
  }

  .rf-intro__badge {
    font-size: 0.625rem;
    padding: 0.12rem 0.4rem;
    margin-bottom: 0.35rem;
  }

  .rf-intro__title {
    font-size: 0.875rem;
  }

  .rf-intro__text {
    font-size: 0.75rem;
    line-height: 1.45;
  }

  .rf-subtabs__btn {
    padding: 0.4rem 0.55rem;
    font-size: 0.75rem;
  }
}
</style>
