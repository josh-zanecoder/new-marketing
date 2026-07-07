<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'

definePageMeta({ layout: 'admin' })

const tenantFilter = ref('')
const tenants = ref<AdminTenantRow[]>([])

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

await useAsyncData('admin-tracking-tenants', async () => {
  const res = await $fetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants')
  tenants.value = res.tenants ?? []
  return true
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="min-w-0 space-y-1">
      <p class="page-eyebrow">Delivery</p>
      <h1 class="page-title">
        Tracking
      </h1>
      <p class="page-lead max-w-2xl sm:text-[0.9375rem] sm:leading-relaxed">
        Delivery, opens, and clicks across tenants—filtered from Brevo and grouped by message. Use the tenant filter to narrow to one workspace.
      </p>
    </header>

    <TenantBrevoTrackingEventsPanel
      v-model:admin-tenant-filter="tenantFilter"
      admin-tracking
      :admin-tenant-filter-options="tenantFilterSelectOptions"
    />
  </div>
</template>
