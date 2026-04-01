<template>
  <div class="overview-card">
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
</template>

<script setup lang="ts">
defineProps<{
  tenant: {
    email: string | null
    tenantId: string | null
    apiKeyPrefix: string | null
    createdAt: string
  }
}>()
</script>
