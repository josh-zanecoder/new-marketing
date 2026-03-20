<template>
  <section class="admin-page">
    <header class="page-header">
      <h1>Clients</h1>
      <p>Manage and review your client list</p>
    </header>

    <div class="table-card">
      <div class="table-head">
        <span>Name</span>
        <span>Email</span>
        <span>Status</span>
      </div>
      <div class="table-row">
        <span>No clients yet</span>
        <span>-</span>
        <span class="badge">Empty</span>
      </div>
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

.table-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 1.4fr 1.6fr 0.8fr;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  align-items: center;
}

.table-head {
  background: #f8fafc;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.table-row {
  font-size: 0.9rem;
  color: #0f172a;
}

.badge {
  width: fit-content;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
