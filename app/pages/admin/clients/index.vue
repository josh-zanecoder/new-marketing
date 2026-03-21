<template>
  <section class="admin-page">
    <header class="page-header">
      <h1>Clients</h1>
      <p>Manage clients for the marketing service</p>
    </header>

    <div class="mb-5 flex justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        @click="openAddClientsModal"
      >
        Add Client
      </button>
    </div>

    <div class="table-card">
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Client Key</th>
            <th>Status</th>
            <th class="th-actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in clients" :key="c.dbName">
            <td>{{ c.name }}</td>
            <td>{{ c.email || '-' }}</td>
            <td class="font-mono text-xs text-slate-600">
              {{ c.clientKeyPrefix || '-' }}
            </td>
            <td>
              <span class="badge">{{ c.status }}</span>
            </td>
            <td class="td-actions">
              <button
                type="button"
                class="btn-regenerate"
                :disabled="isRegenerating === c.dbName"
                :aria-busy="isRegenerating === c.dbName"
                @click="handleRegenerateKey(c.dbName)"
              >
                <span
                  v-if="isRegenerating === c.dbName"
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
                  {{ isRegenerating === c.dbName ? 'Regenerating...' : 'Regenerate key' }}
                </span>
              </button>
            </td>
          </tr>
          <tr v-if="!clients.length">
            <td colspan="5">
              No clients yet
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ClientAddClientsModal
      :open="isAddClientsOpen"
      :server-error="addClientsServerError"
      @close="closeAddClientsModal"
      @submit="handleAddClientSubmit"
    />

    <ClientKeyModal
      v-if="newlyCreatedClientKey"
      :open="!!newlyCreatedClientKey"
      :client-key="newlyCreatedClientKey"
      title="Client Created – Save Your Client Key"
      @close="newlyCreatedClientKey = null; closeAddClientsModal()"
    />

    <ClientKeyModal
      v-if="regeneratedClientKey"
      :open="!!regeneratedClientKey"
      :client-key="regeneratedClientKey"
      title="Client Key Regenerated"
      @close="regeneratedClientKey = null"
    />
  </section>
</template>

<script setup lang="ts">
import { useAdminClientsCreateDb } from '~/composables/admin/clients/useAdminClientsCreateDb'
import type { AdminClient } from '~/types/client'
import ClientKeyModal from '~/components/client/ClientKeyModal.vue'

definePageMeta({ layout: 'admin' })

const isAddClientsOpen = ref(false)
const newlyCreatedClientKey = ref<string | null>(null)
const regeneratedClientKey = ref<string | null>(null)
const isRegenerating = ref<string | null>(null)

const {
  serverError: addClientsServerError,
  resetError,
  createClientDb,
  regenerateClientKey
} = useAdminClientsCreateDb()

const clients = ref<AdminClient[]>([])

function openAddClientsModal() {
  resetError()
  newlyCreatedClientKey.value = null
  isAddClientsOpen.value = true
}

function closeAddClientsModal() {
  resetError()
  newlyCreatedClientKey.value = null
  isAddClientsOpen.value = false
}

async function fetchClients() {
  try {
    const res = await $fetch<{
      clients: {
        name: string
        email: string | null
        dbName: string
        clientKeyPrefix: string | null
        createdAt: string
      }[]
    }>('/api/v1/admin/clients', { method: 'GET' })

    clients.value = (res?.clients ?? []).map((c) => ({
      name: c.name,
      email: c.email,
      dbName: c.dbName,
      clientKeyPrefix: c.clientKeyPrefix,
      status: 'Ready'
    }))
  } catch {
    clients.value = []
  }
}

async function handleAddClientSubmit(payload: { name: string; email: string }) {
  const result = await createClientDb(payload)
  if (!result.ok) return

  newlyCreatedClientKey.value = result.clientKey ?? null
  await fetchClients()

  if (!result.clientKey) closeAddClientsModal()
}

async function handleRegenerateKey(dbName: string) {
  isRegenerating.value = dbName
  const key = await regenerateClientKey(dbName)
  isRegenerating.value = null
  if (key) {
    regeneratedClientKey.value = key
    await fetchClients()
  }
}

await fetchClients()
</script>

<style scoped src="./index.css" />
