<template>
  <section class="mx-auto w-full min-w-0 max-w-6xl space-y-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <h1 class="page-title">
          Tenants
        </h1>
        <p class="page-lead">
          Register and manage tenants for the marketing service
        </p>
      </div>
      <button
        type="button"
        class="btn-cta self-start"
        @click="openAddTenantModal"
      >
        Add tenant
      </button>
    </header>

    <div :class="tenantsTableWrapClass">
      <table :class="tenantsTableClass">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>CRM URL</th>
            <th>Campaign sender</th>
            <th>API key</th>
            <th>Status</th>
            <th :class="tenantsThActionsClass">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="tenantsLoading">
            <td colspan="7" class="td-empty-state">
              <span class="inline-flex items-center gap-2">
                <span
                  class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600"
                  aria-hidden="true"
                />
                Loading tenants…
              </span>
            </td>
          </tr>
          <template v-else>
            <tr v-for="t in tenants" :key="t.dbName">
              <td class="td-name">
                <NuxtLink
                  class="text-inherit no-underline hover:text-primary-600"
                  :to="`/admin/tenants/${encodeURIComponent(t.dbName)}`"
                  :title="t.name"
                >
                  {{ truncateTabCellText(t.name) }}
                </NuxtLink>
              </td>
              <td class="td-muted" :title="t.email || undefined">
                {{ truncateTabCellText(t.email) || '—' }}
              </td>
              <td class="td-muted">
                <a
                  v-if="t.crmAppUrl"
                  :href="t.crmAppUrl"
                  class="td-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="t.crmAppUrl"
                >
                  {{ truncateTabCellText(t.crmAppUrl) }}
                </a>
                <span v-else>—</span>
              </td>
              <td class="td-muted" :title="campaignSenderLabel(t)">
                {{ truncateTabCellText(campaignSenderLabel(t)) }}
              </td>
              <td class="td-muted td-mono" :title="t.apiKeyPrefix || undefined">
                {{ truncateTabCellText(t.apiKeyPrefix) || '—' }}
              </td>
              <td>
                <span class="status-pill status-pill--on">{{ t.status }}</span>
              </td>
              <td :class="tenantsTdActionsClass">
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn-row btn-row--edit"
                    @click="openEditTenantModal(t)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn-row btn-row--neutral inline-flex items-center gap-1.5"
                    :disabled="isRegenerating === t.dbName"
                    :aria-busy="isRegenerating === t.dbName"
                    @click="handleRegenerateKey(t.dbName)"
                  >
                    <span
                      v-if="isRegenerating === t.dbName"
                      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
                      aria-hidden="true"
                    />
                    <svg
                      v-else
                      class="h-3 w-3 shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.312.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31a7 7 0 00-11.713 3.137.75.75 0 001.45.389 5.5 5.5 0 019.201-2.466l.312.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    {{ isRegenerating === t.dbName ? '…' : 'Regenerate' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!tenants.length">
              <td colspan="7" class="td-empty-state">
                No tenants yet
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <TenantAddTenantModal
      :open="isAddTenantOpen"
      :server-error="tenantFormError"
      @close="closeAddTenantModal"
      @submit="handleAddTenantSubmit"
    />

    <TenantEditTenantModal
      :open="isEditTenantOpen"
      :tenant="editingTenant"
      :server-error="tenantFormError"
      @close="closeEditTenantModal"
      @submit="handleEditTenantSubmit"
    />

    <TenantCrmExternalConnectionModal
      :open="!!crmExternalConnectionModal"
      :metadata="crmExternalConnectionModal"
      :title="crmModalTitle"
      :db-name="crmModalDbName"
      :mode="crmModalContext ?? 'create'"
      :regenerating="!!crmModalDbName && isRegenerating === crmModalDbName"
      @regenerate="handleCrmModalRegenerate"
      @close="closeCrmExternalConnectionModal"
    />
  </section>
</template>

<script setup lang="ts">
import { useAdminTenantsCreateDb } from '~/composables/admin/tenants/useAdminTenantsCreateDb'
import {
  recipientFiltersTableWrapClass,
  recipientFiltersTableClassTenants,
  recipientFiltersThActionsClass,
  recipientFiltersTdActionsClass
} from '~/components/tenant-tabs/RecipientFiltersTab.vue'
import { truncateTabCellText } from '~/utils/truncateTabCellText'
import type { AdminTenantRow } from '~/types/adminTenant'
import type { CrmExternalConnectionMetadata } from '~~/shared/types/crmExternalConnection'

definePageMeta({ layout: 'admin' })

const tenantsTableWrapClass = recipientFiltersTableWrapClass
const tenantsTableClass = recipientFiltersTableClassTenants
const tenantsThActionsClass = recipientFiltersThActionsClass
const tenantsTdActionsClass = recipientFiltersTdActionsClass

const isAddTenantOpen = ref(false)
const isEditTenantOpen = ref(false)
const editingTenant = ref<AdminTenantRow | null>(null)
const crmExternalConnectionModal = ref<CrmExternalConnectionMetadata | null>(null)
const crmModalDbName = ref<string | null>(null)
const crmModalContext = ref<'create' | 'regenerate' | null>(null)
const isRegenerating = ref<string | null>(null)

const crmModalTitle = computed(() =>
  crmModalContext.value === 'regenerate'
    ? 'API key regenerated – update CRM metadata'
    : 'Tenant created – CRM external connection'
)

const {
  serverError: tenantFormError,
  resetError,
  createTenantDb,
  updateTenant,
  regenerateTenantApiKey
} = useAdminTenantsCreateDb()

const tenants = ref<AdminTenantRow[]>([])
/** Avoid SSR/client tenant list mismatch (admin API often empty on server, populated in browser). */
const tenantsLoading = ref(true)

function campaignSenderLabel(t: AdminTenantRow): string {
  const name = t.defaultCampaignSenderName?.trim()
  const email = t.defaultCampaignSenderEmail?.trim()
  if (name && email) return `${name} <${email}>`
  if (email) return email
  if (name) return name
  return '—'
}

function openAddTenantModal() {
  resetError()
  isAddTenantOpen.value = true
}

function closeAddTenantModal() {
  resetError()
  isAddTenantOpen.value = false
}

function closeCrmExternalConnectionModal() {
  crmExternalConnectionModal.value = null
  crmModalDbName.value = null
  if (crmModalContext.value === 'create') closeAddTenantModal()
  crmModalContext.value = null
}

function openCrmExternalConnectionModal(
  metadata: CrmExternalConnectionMetadata,
  context: 'create' | 'regenerate',
  dbName?: string
) {
  crmExternalConnectionModal.value = metadata
  crmModalDbName.value = dbName ?? metadata.DB_NAME
  crmModalContext.value = context
}

async function regenerateAndShowCrmConnection(dbName: string) {
  isRegenerating.value = dbName
  const result = await regenerateTenantApiKey(dbName)
  isRegenerating.value = null
  if (!result.crmExternalConnection) return false

  await fetchTenants()
  openCrmExternalConnectionModal(result.crmExternalConnection, 'regenerate', dbName)
  return true
}

async function handleRegenerateKey(dbName: string) {
  if (!confirm('Regenerate API key for this tenant? Update CRM metadata after copying the new JSON.')) return
  await regenerateAndShowCrmConnection(dbName)
}

async function handleCrmModalRegenerate() {
  const dbName = crmModalDbName.value
  if (!dbName || isRegenerating.value) return
  if (!confirm('Regenerate API key for this tenant? The JSON below will update with the new key.')) return
  await regenerateAndShowCrmConnection(dbName)
}

function openEditTenantModal(t: AdminTenantRow) {
  resetError()
  editingTenant.value = t
  isEditTenantOpen.value = true
}

function closeEditTenantModal() {
  resetError()
  editingTenant.value = null
  isEditTenantOpen.value = false
}

async function fetchTenants() {
  try {
    const res = await $fetch<{
      tenants: {
        name: string
        email: string | null
        dbName: string
        tenantId: string | null
        apiKeyPrefix: string | null
        crmAppUrl: string | null
        kafkaOutboundTopic: string | null
        defaultCampaignSenderEmail: string | null
        defaultCampaignSenderName: string | null
        createdAt: string
      }[]
    }>('/api/v1/admin/tenants', { method: 'GET' })

    tenants.value = (res?.tenants ?? []).map((t) => ({
      name: t.name,
      email: t.email,
      dbName: t.dbName,
      tenantId: t.tenantId,
      apiKeyPrefix: t.apiKeyPrefix,
      crmAppUrl: t.crmAppUrl,
      kafkaOutboundTopic: t.kafkaOutboundTopic ?? null,
      defaultCampaignSenderEmail: t.defaultCampaignSenderEmail ?? null,
      defaultCampaignSenderName: t.defaultCampaignSenderName ?? null,
      status: 'Ready'
    }))
  } catch {
    tenants.value = []
  }
}

async function handleAddTenantSubmit(payload: {
  name: string
  email: string
  crmAppUrl?: string
  defaultCampaignSenderEmail?: string | null
  defaultCampaignSenderName?: string | null
}) {
  const result = await createTenantDb(payload)
  if (!result.ok) return

  await fetchTenants()

  if (result.crmExternalConnection) {
    openCrmExternalConnectionModal(result.crmExternalConnection, 'create', result.crmExternalConnection.DB_NAME)
    return
  }

  closeAddTenantModal()
}

async function handleEditTenantSubmit(payload: {
  name: string
  email: string | null
  crmAppUrl: string | null
  tenantId: string | null
  defaultCampaignSenderEmail: string | null
  defaultCampaignSenderName: string | null
}) {
  const row = editingTenant.value
  if (!row) return

  const result = await updateTenant(row.dbName, payload)
  if (!result.ok) return

  await fetchTenants()
  closeEditTenantModal()
}

onMounted(async () => {
  try {
    await fetchTenants()
  } finally {
    tenantsLoading.value = false
  }
})
</script>
