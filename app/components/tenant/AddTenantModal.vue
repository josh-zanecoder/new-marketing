<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="compact-modal-backdrop"
      @click.self="emit('close')"
    >
      <div
        class="compact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tenant-title"
      >
        <div class="compact-modal__header">
          <div class="min-w-0">
            <h3 id="add-tenant-title" class="compact-modal__title">
              Add tenant
            </h3>
            <p class="compact-modal__subtitle">
              Create a new tenant in the registry.
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
            <label for="tenant-name" class="compact-modal-label">
              Tenant name
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="tenant-name"
              v-model="name"
              type="text"
              autocomplete="organization"
              required
              placeholder="Acme Corp"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field">
            <label for="tenant-email" class="compact-modal-label">
              Contact email
              <span class="field-required" aria-hidden="true">*</span>
            </label>
            <input
              id="tenant-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="client@company.com"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field">
            <label for="tenant-campaign-sender-name" class="compact-modal-label">
              Sender name <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="tenant-campaign-sender-name"
              v-model="defaultCampaignSenderName"
              type="text"
              autocomplete="organization"
              placeholder="Acme Marketing"
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field">
            <label for="tenant-campaign-sender-email" class="compact-modal-label">
              Sender email <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="tenant-campaign-sender-email"
              v-model="defaultCampaignSenderEmail"
              type="email"
              autocomplete="email"
              placeholder="marketing@company.com"
              title="Default From address for new campaigns. Leave empty to use the global fallback."
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="tenant-crm-url" class="compact-modal-label">
              CRM app URL <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <input
              id="tenant-crm-url"
              v-model="crmAppUrl"
              type="url"
              autocomplete="url"
              placeholder="https://crm.example.com"
              title="Used for “Back to CRM” when this tenant opens marketing from their CRM."
              class="compact-modal-input"
            >
          </div>

          <div class="compact-modal-field compact-modal-field--full">
            <label for="add-tenant-brevo-key" class="compact-modal-label">
              Brevo API key <span class="compact-modal-label-hint">(optional)</span>
            </label>
            <p class="mb-1.5 text-xs text-slate-500">
              Leave blank to use env <span class="font-mono">BREVO_API_KEY</span>.
            </p>
            <input
              id="add-tenant-brevo-key"
              v-model="brevoApiKey"
              type="password"
              autocomplete="off"
              placeholder="xkeysib-…"
              class="compact-modal-input compact-modal-input--mono"
            >
          </div>

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
              {{ isSubmitting ? 'Adding…' : 'Add tenant' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useSubmitting } from '~/composables/useSubmitting'

const props = defineProps<{
  open: boolean
  serverError?: string | null
}>()

const emit = defineEmits<{
  close: []
  submit: [{
    name: string
    email: string
    crmAppUrl?: string
    defaultCampaignSenderEmail?: string | null
    defaultCampaignSenderName?: string | null
    brevoApiKey?: string | null
  }]
}>()

const name = ref('')
const email = ref('')
const defaultCampaignSenderName = ref('')
const defaultCampaignSenderEmail = ref('')
const crmAppUrl = ref('')
const brevoApiKey = ref('')
const errorMessage = ref<string | null>(null)
const { isSubmitting, startSubmitting, stopSubmitting } = useSubmitting()

const displayError = computed(() => errorMessage.value || props.serverError || null)

function resetForm() {
  name.value = ''
  email.value = ''
  defaultCampaignSenderName.value = ''
  defaultCampaignSenderEmail.value = ''
  crmAppUrl.value = ''
  brevoApiKey.value = ''
  errorMessage.value = null
  stopSubmitting()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetForm()
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

  const trimmedSenderName = defaultCampaignSenderName.value.trim()
  const trimmedSenderEmail = defaultCampaignSenderEmail.value.trim()

  if (trimmedSenderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedSenderEmail)) {
    errorMessage.value = 'Please enter a valid default campaign sender email.'
    return
  }

  const trimmedCrm = crmAppUrl.value.trim()
  if (
    trimmedCrm
    && !/^https?:\/\/.+/i.test(trimmedCrm)
  ) {
    errorMessage.value = 'CRM app URL must start with http:// or https://'
    return
  }

  startSubmitting()
  emit('submit', {
    name: trimmedName,
    email: trimmedEmail,
    defaultCampaignSenderName: trimmedSenderName || null,
    defaultCampaignSenderEmail: trimmedSenderEmail
      ? trimmedSenderEmail.toLowerCase()
      : null,
    ...(trimmedCrm ? { crmAppUrl: trimmedCrm } : {}),
    ...(brevoApiKey.value.trim() ? { brevoApiKey: brevoApiKey.value.trim() } : {})
  })
}
</script>
