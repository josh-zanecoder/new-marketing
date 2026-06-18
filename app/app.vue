<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="h-full min-h-0">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :key="route.fullPath" />
    </NuxtLayout>
  </div>
</template>
