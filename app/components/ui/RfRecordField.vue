<script setup lang="ts">
defineProps<{
  label: string
  fullWidth?: boolean
}>()
</script>

<template>
  <div class="rf-record-field" :class="{ 'rf-record-field--full': fullWidth }">
    <dt class="rf-record-field__label">
      {{ label }}
    </dt>
    <dd class="rf-record-field__value">
      <slot />
    </dd>
  </div>
</template>
