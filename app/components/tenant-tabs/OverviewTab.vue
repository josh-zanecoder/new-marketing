<template>
  <div
    class="w-full rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-8"
  >
    <dl class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Email
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          {{ tenant.email || '—' }}
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          CRM URL
        </dt>
        <dd class="mt-2 min-w-0 text-sm font-medium">
          <a
            v-if="tenant.crmAppUrl"
            :href="tenant.crmAppUrl"
            class="break-all text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ tenant.crmAppUrl }}
          </a>
          <span v-else class="text-slate-400">—</span>
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Tenant ID
        </dt>
        <dd
          class="mt-2 break-all font-mono text-xs font-medium leading-relaxed text-slate-800"
          :title="tenant.tenantId || undefined"
        >
          {{ tenant.tenantId || '—' }}
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          API key prefix
        </dt>
        <dd class="mt-2 font-mono text-xs font-medium text-slate-800">
          {{ tenant.apiKeyPrefix || '—' }}
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Created
        </dt>
        <dd class="mt-2 text-sm font-medium text-slate-900" :title="tenant.createdAt">
          {{ formatCreatedAt(tenant.createdAt) }}
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:col-span-2 sm:px-5 sm:py-4 xl:col-span-3"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Outbound Kafka topic
        </dt>
        <dd class="mt-2 break-all font-mono text-xs font-medium leading-relaxed text-slate-800">
          <template v-if="tenant.kafkaOutboundTopic">
            {{ tenant.kafkaOutboundTopic }}
          </template>
          <template v-else>
            <span class="text-slate-500">Default</span>
            <span class="text-slate-400"> — uses </span>
            <span class="text-slate-600">{{ defaultKafkaPattern }}</span>
          </template>
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tenant: {
    email: string | null
    crmAppUrl: string | null
    tenantId: string | null
    apiKeyPrefix: string | null
    createdAt: string
    kafkaOutboundTopic: string | null
  }
}>()

const defaultKafkaPattern = 'marketing.events.<tenant>'

function formatCreatedAt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d)
  } catch {
    return iso
  }
}
</script>
