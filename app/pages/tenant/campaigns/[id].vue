<script setup lang="ts">
import { useCampaignStore } from '~/store/campaignStore'

const route = useRoute()
const campaignStore = useCampaignStore()
const id = route.params.id as string

const { data, error, pending } = await useFetch<{
  campaign: {
    id: string
    name: string
    sender: { name: string; email: string }
    recipientsType: 'manual' | 'list'
    recipientsListId?: string
    subject: string
    status: string
    recipients: { email: string; status?: string; sentAt?: string; error?: string }[]
    emailTemplate?: { name: string; html: string }
    templateHtml?: string | null
    createdAt: string
    updatedAt: string
  }
}>(`/api/v1/campaigns/${id}`)

const campaign = computed(() => data.value?.campaign ?? null)

const showSkeleton = computed(() => pending.value && !error.value)

function previewSrcdoc(html: string, scale = 0.45) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:center top;width:600px}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}

function formatDate(d: string) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
    <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl lg:px-8">
      <NuxtLink
        to="/tenant/campaigns"
        class="mb-10 inline-flex items-center gap-2.5 text-base font-medium text-slate-600 hover:text-slate-900 transition-colors"
        @click="campaignStore.fetchCampaigns()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to campaigns
      </NuxtLink>

      <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
        Campaign not found
      </div>

      <!-- Loading skeleton -->
      <div v-else-if="showSkeleton" class="space-y-10 animate-pulse">
        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1 space-y-4">
            <div class="flex gap-2">
              <div class="h-4 w-24 rounded-md bg-slate-200" />
              <div class="h-4 w-4 rounded bg-slate-200" />
              <div class="h-4 w-32 rounded-md bg-slate-200" />
            </div>
            <div class="h-10 max-w-xl rounded-lg bg-slate-200" />
            <div class="h-5 w-56 rounded-md bg-slate-200" />
          </div>
          <div class="flex shrink-0 gap-3">
            <div class="h-10 w-24 rounded-lg bg-slate-200" />
            <div class="h-10 w-28 rounded-full bg-slate-200" />
          </div>
        </header>

        <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
            <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5">
              <div class="h-4 w-24 rounded bg-slate-200" />
            </div>
            <div class="divide-y divide-slate-100 px-8 py-5 space-y-6">
              <div v-for="n in 4" :key="n" class="grid gap-3 sm:grid-cols-3">
                <div class="h-5 w-20 rounded bg-slate-200" />
                <div class="h-5 sm:col-span-2 rounded-lg bg-slate-200" />
              </div>
            </div>
          </div>
          <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
            <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5">
              <div class="h-4 w-40 rounded bg-slate-200" />
            </div>
            <ul class="divide-y divide-slate-100 px-8 py-2 space-y-0">
              <li v-for="n in 5" :key="n" class="flex items-center justify-between gap-4 py-4">
                <div class="h-5 flex-1 max-w-[280px] rounded bg-slate-200" />
                <div class="h-7 w-16 shrink-0 rounded-full bg-slate-200" />
              </li>
            </ul>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
          <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5">
            <div class="h-4 w-32 rounded bg-slate-200" />
          </div>
          <div class="min-h-[400px] bg-slate-100 p-6">
            <div class="mx-auto h-full min-h-[360px] max-w-2xl rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>

      <div v-else-if="campaign" class="space-y-10">
        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <nav class="mb-3 flex items-center gap-2 text-base text-slate-500">
              <NuxtLink to="/tenant/campaigns" class="hover:text-slate-700 transition-colors">Campaigns</NuxtLink>
              <span>/</span>
              <span class="text-slate-700">{{ campaign.name }}</span>
            </nav>
            <h1 class="text-4xl font-bold text-slate-900 tracking-tight">{{ campaign.name }}</h1>
            <p class="mt-2 text-lg text-slate-600">
              Created {{ formatDate(campaign.createdAt) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <NuxtLink
              v-if="campaign.status === 'Draft' || campaign.status === 'Failed'"
              :to="`/tenant/campaigns/add?id=${campaign.id}`"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </NuxtLink>
            <span
              class="inline-flex rounded-full px-5 py-2 text-base font-semibold"
              :class="{
                'bg-amber-100 text-amber-700': campaign.status === 'Draft',
                'bg-blue-100 text-blue-700': campaign.status === 'Scheduled' || campaign.status === 'Sending',
                'bg-emerald-100 text-emerald-700': campaign.status === 'Sent',
                'bg-red-100 text-red-700': campaign.status === 'Failed',
                'bg-slate-100 text-slate-600': !['Draft','Scheduled','Sending','Sent','Failed'].includes(campaign.status)
              }"
            >
              {{ campaign.status }}
            </span>
          </div>
        </header>

        <div
          class="grid grid-cols-1 gap-10"
          :class="{
            'lg:grid-cols-2':
              campaign.recipients?.length &&
              (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list')
          }"
        >
          <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
            <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5">
              <h2 class="text-base font-semibold text-slate-600 uppercase tracking-wider">Details</h2>
            </div>
            <dl class="divide-y divide-slate-100">
              <div class="grid grid-cols-1 gap-3 px-8 py-5 sm:grid-cols-3 sm:gap-4">
                <dt class="text-base font-medium text-slate-500">Sender</dt>
                <dd class="text-base text-slate-900 sm:col-span-2">
                  {{ campaign.sender?.name }} &lt;{{ campaign.sender?.email }}&gt;
                </dd>
              </div>
              <div class="grid grid-cols-1 gap-3 px-8 py-5 sm:grid-cols-3 sm:gap-4">
                <dt class="text-base font-medium text-slate-500">Subject</dt>
                <dd class="text-base text-slate-900 sm:col-span-2">
                  {{ campaign.subject || '–' }}
                </dd>
              </div>
              <div class="grid grid-cols-1 gap-3 px-8 py-5 sm:grid-cols-3 sm:gap-4">
                <dt class="text-base font-medium text-slate-500">Recipients</dt>
                <dd class="text-base text-slate-900 sm:col-span-2">
                  <span v-if="campaign.recipientsType === 'manual'">
                    {{ campaign.recipients?.length ?? 0 }} manual recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }}
                  </span>
                  <span v-else-if="campaign.recipientsType === 'list'">
                    {{ campaign.recipients?.length ?? 0 }} recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }} from list
                  </span>
                  <span v-else>–</span>
                </dd>
              </div>
              <div class="grid grid-cols-1 gap-3 px-8 py-5 sm:grid-cols-3 sm:gap-4">
                <dt class="text-base font-medium text-slate-500">Updated</dt>
                <dd class="text-base text-slate-900 sm:col-span-2">
                  {{ formatDate(campaign.updatedAt) }}
                </dd>
              </div>
            </dl>
          </div>

          <div
            v-if="
              campaign.recipients?.length &&
              (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list')
            "
            class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden"
          >
            <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5 flex items-center justify-between">
              <h2 class="text-base font-semibold text-slate-700 uppercase tracking-wider">Recipients ({{ campaign.recipients.length }})</h2>
              <div v-if="campaign.recipients.some(r => r.status)" class="flex gap-4 text-sm">
                <span class="text-amber-600">Pending: {{ campaign.recipients.filter(r => r.status === 'pending').length }}</span>
                <span class="text-green-600">Sent: {{ campaign.recipients.filter(r => r.status === 'sent').length }}</span>
                <span class="text-red-600">Failed: {{ campaign.recipients.filter(r => r.status === 'failed').length }}</span>
              </div>
            </div>
            <ul class="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              <li v-for="(r, i) in campaign.recipients" :key="i" class="px-8 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
            <div class="min-w-0 flex-1">
              <span class="text-base text-slate-900">{{ r.email }}</span>
              <p v-if="r.status === 'failed' && r.error" class="mt-1 text-sm text-red-600 truncate" :title="r.error">
                {{ r.error }}
              </p>
            </div>
            <span
              v-if="r.status"
              class="shrink-0 rounded-full px-3 py-1 text-sm font-medium"
              :class="{
                'bg-amber-100 text-amber-800': r.status === 'pending',
                'bg-green-100 text-green-800': r.status === 'sent',
                'bg-red-100 text-red-800': r.status === 'failed'
              }"
            >
              {{ r.status }}
            </span>
              </li>
            </ul>
          </div>
        </div>

      <div v-if="campaign.templateHtml" class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
        <div class="border-b border-slate-100 bg-slate-50/80 px-8 py-5">
          <h2 class="text-base font-semibold text-slate-600 uppercase tracking-wider">Email preview</h2>
        </div>
        <div class="relative min-h-[400px] max-h-[600px] overflow-auto bg-[#f8f4ef] p-6">
          <iframe
            :srcdoc="previewSrcdoc(campaign.templateHtml)"
            title="Email preview"
            class="w-full min-h-[400px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      <div v-else class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 px-8 py-12 text-center">
        <p class="text-base text-slate-500">No email template</p>
      </div>
    </div>
    </div>
  </div>
</template>
