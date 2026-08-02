<script setup lang="ts">
import type TenantBrevoTrackingEventsPanel from '~/components/tenant/BrevoTrackingEventsPanel.vue'
import type { AdminTenantRow } from '~/types/adminTenant'

definePageMeta({ layout: 'admin' })

const tenantFilter = ref('')
const tenants = ref<AdminTenantRow[]>([])
const trackingPanelRef = ref<InstanceType<typeof TenantBrevoTrackingEventsPanel> | null>(null)

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

const trackingPending = computed(
  () => unref(trackingPanelRef.value?.pending as boolean | Ref<boolean> | undefined) ?? false
)

function onRefreshTracking() {
  void trackingPanelRef.value?.refresh?.()
}

await useAsyncData('admin-tracking-tenants', async () => {
  const res = await $fetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants')
  tenants.value = res.tenants ?? []
  return true
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Delivery</p>
        <h1 class="page-title">
          Tracking
        </h1>
        <p class="page-lead max-w-2xl sm:text-[0.9375rem] sm:leading-relaxed">
          Select a tenant, then Refresh to sync events from Brevo into that workspace database.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh admin tracking"
        :pending="trackingPending"
        @click="onRefreshTracking"
      />
    </header>

    <TenantBrevoTrackingEventsPanel
      ref="trackingPanelRef"
      v-model:admin-tenant-filter="tenantFilter"
      admin-tracking
      :admin-tenant-filter-options="tenantFilterSelectOptions"
    />
  </div>
</template>
