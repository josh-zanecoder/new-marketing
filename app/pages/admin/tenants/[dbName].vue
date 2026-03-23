<template>
  <section class="admin-page">
    <nav class="mb-4 text-sm text-slate-500">
      <NuxtLink to="/admin/tenants" class="hover:text-indigo-600">
        Tenants
      </NuxtLink>
      <span class="mx-1.5">/</span>
      <span class="text-slate-800">{{ tenant?.name || dbName }}</span>
    </nav>

    <header v-if="tenant" class="page-header">
      <h1>{{ tenant.name }}</h1>
      <p class="text-slate-500">
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
      </div>

      <div v-show="tab === 'overview'" class="overview-card">
        <dl class="overview-grid">
          <div class="overview-item">
            <dt>Email</dt>
            <dd>{{ tenant.email || '—' }}</dd>
          </div>
          <div class="overview-item">
            <dt>Tenant ID</dt>
            <dd class="font-mono text-xs">{{ tenant.tenantId || '—' }}</dd>
          </div>
          <div class="overview-item">
            <dt>API key prefix</dt>
            <dd class="font-mono text-xs">{{ tenant.apiKeyPrefix || '—' }}</dd>
          </div>
          <div class="overview-item">
            <dt>Created</dt>
            <dd>{{ tenant.createdAt }}</dd>
          </div>
        </dl>
      </div>

      <div v-show="tab === 'filters'" class="filters-tab">
        <div class="filters-intro">
          <p>
            Each row is stored by <strong>tenant ID</strong>. The main rule is <strong>contact type</strong>; then optionally a
            <strong>property</strong> (e.g. address), an address <strong>property type</strong> (e.g. state) when relevant, and a
            <strong>property value</strong> (leave blank if not needed). Separate multiple values with commas or new lines.
          </p>
        </div>

        <div
          v-if="tenant && !tenant.tenantId"
          class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          This tenant has no <strong>tenant ID</strong> in the registry. Set one on the client record before creating recipient filters.
        </div>

        <div class="filters-split">
          <aside class="filter-form-card">
            <h2 class="filter-form-title">
              {{ editingId ? 'Edit filter' : 'New filter' }}
            </h2>
            <p v-if="editingId" class="filter-form-hint">
              Updating the selected filter. Cancel to create a new one.
            </p>
            <form class="filter-form" @submit.prevent="saveFilter">
              <div class="field">
                <label for="rf-name">Name</label>
                <input
                  id="rf-name"
                  v-model="form.name"
                  type="text"
                  required
                  class="field-input"
                  placeholder="e.g. Texas prospects"
                >
              </div>

              <div class="field">
                <label for="rf-contact-type">Contact type</label>
                <select
                  id="rf-contact-type"
                  v-model="form.contactType"
                  class="field-input capitalize"
                >
                  <option
                    v-for="k in contactTypes"
                    :key="k"
                    :value="k"
                  >
                    {{ k }}
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
                    v-for="opt in propertyFieldOptions"
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
                    v-for="opt in addressPropertyTypeOptions"
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

              <div class="form-actions">
                <button
                  type="submit"
                  class="btn-primary"
                  :disabled="saving"
                >
                  {{ saving ? 'Saving…' : editingId ? 'Update' : 'Create' }}
                </button>
                <button
                  v-if="editingId"
                  type="button"
                  class="btn-secondary"
                  @click="resetForm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </aside>

          <div class="filters-table-wrap">
            <div class="filters-table-head">
              <div>
                <h2 class="filters-table-title">
                  Existing filters
                </h2>
                <p class="filters-table-sub">
                  {{ filters.length }} {{ filters.length === 1 ? 'filter' : 'filters' }} for this tenant
                </p>
              </div>
              <span v-if="filtersPending" class="filters-loading">Loading…</span>
            </div>

            <div class="table-card filters-table-card">
              <table class="clients-table clients-table--filters">
                <colgroup>
                  <col class="col-name">
                  <col class="col-contact">
                  <col class="col-prop">
                  <col class="col-ptype">
                  <col class="col-value">
                  <col class="col-status">
                  <col class="col-actions">
                </colgroup>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact type</th>
                    <th>Property</th>
                    <th>Property type</th>
                    <th>Values</th>
                    <th>Status</th>
                    <th class="th-actions" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="filtersPending && !filters.length">
                    <td colspan="7" class="td-empty-state">
                      Loading filters…
                    </td>
                  </tr>
                  <template v-else-if="filtersDisplay.length">
                    <tr v-for="f in filtersDisplay" :key="f.id">
                      <td class="td-name">{{ f.name }}</td>
                      <td class="td-contact capitalize">{{ f.contactType }}</td>
                      <td class="td-muted">{{ propertyFieldLabel(f.property) }}</td>
                      <td class="td-muted">
                        {{
                          f.property === 'address'
                            ? propertyTypeLabel(f.propertyType || 'state')
                            : '—'
                        }}
                      </td>
                      <td class="td-values">
                        <div
                          v-if="f.valueTokens.length"
                          class="value-chip-list"
                          :class="{ 'value-chip-list--scroll': f.valueTokens.length > 12 }"
                        >
                          <span
                            v-for="(token, i) in f.valueTokens"
                            :key="i"
                            class="value-chip"
                          >{{ token }}</span>
                        </div>
                        <span v-else class="td-muted">—</span>
                      </td>
                      <td>
                        <span
                          class="status-pill"
                          :class="f.enabled ? 'status-pill--on' : 'status-pill--off'"
                        >{{ f.enabled ? 'On' : 'Off' }}</span>
                      </td>
                      <td class="td-actions">
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
                            @click="removeFilter(f.id)"
                          >
                            {{ deletingId === f.id ? '…' : 'Delete' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </template>
                  <tr v-else>
                    <td colspan="7" class="td-empty-state">
                      No recipient filters yet. Use the form to add one.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const dbName = computed(() =>
  decodeURIComponent(String(route.params.dbName || ''))
)

const tab = ref<'overview' | 'filters'>('overview')

const contactTypes = ['prospect', 'client', 'contact'] as const

const propertyFieldOptions = [
  { value: 'none', label: 'None' },
  { value: 'address', label: 'Address' },
  { value: 'channel', label: 'Channel' },
  { value: 'company', label: 'Company' },
  { value: 'source', label: 'Source' },
  { value: 'email', label: 'Email' }
] as const

const addressPropertyTypeOptions = [
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'county', label: 'County' },
  { value: 'street', label: 'Street' }
] as const

type PropertyFieldValue = (typeof propertyFieldOptions)[number]['value']
type AddressPropertyTypeValue =
  (typeof addressPropertyTypeOptions)[number]['value']

interface TenantDetail {
  name: string
  email: string | null
  dbName: string
  tenantId: string | null
  apiKeyPrefix: string | null
  createdAt: string
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

const tenant = ref<TenantDetail | null>(null)
const tenantPending = ref(true)

const filters = ref<FilterRow[]>([])
const filtersPending = ref(false)

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

const form = reactive({
  name: '',
  contactType: 'prospect' as (typeof contactTypes)[number],
  property: 'none' as PropertyFieldValue,
  propertyType: 'state' as AddressPropertyTypeValue,
  propertyValue: '',
  enabled: true
})

watch(
  () => form.property,
  (p) => {
    if (p === 'address') {
      const ok = addressPropertyTypeOptions.some((o) => o.value === form.propertyType)
      if (!ok) form.propertyType = 'state'
    }
  }
)

function propertyFieldLabel(value: string): string {
  const opt = propertyFieldOptions.find((o) => o.value === value)
  return opt?.label ?? value
}

function propertyTypeLabel(value: string): string {
  const opt = addressPropertyTypeOptions.find((o) => o.value === value)
  return opt?.label ?? value
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

function fillForm(f: FilterRow) {
  form.name = f.name
  form.enabled = f.enabled
  form.contactType = (contactTypes as readonly string[]).includes(f.contactType)
    ? (f.contactType as (typeof contactTypes)[number])
    : 'prospect'
  form.property = (propertyFieldOptions as readonly { value: string }[]).some(
    (o) => o.value === f.property
  )
    ? (f.property as PropertyFieldValue)
    : 'none'
  if (form.property === 'address') {
    const t = f.propertyType
    form.propertyType = (addressPropertyTypeOptions as readonly { value: string }[]).some(
      (o) => o.value === t
    )
      ? (t as AddressPropertyTypeValue)
      : 'state'
  } else {
    form.propertyType = 'state'
  }
  form.propertyValue = f.propertyValue ?? ''
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.contactType = 'prospect'
  form.property = 'none'
  form.propertyType = 'state'
  form.propertyValue = ''
  form.enabled = true
  formError.value = ''
}

function startEdit(f: FilterRow) {
  editingId.value = f.id
  fillForm(f)
  formError.value = ''
}

async function saveFilter() {
  formError.value = ''
  const prefix = filtersApiPrefix()
  if (!prefix) {
    formError.value = 'This tenant has no tenant ID in the registry.'
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      contactType: form.contactType,
      property: form.property,
      propertyType:
        form.property === 'address' ? form.propertyType : 'none',
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

async function removeFilter(id: string) {
  const prefix = filtersApiPrefix()
  if (!prefix) return
  if (!confirm('Delete this recipient filter?')) return
  deletingId.value = id
  try {
    await $fetch(`${prefix}/recipient-filters/${id}`, { method: 'DELETE' })
    if (editingId.value === id) resetForm()
    await loadFilters()
  } finally {
    deletingId.value = null
  }
}

watch(
  dbName,
  async (name) => {
    if (!name) return
    await loadTenant()
    await loadFilters()
  },
  { immediate: true }
)
</script>

<style scoped src="./index.css" />

<style scoped>
.tab-list {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.tab-btn {
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  padding: 0.65rem 1.1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #64748b;
  border-radius: 0.5rem 0.5rem 0 0;
  transition: color 0.15s ease, background-color 0.15s ease;
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

.overview-card {
  max-width: 42rem;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.overview-grid {
  display: grid;
  gap: 1.25rem 2rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.overview-item dt {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 0.35rem;
}

.overview-item dd {
  margin: 0;
  font-size: 0.9375rem;
  color: #0f172a;
}

.filters-tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.filters-intro {
  border-radius: 0.875rem;
  border: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 1rem 1.25rem;
}

.filters-intro p {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: #475569;
}

.filters-split {
  display: grid;
  gap: 1.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .filters-split {
    grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
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

.field label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
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

.toggle-check {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  border-color: #cbd5e1;
  accent-color: #4f46e5;
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

.filters-table-wrap {
  min-width: 0;
}

.filters-table-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.65rem;
}

.filters-table-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: #0f172a;
}

.filters-table-sub {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: #64748b;
}

.filters-loading {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
}

.filters-table-card {
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
}

.clients-table--filters col.col-name {
  width: 15%;
}

.clients-table--filters col.col-contact {
  width: 11%;
}

.clients-table--filters col.col-prop {
  width: 10%;
}

.clients-table--filters col.col-ptype {
  width: 10%;
}

.clients-table--filters col.col-value {
  width: 28%;
}

.clients-table--filters col.col-status {
  width: 8%;
}

.clients-table--filters col.col-actions {
  width: 18%;
}

.clients-table--filters .td-name {
  font-weight: 600;
  color: #0f172a;
}

.clients-table--filters .td-contact {
  font-size: 0.875rem;
  color: #334155;
}

.clients-table--filters .td-muted {
  font-size: 0.8125rem;
  color: #64748b;
}

.clients-table--filters .td-values {
  vertical-align: top;
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.value-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.45rem;
  align-content: flex-start;
}

.value-chip-list--scroll {
  max-height: 6.5rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.value-chip {
  display: inline-block;
  padding: 0.2rem 0.45rem;
  border-radius: 0.375rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #334155;
  line-height: 1.3;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.status-pill--on {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.status-pill--off {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.row-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
}

.btn-row {
  border-radius: 0.5rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.btn-row--edit {
  background: #eef2ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.btn-row--edit:hover {
  background: #e0e7ff;
  color: #3730a3;
}

.btn-row--danger {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

.btn-row--danger:hover:not(:disabled) {
  background: #fee2e2;
  color: #991b1b;
}

.btn-row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.td-empty-state {
  text-align: center;
  padding: 2.5rem 1rem !important;
  font-size: 0.9375rem;
  color: #64748b;
  font-style: normal;
}
</style>
