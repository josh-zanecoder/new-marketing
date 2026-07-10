<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const id = String(route.params.id ?? '').trim()

await navigateTo(id ? `/tenant/campaigns/${encodeURIComponent(id)}` : '/tenant/campaigns', {
  replace: true
})
</script>

<template>
  <div />
</template>
