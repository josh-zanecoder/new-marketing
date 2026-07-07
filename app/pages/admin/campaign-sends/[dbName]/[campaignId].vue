<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const dbName = String(route.params.dbName ?? '').trim()
const campaignId = String(route.params.campaignId ?? '').trim()

if (dbName && campaignId) {
  await navigateTo(
    `/admin/campaigns/${encodeURIComponent(dbName)}/${encodeURIComponent(campaignId)}`,
    { replace: true }
  )
} else {
  await navigateTo('/admin/campaigns', { replace: true })
}
</script>

<template>
  <div />
</template>
