<script lang="ts">
/** Shared with `admin/tenants/[dbName].vue` recipient filter form. */
export const recipientFilterPropertyFieldOptions = [
  { value: 'none', label: 'None' },
  { value: 'address', label: 'Address' },
  { value: 'channel', label: 'Channel' },
  { value: 'company', label: 'Company' },
  { value: 'contact_profile', label: 'Contact profile' }
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

export type RecipientFilterPropertyFieldValue =
  (typeof recipientFilterPropertyFieldOptions)[number]['value']

export type RecipientFilterAddressPropertyTypeValue =
  (typeof recipientFilterAddressPropertyTypeOptions)[number]['value']

export type RecipientFilterContactProfilePropertyTypeValue =
  (typeof recipientFilterContactProfilePropertyTypeOptions)[number]['value']
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
  gap: 1.15rem;
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
  border-color: #c7d2fe;
  border-bottom-color: #4f46e5;
  color: #4338ca;
  background: #eef2ff;
}
</style>
