<template>
  <Teleport to="body">
    <div
      v-if="props.open && props.tenant"
      class="compact-modal-backdrop"
      @click.self="emit('close')"
    >
      <div
        class="compact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tenant-title"
      >
        <div class="compact-modal__header">
          <div class="min-w-0">
            <h3 id="edit-tenant-title" class="compact-modal__title">
              Edit tenant
            </h3>
            <p class="compact-modal__subtitle">
              Registry: <span class="font-mono">{{ props.tenant.dbName }}</span>
            </p>
          </div>
          <button
            type="button"
            class="compact-modal__close"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form class="compact-modal-form" @submit.prevent="handleSubmit">
          <div class="compact-modal-field">
            <label for="edit-tenant-name" class="compact-modal-label">
              Tenant name
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-tenant-name"
              v-model="name"
              type="text"
              autocomplete="organization"
              required
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field">
            <label for="edit-tenant-email" class="compact-modal-label">
              Contact email
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-tenant-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="client@company.com"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-id" class="compact-modal-label">
              Tenant ID
              <span class="field-required" aria-hidden="true">*</span>
              <span class="compact-modal-label-hint">(CRM / integrations)</span>
            </label>
            <input
              id="edit-tenant-id"
              v-model="tenantId"
              type="text"
              autocomplete="off"
              required
              placeholder="UUID"
              class="compact-modal-input compact-modal-input--mono"
            >
          </div>

          <div class="compact-modal-field">
            <label for="edit-tenant-campaign-sender-name" class="compact-modal-label">
              Sender name <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="edit-tenant-campaign-sender-name"
              v-model="defaultCampaignSenderName"
              type="text"
              autocomplete="organization"
              placeholder="Acme Marketing"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field">
            <label for="edit-tenant-campaign-sender-email" class="compact-modal-label">
              Sender email <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="edit-tenant-campaign-sender-email"
              v-model="defaultCampaignSenderEmail"
              type="email"
              autocomplete="email"
              placeholder="marketing@company.com"
              title="Default From address for new campaigns. Clear to use the global fallback."
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-crm-url" class="compact-modal-label">
              CRM app URL <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="edit-tenant-crm-url"
              v-model="crmAppUrl"
              type="url"
              autocomplete="url"
              placeholder="https://crm.example.com"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-email-provider" class="compact-modal-label">
              Email provider
            </label>
            <select
              id="edit-tenant-email-provider"
              v-model="emailProvider"
              class="compact-modal-input"
            >
              <option value="BREVO">Brevo</option>
              <option value="ZC_MAIL">zcMail</option>
            </select>
            <p class="mt-1.5 text-xs text-slate-500">
              Campaigns and test sends use this provider. Ratesheet CRM uses the same zcMail API
              (<span class="font-mono">/v1/mail/bulk</span>).
            </p>
          </div>

          <template v-if="emailProvider === 'BREVO'">
          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-brevo-key" class="compact-modal-label">
              Brevo API key <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <p class="mb-1.5 text-xs text-slate-500">
              <template v-if="props.tenant?.brevoApiKeyConfigured">
                Custom key set
                <span v-if="props.tenant.brevoApiKeyPrefix" class="font-mono">
                  ({{ props.tenant.brevoApiKeyPrefix }})
                </span>
                — leave blank to keep, or clear to use env
                <span class="font-mono">BREVO_API_KEY</span>.
              </template>
              <template v-else>
                Using env <span class="font-mono">BREVO_API_KEY</span>. Paste a key to override for this tenant.
              </template>
            </p>
            <input
              id="edit-tenant-brevo-key"
              v-model="brevoApiKey"
              type="password"
              autocomplete="off"
              placeholder="xkeysib-…"
              class="compact-modal-input compact-modal-input--mono"
              :disabled="clearBrevoApiKey"
            >
            <label
              v-if="props.tenant?.brevoApiKeyConfigured"
              class="mt-2 flex items-center gap-2 text-xs text-slate-600"
            >
              <input v-model="clearBrevoApiKey" type="checkbox" class="rounded border-slate-300">
              Clear custom key (use env default)
            </label>
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-brevo-webhook-secret" class="compact-modal-label">
              Brevo webhook secret <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <p class="mb-1.5 text-xs text-slate-500">
              <template v-if="props.tenant?.brevoWebhookSecretConfigured">
                Custom secret set
                <span v-if="props.tenant.brevoWebhookSecretPrefix" class="font-mono">
                  ({{ props.tenant.brevoWebhookSecretPrefix }})
                </span>
                — leave blank to keep, or clear to use env
                <span class="font-mono">BREVO_WEBHOOK_SECRET</span>.
              </template>
              <template v-else>
                Using env <span class="font-mono">BREVO_WEBHOOK_SECRET</span>. Paste a secret to override for this tenant.
              </template>
            </p>
            <input
              id="edit-tenant-brevo-webhook-secret"
              v-model="brevoWebhookSecret"
              type="password"
              autocomplete="off"
              placeholder="Webhook shared secret"
              class="compact-modal-input compact-modal-input--mono"
              :disabled="clearBrevoWebhookSecret"
            >
            <label
              v-if="props.tenant?.brevoWebhookSecretConfigured"
              class="mt-2 flex items-center gap-2 text-xs text-slate-600"
            >
              <input v-model="clearBrevoWebhookSecret" type="checkbox" class="rounded border-slate-300">
              Clear custom secret (use env default)
            </label>
          </div>
          </template>

          <template v-else>
          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-zcmail-tenant" class="compact-modal-label">
              zcMail tenant name
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-tenant-zcmail-tenant"
              v-model="zcMailTenant"
              type="text"
              autocomplete="off"
              placeholder="SES TenantName / zc-mail tenant slug"
              class="compact-modal-input compact-modal-input--mono"
              required
            >
          </div>
          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-zcmail-base" class="compact-modal-label">
              zcMail base URL
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="edit-tenant-zcmail-base"
              v-model="zcMailBaseUrl"
              type="url"
              autocomplete="off"
              placeholder="https://apizcmail.zanecoder.com"
              class="compact-modal-input compact-modal-input--mono"
              required
            >
            <p class="mt-1.5 text-xs text-slate-500">
              Host Marketing can reach (posts to <span class="font-mono">/v1/mail/send</span> and
              <span class="font-mono">/v1/mail/bulk</span>). Do not use <span class="font-mono">0.0.0.0</span>.
            </p>
          </div>
          <div class="compact-modal-field compact-modal-field--full">
            <label for="edit-tenant-zcmail-key" class="compact-modal-label">
              zcMail API key
              <span
                v-if="!props.tenant?.zcMailApiKeyConfigured"
                class="field-required"
                aria-hidden="true"
              >*</span>
            </label>
            <p class="mb-1.5 text-xs text-slate-500">
              <template v-if="props.tenant?.zcMailApiKeyConfigured">
                Key set
                <span v-if="props.tenant.zcMailApiKeyPrefix" class="font-mono">
                  ({{ props.tenant.zcMailApiKeyPrefix }})
                </span>
                — leave blank to keep.
              </template>
              <template v-else>
                Paste a tenant-scoped zcMail API key (<span class="font-mono">zcm_…</span>).
              </template>
            </p>
            <input
              id="edit-tenant-zcmail-key"
              v-model="zcMailApiKey"
              type="password"
              autocomplete="off"
              placeholder="zcm_…"
              class="compact-modal-input compact-modal-input--mono"
              :disabled="clearZcMailApiKey"
            >
            <label
              v-if="props.tenant?.zcMailApiKeyConfigured"
              class="mt-2 flex items-center gap-2 text-xs text-slate-600"
            >
              <input v-model="clearZcMailApiKey" type="checkbox" class="rounded border-slate-300">
              Clear zcMail API key
            </label>
          </div>
          <div class="compact-modal-field compact-modal-field--full">
            <label class="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <input v-model="zcMailArchive" type="checkbox" class="rounded border-slate-300">
              Archive outbound mail in zcMail
            </label>
          </div>
          </template>

          <div v-if="displayError" class="compact-modal-error compact-modal-field--full">
            {{ displayError }}
          </div>

          <div class="compact-modal-footer compact-modal-field--full">
            <button
              type="button"
              class="btn-modal-cancel"
              :disabled="isSubmitting"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-modal-submit inline-flex items-center justify-center gap-2"
              :disabled="isSubmitting"
            >
              <svg
                v-if="isSubmitting"
                class="h-3.5 w-3.5 shrink-0 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {{ isSubmitting ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'
import { useSubmitting } from '~/composables/useSubmitting'

const props = defineProps<{
  open: boolean
  tenant: AdminTenantRow | null
  serverError?: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [{
    name: string
    email: string | null
    crmAppUrl: string | null
    tenantId: string | null
    defaultCampaignSenderEmail: string | null
    defaultCampaignSenderName: string | null
    /** Omit = keep; `null` = clear to env; string = set/replace. */
    brevoApiKey?: string | null
    /** Omit = keep; `null` = clear to env; string = set/replace. */
    brevoWebhookSecret?: string | null
    emailProvider?: 'BREVO' | 'ZC_MAIL'
    zcMailBaseUrl?: string | null
    zcMailTenant?: string | null
    zcMailArchive?: boolean
    zcMailApiKey?: string | null
  }]
}>()

const name = ref('')
const email = ref('')
const tenantId = ref('')
const defaultCampaignSenderName = ref('')
const defaultCampaignSenderEmail = ref('')
const crmAppUrl = ref('')
const brevoApiKey = ref('')
const clearBrevoApiKey = ref(false)
const brevoWebhookSecret = ref('')
const clearBrevoWebhookSecret = ref(false)
const emailProvider = ref<'BREVO' | 'ZC_MAIL'>('BREVO')
const zcMailTenant = ref('')
const zcMailBaseUrl = ref('')
const zcMailApiKey = ref('')
const clearZcMailApiKey = ref(false)
const zcMailArchive = ref(true)
const errorMessage = ref<string | null>(null)
const { isSubmitting, startSubmitting, stopSubmitting } = useSubmitting()

const displayError = computed(() => errorMessage.value || props.serverError || null)

function loadFromTenant(t: AdminTenantRow) {
  name.value = t.name
  email.value = t.email ?? ''
  tenantId.value = t.tenantId ?? ''
  defaultCampaignSenderName.value = t.defaultCampaignSenderName ?? ''
  defaultCampaignSenderEmail.value = t.defaultCampaignSenderEmail ?? ''
  crmAppUrl.value = t.crmAppUrl ?? ''
  brevoApiKey.value = ''
  clearBrevoApiKey.value = false
  brevoWebhookSecret.value = ''
  clearBrevoWebhookSecret.value = false
  emailProvider.value = t.emailProvider === 'ZC_MAIL' ? 'ZC_MAIL' : 'BREVO'
  zcMailTenant.value = t.zcMailTenant ?? ''
  zcMailBaseUrl.value = t.zcMailBaseUrl ?? ''
  zcMailApiKey.value = ''
  clearZcMailApiKey.value = false
  zcMailArchive.value = t.zcMailArchive !== false
}

function resetLocal() {
  errorMessage.value = null
  stopSubmitting()
}

watch(
  () => [props.open, props.tenant] as const,
  ([open, tenant]) => {
    if (open && tenant) {
      loadFromTenant(tenant)
      resetLocal()
    }
  }
)

watch(
  () => props.open,
  (open) => {
    if (!open) stopSubmitting()
  }
)

watch(
  () => props.serverError,
  () => {
    if (isSubmitting.value) stopSubmitting()
  }
)

function handleSubmit() {
  errorMessage.value = null

  const trimmedName = name.value.trim()
  const trimmedEmail = email.value.trim()
  const trimmedCrm = crmAppUrl.value.trim()
  const trimmedTid = tenantId.value.trim()
  const trimmedSenderName = defaultCampaignSenderName.value.trim()
  const trimmedSenderEmail = defaultCampaignSenderEmail.value.trim()

  if (!trimmedName) {
    errorMessage.value = 'Tenant name is required.'
    return
  }

  if (!trimmedEmail) {
    errorMessage.value = 'Contact email is required.'
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  if (!trimmedTid) {
    errorMessage.value = 'Tenant ID is required.'
    return
  }

  if (trimmedSenderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedSenderEmail)) {
    errorMessage.value = 'Please enter a valid default campaign sender email.'
    return
  }

  if (
    trimmedCrm
    && !/^https?:\/\/.+/i.test(trimmedCrm)
  ) {
    errorMessage.value = 'CRM app URL must start with http:// or https://'
    return
  }

  if (emailProvider.value === 'ZC_MAIL') {
    if (!zcMailTenant.value.trim()) {
      errorMessage.value = 'zcMail tenant name is required.'
      return
    }
    if (!zcMailBaseUrl.value.trim() || !/^https?:\/\/.+/i.test(zcMailBaseUrl.value.trim())) {
      errorMessage.value = 'zcMail base URL must start with http:// or https://'
      return
    }
    if (
      !props.tenant?.zcMailApiKeyConfigured
      && !zcMailApiKey.value.trim()
      && !clearZcMailApiKey.value
    ) {
      errorMessage.value = 'zcMail API key is required.'
      return
    }
  }

  startSubmitting()
  const payload: {
    name: string
    email: string | null
    crmAppUrl: string | null
    tenantId: string | null
    defaultCampaignSenderName: string | null
    defaultCampaignSenderEmail: string | null
    brevoApiKey?: string | null
    brevoWebhookSecret?: string | null
    emailProvider?: 'BREVO' | 'ZC_MAIL'
    zcMailBaseUrl?: string | null
    zcMailTenant?: string | null
    zcMailArchive?: boolean
    zcMailApiKey?: string | null
  } = {
    name: trimmedName,
    email: trimmedEmail.toLowerCase(),
    crmAppUrl: trimmedCrm || null,
    tenantId: trimmedTid,
    defaultCampaignSenderName: trimmedSenderName || null,
    defaultCampaignSenderEmail: trimmedSenderEmail
      ? trimmedSenderEmail.toLowerCase()
      : null,
    emailProvider: emailProvider.value
  }

  if (clearBrevoApiKey.value) {
    payload.brevoApiKey = null
  } else if (brevoApiKey.value.trim()) {
    payload.brevoApiKey = brevoApiKey.value.trim()
  }

  if (clearBrevoWebhookSecret.value) {
    payload.brevoWebhookSecret = null
  } else if (brevoWebhookSecret.value.trim()) {
    payload.brevoWebhookSecret = brevoWebhookSecret.value.trim()
  }

  if (emailProvider.value === 'ZC_MAIL') {
    payload.zcMailTenant = zcMailTenant.value.trim() || null
    payload.zcMailBaseUrl = zcMailBaseUrl.value.trim() || null
    payload.zcMailArchive = zcMailArchive.value !== false
    if (clearZcMailApiKey.value) {
      payload.zcMailApiKey = null
    } else if (zcMailApiKey.value.trim()) {
      payload.zcMailApiKey = zcMailApiKey.value.trim()
    }
  }

  emit('submit', payload)
}
</script>
