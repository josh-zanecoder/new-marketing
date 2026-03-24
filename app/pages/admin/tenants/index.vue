<template>
  <section class="admin-page">
    <header class="page-header">
      <h1>Tenants</h1>
      <p>Register and manage tenants for the marketing service</p>
    </header>

    <div class="mb-5 flex justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        @click="openAddTenantModal"
      >
        Add tenant
      </button>
    </div>

    <div class="table-card">
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Subdomain</th>
            <th>Email</th>
            <th>API key</th>
            <th>Status</th>
            <th class="th-actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tenants" :key="t.dbName">
            <td>
              <NuxtLink
                class="font-medium text-slate-900 hover:text-indigo-600 hover:underline"
                :to="`/admin/tenants/${encodeURIComponent(t.dbName)}`"
              >
                {{ t.name }}
              </NuxtLink>
            </td>
            <td class="font-mono text-xs text-slate-600">{{ t.subdomain || '-' }}</td>
            <td>{{ t.email || '-' }}</td>
            <td class="font-mono text-xs text-slate-600">
              {{ t.apiKeyPrefix || '-' }}
            </td>
            <td>
              <span class="badge">{{ t.status }}</span>
            </td>
            <td class="td-actions">
              <button
                type="button"
                class="btn-regenerate"
                :disabled="isRegenerating === t.dbName"
                :aria-busy="isRegenerating === t.dbName"
                @click="handleRegenerateKey(t.dbName)"
              >
                <span
                  v-if="isRegenerating === t.dbName"
                  class="btn-regenerate-spinner"
                  aria-hidden="true"
                />
                <svg
                  v-else
                  class="btn-regenerate-icon"
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
                <span class="btn-regenerate-text">
                  {{ isRegenerating === t.dbName ? 'Regenerating...' : 'Regenerate key' }}
                </span>
              </button>
            </td>
          </tr>
          <tr v-if="!tenants.length">
            <td colspan="6">
              No tenants yet
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TenantAddTenantModal
      :open="isAddTenantOpen"
      :server-error="addTenantServerError"
      @close="closeAddTenantModal"
      @submit="handleAddTenantSubmit"
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
const newlyCreatedApiKey = ref<string | null>(null)
const regeneratedApiKey = ref<string | null>(null)
const isRegenerating = ref<string | null>(null)

const {
  serverError: addTenantServerError,
  resetError,
  createTenantDb,
  regenerateTenantApiKey
} = useAdminTenantsCreateDb()

const tenants = ref<AdminTenantRow[]>([])

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

async function fetchTenants() {
  try {
    const res = await $fetch<{
      tenants: {
        name: string
        email: string | null
        dbName: string
        subdomain: string | null
        tenantId: string | null
        apiKeyPrefix: string | null
        createdAt: string
      }[]
    }>('/api/v1/admin/tenants', { method: 'GET' })

    tenants.value = (res?.tenants ?? []).map((t) => ({
      name: t.name,
      email: t.email,
      dbName: t.dbName,
      subdomain: t.subdomain,
      tenantId: t.tenantId,
      apiKeyPrefix: t.apiKeyPrefix,
      status: 'Ready'
    }))
  } catch {
    tenants.value = []
  }
}

async function handleAddTenantSubmit(payload: { name: string; email: string; subdomain: string }) {
  const result = await createTenantDb(payload)
  if (!result.ok) return

  newlyCreatedApiKey.value = result.apiKey ?? null
  await fetchTenants()

  if (!result.apiKey) closeAddTenantModal()
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

await fetchTenants()
</script>

<style scoped src="./index.css" />
