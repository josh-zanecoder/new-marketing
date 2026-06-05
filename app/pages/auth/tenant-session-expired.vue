<script setup lang="ts">
import { notifyParentMarketingSessionExpired } from '~/composables/useMarketingEmbed'

definePageMeta({
  layout: false
})

onMounted(() => {
  notifyParentMarketingSessionExpired()
})
</script>

<template>
  <div class="session-page">
    <div class="session-card">
      <div class="spinner" aria-hidden="true" />
      <h1>Reconnecting to Marketing</h1>
      <p class="subtitle">
        Your secure session ended. CRM is opening a new session — this usually takes a few seconds.
      </p>
      <p class="hint">If nothing happens, use <strong>Back</strong> in CRM and open Marketing again.</p>
    </div>
  </div>
</template>

<style scoped>
.session-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #f8fafc, #eef2ff 40%, #f3f4f6);
  padding: 24px;
}

.session-card {
  width: 100%;
  max-width: 420px;
  display: grid;
  gap: 12px;
  text-align: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 28px 24px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  color: #0f172a;
}

.subtitle {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.hint {
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.45;
}

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 6px;
  border: 3px solid #dbeafe;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
