<script setup lang="ts">
definePageMeta({ layout: false })

const { hasTenantContext } = useTenant()

if (hasTenantContext.value) {
  await navigateTo('/tenant/dashboard')
} else {
  await navigateTo('/admin/dashboard')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50">
    <p class="text-slate-500">Redirecting...</p>
  </div>
</template>
