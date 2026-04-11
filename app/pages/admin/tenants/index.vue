<template>
  <section class="min-w-0 w-full space-y-8 px-6 py-8 lg:px-10 xl:px-12 2xl:px-14">
    <header class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Tenants
        </h1>
        <p class="max-w-xl text-sm leading-relaxed text-slate-600">
          Register and manage tenants for the marketing service
        </p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        @click="openAddTenantModal"
      >
        Add tenant
      </button>
    </header>

    <div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5">
      <div class="overflow-x-auto">
        <table class="w-full min-w-0 table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col style="width: 15%">
            <col style="width: 22%">
            <col style="width: 20%">
            <col style="width: 14%">
            <col style="width: 11%">
            <col style="width: 18%">
          </colgroup>
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/90">
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                CRM URL
              </th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                API key
              </th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th class="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-if="tenantsLoading">
              <tr class="bg-slate-50/50">
                <td class="px-4 py-10 text-center text-sm text-slate-500" colspan="6">
                  <span class="inline-flex items-center gap-2">
                    <span
                      class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
                      aria-hidden="true"
                    />
                    Loading tenants…
                  </span>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="t in tenants"
                :key="t.dbName"
                class="transition-colors hover:bg-slate-50/80"
              >
                <td class="px-4 py-4 align-middle">
                  <NuxtLink
                    class="font-medium text-slate-900 decoration-slate-300 underline-offset-2 hover:text-indigo-600 hover:underline"
                    :to="`/admin/tenants/${encodeURIComponent(t.dbName)}`"
                  >
                    {{ t.name }}
                  </NuxtLink>
                </td>
                <td class="truncate px-4 py-4 align-middle text-slate-700" :title="t.email || undefined">
                  {{ t.email || '—' }}
                </td>
                <td class="max-w-0 truncate px-4 py-4 align-middle" :title="t.crmAppUrl || undefined">
                  <template v-if="t.crmAppUrl">
                    <a
                      :href="t.crmAppUrl"
                      class="text-indigo-600 decoration-indigo-200 underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ t.crmAppUrl }}
                    </a>
                  </template>
                  <template v-else>
                    <span class="text-slate-400">—</span>
                  </template>
                </td>
                <td class="truncate px-4 py-4 align-middle font-mono text-xs text-slate-600" :title="t.apiKeyPrefix || undefined">
                  {{ t.apiKeyPrefix || '—' }}
                </td>
                <td class="whitespace-nowrap px-4 py-4 align-middle">
                  <span
                    class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100"
                  >
                    {{ t.status }}
                  </span>
                </td>
                <td class="px-4 py-4 align-middle">
                  <div class="flex min-w-0 flex-col items-stretch gap-2 sm:min-w-[11rem] sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      @click="openEditTenantModal(t)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="isRegenerating === t.dbName"
                      :aria-busy="isRegenerating === t.dbName"
                      @click="handleRegenerateKey(t.dbName)"
                    >
                      <span
                        v-if="isRegenerating === t.dbName"
                        class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
                        aria-hidden="true"
                      />
                      <svg
                        v-else
                        class="h-3.5 w-3.5 shrink-0 text-slate-500"
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
                      <span class="truncate">{{ isRegenerating === t.dbName ? 'Regenerating…' : 'Regenerate key' }}</span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!tenants.length">
                <td class="px-4 py-12 text-center text-sm text-slate-500" colspan="6">
                  No tenants yet
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
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

    <TenantApiKeyModal
      v-if="newlyCreatedApiKey"
      :open="!!newlyCreatedApiKey"
      :api-key="newlyCreatedApiKey"
      title="Tenant created – save your API key"
      @close="newlyCreatedApiKey = null; closeAddTenantModal()"
    />

    <TenantApiKeyModal
      v-if="regeneratedApiKey"
      :open="!!regeneratedApiKey"
      :api-key="regeneratedApiKey"
      title="API key regenerated"
      @close="regeneratedApiKey = null"
    />
  </section>
</template>

<script setup lang="ts">
import { useAdminTenantsCreateDb } from '~/composables/admin/tenants/useAdminTenantsCreateDb'
import type { AdminTenantRow } from '~/types/adminTenant'

definePageMeta({ layout: 'admin' })

const isAddTenantOpen = ref(false)
const isEditTenantOpen = ref(false)
const editingTenant = ref<AdminTenantRow | null>(null)
const newlyCreatedApiKey = ref<string | null>(null)
const regeneratedApiKey = ref<string | null>(null)
const isRegenerating = ref<string | null>(null)

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

function openAddTenantModal() {
  resetError()
  newlyCreatedApiKey.value = null
  isAddTenantOpen.value = true
}

function closeAddTenantModal() {
  resetError()
  newlyCreatedApiKey.value = null
  isAddTenantOpen.value = false
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
}) {
  const result = await createTenantDb(payload)
  if (!result.ok) return

  newlyCreatedApiKey.value = result.apiKey ?? null
  await fetchTenants()

  if (!result.apiKey) closeAddTenantModal()
}

async function handleEditTenantSubmit(payload: {
  name: string
  email: string | null
  crmAppUrl: string | null
  tenantId: string | null
}) {
  const row = editingTenant.value
  if (!row) return

  const result = await updateTenant(row.dbName, payload)
  if (!result.ok) return

  await fetchTenants()
  closeEditTenantModal()
}

async function handleRegenerateKey(dbName: string) {
  isRegenerating.value = dbName
  const key = await regenerateTenantApiKey(dbName)
  isRegenerating.value = null
  if (key) {
    regeneratedApiKey.value = key
    await fetchTenants()
  }
}

onMounted(async () => {
  try {
    await fetchTenants()
  } finally {
    tenantsLoading.value = false
  }
})
</script>
