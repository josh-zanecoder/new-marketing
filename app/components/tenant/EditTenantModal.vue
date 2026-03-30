<template>
  <Teleport to="body">
    <div
      v-if="props.open && props.tenant"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              Edit tenant
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              Registry: <span class="font-mono text-xs">{{ props.tenant.dbName }}</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            @click="emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <label for="edit-tenant-name" class="block text-sm font-medium text-slate-700">Tenant name</label>
            <input
              id="edit-tenant-name"
              v-model="name"
              type="text"
              autocomplete="organization"
              required
              class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
          </div>

          <div class="space-y-2">
            <label for="edit-tenant-email" class="block text-sm font-medium text-slate-700">Contact email</label>
            <input
              id="edit-tenant-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              placeholder="Optional"
            >
          </div>

          <div class="space-y-2">
            <label for="edit-tenant-id" class="block text-sm font-medium text-slate-700">
              Tenant ID <span class="font-normal text-slate-500">(CRM / integrations)</span>
            </label>
            <input
              id="edit-tenant-id"
              v-model="tenantId"
              type="text"
              autocomplete="off"
              class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              placeholder="UUID"
            >
          </div>

          <div class="space-y-2">
            <label for="edit-tenant-crm-url" class="block text-sm font-medium text-slate-700">
              CRM app URL <span class="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="edit-tenant-crm-url"
              v-model="crmAppUrl"
              type="url"
              autocomplete="url"
              placeholder="https://crm.example.com"
              class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
          </div>

          <div v-if="displayError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ displayError }}
          </div>

          <div class="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              :disabled="isSubmitting"
            >
              <span v-if="isSubmitting" class="inline-flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 5.523 4.477 10 10 10v-4c-1.45 0-2.792-.464-3.99-1.25z"
                  />
                </svg>
                Saving...
              </span>
              <span v-else>
                Save changes
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'
import { useSubmitting } from '~/composables/useSubmitting'

const props = defineProps<{
  open: boolean
  tenant: AdminTenantRow | null
  serverError?: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [{
    name: string
    email: string | null
    crmAppUrl: string | null
    tenantId: string | null
  }]
}>()

const name = ref('')
const email = ref('')
const tenantId = ref('')
const crmAppUrl = ref('')
const errorMessage = ref<string | null>(null)
const { isSubmitting, startSubmitting, stopSubmitting } = useSubmitting()

const displayError = computed(() => errorMessage.value || props.serverError || null)

function loadFromTenant(t: AdminTenantRow) {
  name.value = t.name
  email.value = t.email ?? ''
  tenantId.value = t.tenantId ?? ''
  crmAppUrl.value = t.crmAppUrl ?? ''
}

function resetLocal() {
  errorMessage.value = null
  stopSubmitting()
}

watch(
  () => [props.open, props.tenant] as const,
  ([open, tenant]) => {
    if (open && tenant) {
      loadFromTenant(tenant)
      resetLocal()
    }
  }
)

watch(
  () => props.open,
  (open) => {
    if (!open) stopSubmitting()
  }
)

watch(
  () => props.serverError,
  () => {
    if (isSubmitting.value) stopSubmitting()
  }
)

function handleSubmit() {
  errorMessage.value = null

  const trimmedName = name.value.trim()
  const trimmedEmail = email.value.trim()
  const trimmedCrm = crmAppUrl.value.trim()
  const trimmedTid = tenantId.value.trim()

  if (!trimmedName) {
    errorMessage.value = 'Tenant name is required.'
    return
  }

  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  if (
    trimmedCrm
    && !/^https?:\/\/.+/i.test(trimmedCrm)
  ) {
    errorMessage.value = 'CRM app URL must start with http:// or https://'
    return
  }

  startSubmitting()
  emit('submit', {
    name: trimmedName,
    email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
    crmAppUrl: trimmedCrm || null,
    tenantId: trimmedTid || null
  })
}
</script>
