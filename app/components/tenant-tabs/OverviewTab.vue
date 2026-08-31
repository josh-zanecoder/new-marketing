<template>
  <div class="surface-card w-full p-6 sm:p-8">
    <dl class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div class="overview-identity-field">
        <dt class="overview-field-label">
          Email
        </dt>
        <dd class="overview-field-value">
          {{ tenant.email || '—' }}
        </dd>
      </div>

      <div class="overview-identity-field">
        <dt class="overview-field-label">
          CRM URL
        </dt>
        <dd class="overview-field-value min-w-0">
          <a
            v-if="tenant.crmAppUrl"
            :href="tenant.crmAppUrl"
            class="overview-field-link"
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
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Campaign sender
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          <template v-if="tenant.defaultCampaignSenderEmail || tenant.defaultCampaignSenderName">
            <span v-if="tenant.defaultCampaignSenderName">{{ tenant.defaultCampaignSenderName }}</span>
            <span v-if="tenant.defaultCampaignSenderEmail">
              <span v-if="tenant.defaultCampaignSenderName"> &lt;</span>{{ tenant.defaultCampaignSenderEmail }}<span v-if="tenant.defaultCampaignSenderName">&gt;</span>
            </span>
          </template>
          <span v-else class="text-slate-400">Global default</span>
        </dd>
      </div>

      <div
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Email provider
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          {{ tenant.emailProvider === 'ZC_MAIL' ? 'zcMail' : 'Brevo' }}
        </dd>
      </div>

      <div
        v-if="tenant.emailProvider === 'ZC_MAIL'"
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          zcMail tenant
        </dt>
        <dd class="mt-2 break-words font-mono text-xs font-medium text-slate-800">
          {{ tenant.zcMailTenant || '—' }}
        </dd>
      </div>

      <div
        v-if="tenant.emailProvider === 'ZC_MAIL'"
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          zcMail API key
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          <template v-if="tenant.zcMailApiKeyConfigured">
            Set
            <span v-if="tenant.zcMailApiKeyPrefix" class="font-mono text-xs text-slate-600">
              ({{ tenant.zcMailApiKeyPrefix }})
            </span>
          </template>
          <span v-else class="text-slate-400">Not set</span>
        </dd>
      </div>

      <div
        v-if="tenant.emailProvider !== 'ZC_MAIL'"
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Brevo API key
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          <template v-if="tenant.brevoApiKeyConfigured">
            Custom
            <span v-if="tenant.brevoApiKeyPrefix" class="font-mono text-xs text-slate-600">
              ({{ tenant.brevoApiKeyPrefix }})
            </span>
          </template>
          <span v-else class="text-slate-400">Env default</span>
        </dd>
      </div>

      <div
        v-if="tenant.emailProvider !== 'ZC_MAIL'"
        class="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-4"
      >
        <dt class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Brevo webhook secret
        </dt>
        <dd class="mt-2 break-words text-sm font-medium text-slate-900">
          <template v-if="tenant.brevoWebhookSecretConfigured">
            Custom
            <span
              v-if="tenant.brevoWebhookSecretPrefix"
              class="font-mono text-xs text-slate-600"
            >
              ({{ tenant.brevoWebhookSecretPrefix }})
            </span>
          </template>
          <span v-else class="text-slate-400">Env default</span>
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
    defaultCampaignSenderEmail: string | null
    defaultCampaignSenderName: string | null
    brevoApiKeyConfigured?: boolean
    brevoApiKeyPrefix?: string | null
    brevoWebhookSecretConfigured?: boolean
    brevoWebhookSecretPrefix?: string | null
    emailProvider?: 'BREVO' | 'ZC_MAIL'
    zcMailTenant?: string | null
    zcMailApiKeyConfigured?: boolean
    zcMailApiKeyPrefix?: string | null
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

<style scoped>
.overview-identity-field {
  border-radius: var(--radius-card);
  border: 1px solid var(--border-slate);
  background: #fff;
  padding: 1.25rem 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.overview-identity-field:hover {
  box-shadow: var(--shadow-md);
}

.overview-field-label {
  font-size: var(--font-size-base-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}

.overview-field-value {
  margin-top: 0.625rem;
  word-break: break-word;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-snug);
  color: var(--text-heading);
}

.overview-field-link {
  display: inline-block;
  max-width: 100%;
  word-break: break-all;
  color: var(--color-primary);
  transition: color var(--transition-fast);
}

.overview-field-link:hover {
  color: var(--primary-700);
}
</style>
