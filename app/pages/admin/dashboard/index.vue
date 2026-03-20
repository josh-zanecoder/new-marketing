<template>
  <section class="admin-page">
    <header class="page-header">
      <h1>Dashboard</h1>
      <p>Quick overview of your activity</p>
    </header>

    <div class="stats-grid">
      <article class="stat-card">
        <span>Total Clients</span>
        <strong>0</strong>
      </article>
      <article class="stat-card">
        <span>Active Campaigns</span>
        <strong>0</strong>
      </article>
      <article class="stat-card">
        <span>Emails Sent</span>
        <strong>0</strong>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
</script>

<style scoped>
.admin-page {
  padding: 1.5rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.page-header p {
  margin: 0.35rem 0 1.25rem;
  color: #64748b;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.stat-card span {
  display: block;
  color: #64748b;
  font-size: 0.875rem;
}

.stat-card strong {
  display: block;
  margin-top: 0.5rem;
  font-size: 1.5rem;
  color: #0f172a;
}
</style>
