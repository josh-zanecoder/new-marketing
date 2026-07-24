<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipient-edit-contact-title"
    >
      <div
        class="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="close"
      />
      <div
        class="relative flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-900/25 ring-1 ring-zinc-900/[0.04] sm:rounded-2xl"
        @click.stop
      >
        <div class="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span class="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-6 sm:py-5">
          <div class="min-w-0">
            <h2 id="recipient-edit-contact-title" class="text-base font-semibold text-zinc-900 sm:text-lg">
              Edit contact
            </h2>
            <p class="mt-1 text-xs text-zinc-500 sm:text-sm">
              Update contact details in your tenant database.
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 sm:h-auto sm:w-auto sm:border-0 sm:bg-transparent sm:px-2 sm:py-1 sm:shadow-none"
            aria-label="Close edit contact form"
            :disabled="submitting || loading"
            @click="close"
          >
            <svg class="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="hidden text-sm font-semibold text-zinc-600 sm:inline">Close</span>
          </button>
        </div>

        <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
          <div
            v-if="loading"
            class="flex min-h-0 flex-1 items-center justify-center px-4 py-12 sm:px-6"
          >
            <p class="text-sm font-medium text-zinc-500">
              Loading contact…
            </p>
          </div>
          <template v-else>
            <div class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
              <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
                <div>
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-first-name">
                    First name <span class="text-red-600">*</span>
                  </label>
                  <input
                    id="rl-edit-first-name"
                    v-model="form.firstName"
                    type="text"
                    required
                    autocomplete="given-name"
                    placeholder="John"
                    :class="INPUT_CLASS"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-last-name">
                    Last name <span class="text-red-600">*</span>
                  </label>
                  <input
                    id="rl-edit-last-name"
                    v-model="form.lastName"
                    type="text"
                    required
                    autocomplete="family-name"
                    placeholder="Doe"
                    :class="INPUT_CLASS"
                  >
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-zinc-700" for="rl-edit-email">
                  Email <span class="text-red-600">*</span>
                </label>
                <input
                  id="rl-edit-email"
                  v-model="form.email"
                  type="email"
                  required
                  autocomplete="email"
                  placeholder="john.doe@example.com"
                  :class="INPUT_CLASS"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-zinc-700" for="rl-edit-phone">Phone</label>
                <input
                  id="rl-edit-phone"
                  :value="form.phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  placeholder="(555) 123-4567"
                  :class="INPUT_CLASS"
                  @keydown="onPhoneKeydown"
                  @input="onPhoneInput"
                  @paste="onPhonePaste"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-zinc-700" for="rl-edit-company">Company</label>
                <input
                  id="rl-edit-company"
                  v-model="form.company"
                  type="text"
                  autocomplete="organization"
                  placeholder="Acme Inc."
                  :class="INPUT_CLASS"
                >
              </div>
              <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
                <div :class="typeOptions.length ? '' : 'min-[480px]:col-span-2'">
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-channel">Channel</label>
                  <input
                    id="rl-edit-channel"
                    v-model="form.channel"
                    type="text"
                    autocomplete="off"
                    placeholder="e.g. email"
                    :class="INPUT_CLASS"
                  >
                </div>
                <div v-if="typeOptions.length">
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-type">
                    Contact type <span class="text-red-600">*</span>
                  </label>
                  <select
                    id="rl-edit-type"
                    v-model="form.contactType"
                    required
                    :class="`${INPUT_CLASS} cursor-pointer appearance-none`"
                  >
                    <option
                      v-for="opt in typeOptions"
                      :key="opt.key"
                      :value="opt.key"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4">
                <div>
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-status">Status</label>
                  <input
                    id="rl-edit-status"
                    v-model="form.status"
                    type="text"
                    placeholder="e.g. prospect"
                    :class="INPUT_CLASS"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-zinc-700" for="rl-edit-stage">Stage</label>
                  <input
                    id="rl-edit-stage"
                    v-model="form.stage"
                    type="text"
                    placeholder="e.g. qualified"
                    :class="INPUT_CLASS"
                  >
                </div>
              </div>
              <fieldset class="space-y-3 rounded-xl border border-zinc-200/80 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
                <legend class="px-1 text-sm font-medium text-zinc-700">
                  Address
                </legend>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:gap-4">
                  <div class="sm:col-span-4">
                    <label class="block text-sm font-medium text-zinc-700" for="rl-edit-street">Street address</label>
                    <input
                      id="rl-edit-street"
                      v-model="form.addressStreet"
                      type="text"
                      autocomplete="street-address"
                      placeholder="123 Main Street"
                      :class="INPUT_CLASS"
                    >
                  </div>
                  <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-zinc-700" for="rl-edit-unit">Unit</label>
                    <input
                      id="rl-edit-unit"
                      v-model="form.addressUnit"
                      type="text"
                      autocomplete="address-line2"
                      placeholder="Apt 4B"
                      :class="INPUT_CLASS"
                    >
                  </div>
                </div>
                <div class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
                  <div>
                    <label class="block text-sm font-medium text-zinc-700" for="rl-edit-city">City</label>
                    <input
                      id="rl-edit-city"
                      v-model="form.addressCity"
                      type="text"
                      autocomplete="address-level2"
                      placeholder="New York"
                      :class="INPUT_CLASS"
                    >
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-zinc-700" for="rl-edit-state">State</label>
                    <input
                      id="rl-edit-state"
                      v-model="form.addressState"
                      type="text"
                      autocomplete="address-level1"
                      placeholder="NY"
                      :class="INPUT_CLASS"
                    >
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-zinc-700" for="rl-edit-county">County</label>
                    <input
                      id="rl-edit-county"
                      v-model="form.addressCounty"
                      type="text"
                      autocomplete="off"
                      placeholder="El Paso"
                      :class="INPUT_CLASS"
                    >
                  </div>
                </div>
              </fieldset>
              <p
                v-if="error"
                class="text-sm text-red-600"
                role="alert"
              >
                {{ error }}
              </p>
            </div>
            <div
              class="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pb-4"
            >
              <button
                type="submit"
                class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 sm:order-2 sm:w-auto"
                :disabled="submitting || loading"
              >
                {{ submitting ? 'Saving…' : 'Save changes' }}
              </button>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 sm:order-1 sm:w-auto"
                :disabled="submitting || loading"
                @click="close"
              >
                Cancel
              </button>
            </div>
          </template>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { TenantContactDetail, TenantContactTypeOption } from '~/types/tenantContact'
import { normalizeContactCounty } from '~~/shared/utils/contactAddress'
import {
  formatUsPhoneInput,
  isUsPhoneInputKeyAllowed
} from '~~/shared/utils/usNumberFormatter'

const props = defineProps<{
  open: boolean
  contactId: string
}>()

const emit = defineEmits<{
  close: []
  saved: [payload: {
    id: string
    firstName: string
    lastName: string
    name: string
    email: string
    phone: string
    company: string
    channel: string
    contactType: string[]
    address: {
      street: string
      unit: string
      city: string
      state: string
      county: string
    }
  }]
}>()

const marketingApi = useTenantMarketingApi()
const toast = useAppToast()

const INPUT_CLASS =
  'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm shadow-zinc-900/[0.04] ring-1 ring-zinc-900/[0.02] placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-[3px] focus:ring-violet-500/20'

const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const typeOptions = ref<TenantContactTypeOption[]>([])
const form = ref(emptyForm())
let escListener: ((e: KeyboardEvent) => void) | null = null

function emptyForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    contactType: '',
    channel: '',
    status: '',
    stage: '',
    addressStreet: '',
    addressUnit: '',
    addressCity: '',
    addressState: '',
    addressCounty: ''
  }
}

function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    if ('data' in err) {
      const data = (err as { data?: { message?: string; statusMessage?: string } }).data
      const message = data?.message ?? data?.statusMessage
      if (message) return String(message)
    }
    if ('message' in err) return String((err as { message?: string }).message)
  }
  return fallback
}

function populateFromDetail(contact: TenantContactDetail) {
  const defaultType = typeOptions.value[0]?.key ?? ''
  form.value = {
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    phone: contact.phone ? formatUsPhoneInput(contact.phone) : '',
    company: contact.company ?? '',
    contactType: contact.contactType?.[0] ?? defaultType,
    channel: contact.channel ?? '',
    status: contact.status ?? '',
    stage: contact.stage ?? '',
    addressStreet: contact.address?.street ?? '',
    addressUnit: contact.address?.unit ?? '',
    addressCity: contact.address?.city ?? '',
    addressState: contact.address?.state ?? '',
    addressCounty: contact.address?.county ?? ''
  }
}

function onPhoneKeydown(event: KeyboardEvent) {
  if (!isUsPhoneInputKeyAllowed(event)) event.preventDefault()
}

function onPhoneInput(event: Event) {
  const target = event.target as HTMLInputElement
  const formatted = formatUsPhoneInput(target.value)
  form.value.phone = formatted
  if (target.value !== formatted) target.value = formatted
}

function onPhonePaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text') ?? ''
  const target = event.target as HTMLInputElement
  const start = target.selectionStart ?? form.value.phone.length
  const end = target.selectionEnd ?? start
  const merged = form.value.phone.slice(0, start) + pasted + form.value.phone.slice(end)
  const formatted = formatUsPhoneInput(merged)
  form.value.phone = formatted
  target.value = formatted
}

function close() {
  if (submitting.value || loading.value) return
  emit('close')
}

async function load() {
  const id = props.contactId.trim()
  if (!id) {
    error.value = 'Missing contact id'
    return
  }
  loading.value = true
  error.value = ''
  form.value = emptyForm()
  try {
    const [detailRes, typesRes] = await Promise.all([
      $fetch<{ contact: TenantContactDetail }>(
        `/api/v1/tenant/contacts/${encodeURIComponent(id)}`,
        { credentials: 'include', ...serverAuthHeaders() }
      ),
      marketingApi.fetchRecipientListResource().catch(() => null)
    ])
    const types = (typesRes?.contactTypes ?? []).filter((t) => t.enabled !== false)
    typeOptions.value = [...types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    populateFromDetail(detailRes.contact)
  } catch (e: unknown) {
    error.value = extractErrorMessage(e, 'Failed to load contact')
    toast.error(error.value)
  } finally {
    loading.value = false
  }
}

async function submit() {
  const firstName = form.value.firstName.trim()
  const lastName = form.value.lastName.trim()
  const email = form.value.email.trim()
  if (!firstName) {
    error.value = 'First name is required.'
    toast.error(error.value)
    return
  }
  if (!lastName) {
    error.value = 'Last name is required.'
    toast.error(error.value)
    return
  }
  if (!email) {
    error.value = 'Email is required.'
    toast.error(error.value)
    return
  }
  if (typeOptions.value.length && !form.value.contactType.trim()) {
    error.value = 'Contact type is required.'
    toast.error('Please select a contact type.')
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const phone = form.value.phone.trim()
    const company = form.value.company.trim()
    const contactType = form.value.contactType.trim()
    const channel = form.value.channel.trim()
    const status = form.value.status.trim()
    const stage = form.value.stage.trim()
    const body: Parameters<typeof marketingApi.updateContact>[1] = {
      firstName,
      lastName,
      email,
      address: {
        street: form.value.addressStreet.trim(),
        unit: form.value.addressUnit.trim(),
        city: form.value.addressCity.trim(),
        state: form.value.addressState.trim(),
        county: normalizeContactCounty(form.value.addressCounty)
      }
    }
    if (phone) body.phone = phone
    if (company) body.company = company
    if (contactType) body.contactType = contactType
    if (channel) body.channel = channel
    if (status) body.status = status
    if (stage) body.stage = stage

    await marketingApi.updateContact(props.contactId, body)
    toast.success('Contact updated successfully.')
    emit('saved', {
      id: props.contactId,
      firstName,
      lastName,
      name: [firstName, lastName].filter(Boolean).join(' ').trim(),
      email,
      phone,
      company,
      channel,
      contactType: contactType ? [contactType] : [],
      address: {
        street: form.value.addressStreet.trim(),
        unit: form.value.addressUnit.trim(),
        city: form.value.addressCity.trim(),
        state: form.value.addressState.trim(),
        county: normalizeContactCounty(form.value.addressCounty)
      }
    })
    emit('close')
  } catch (e: unknown) {
    const message = extractErrorMessage(e, 'Failed to update contact')
    error.value = message
    if (message.toLowerCase().includes('email already exists')) {
      toast.error('A contact with this email already exists.')
    } else if (message.toLowerCase().includes('phone number already exists')) {
      toast.error('A contact with this phone number already exists.')
    } else {
      toast.error(message)
    }
  } finally {
    submitting.value = false
  }
}

watch(
  () => [props.open, props.contactId] as const,
  ([isOpen]) => {
    if (!import.meta.client) return
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (escListener) {
      window.removeEventListener('keydown', escListener)
      escListener = null
    }
    if (isOpen) {
      void load()
      escListener = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !submitting.value && !loading.value) close()
      }
      window.addEventListener('keydown', escListener)
    }
  }
)

onBeforeUnmount(() => {
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
  if (import.meta.client && props.open) document.body.style.overflow = ''
})
</script>
