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
}>(`/api/v1/tenant/campaigns/${id}`)

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
  <div class="w-full min-w-0">
    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl 2xl:max-w-7xl">
      <NuxtLink
        to="/tenant/campaigns"
        class="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
        @click="campaignStore.fetchCampaigns()"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-500 transition group-hover:bg-zinc-200/80 group-hover:text-zinc-800">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        Back to campaigns
      </NuxtLink>

      <div
        v-if="error"
        class="flex gap-3 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3.5 text-sm text-red-900 shadow-sm"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Campaign not found
      </div>

      <!-- Loading skeleton -->
      <div v-else-if="showSkeleton" class="space-y-8 animate-pulse sm:space-y-10">
        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1 space-y-4">
            <div class="flex gap-2">
              <div class="h-4 w-24 rounded-md bg-zinc-200" />
              <div class="h-4 w-4 rounded bg-zinc-200" />
              <div class="h-4 w-32 rounded-md bg-zinc-200" />
            </div>
            <div class="h-9 max-w-xl rounded-xl bg-zinc-200" />
            <div class="h-4 w-56 rounded-md bg-zinc-200" />
          </div>
          <div class="flex shrink-0 gap-3">
            <div class="h-10 w-24 rounded-xl bg-zinc-200" />
            <div class="h-10 w-28 rounded-full bg-zinc-200" />
          </div>
        </header>

        <div class="flex flex-col gap-8 xl:grid xl:grid-cols-12 xl:items-start xl:gap-10 2xl:gap-12">
          <div class="min-w-0 space-y-8 xl:col-span-5 2xl:col-span-4">
            <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10 xl:grid-cols-1 xl:gap-8">
              <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
                <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
                  <div class="h-3.5 w-24 rounded bg-zinc-200" />
                </div>
                <div class="divide-y divide-zinc-100 px-5 py-4 space-y-6 sm:px-6 sm:py-5">
                  <div v-for="n in 4" :key="n" class="grid gap-3 sm:grid-cols-3">
                    <div class="h-4 w-20 rounded bg-zinc-200" />
                    <div class="h-4 sm:col-span-2 rounded-lg bg-zinc-200" />
                  </div>
                </div>
              </div>
              <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
                <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
                  <div class="h-3.5 w-40 rounded bg-zinc-200" />
                </div>
                <ul class="divide-y divide-zinc-100 px-5 py-1 sm:px-6">
                  <li v-for="n in 5" :key="n" class="flex items-center justify-between gap-4 py-3.5">
                    <div class="h-4 flex-1 max-w-[280px] rounded bg-zinc-200" />
                    <div class="h-6 w-14 shrink-0 rounded-full bg-zinc-200" />
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="min-w-0 xl:col-span-7 2xl:col-span-8 xl:sticky xl:top-6 xl:self-start">
            <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
              <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
                <div class="h-3.5 w-32 rounded bg-zinc-200" />
              </div>
              <div class="min-h-[400px] bg-zinc-100/80 p-4 sm:p-6 xl:min-h-[min(55vh,480px)] 2xl:min-h-[min(60vh,560px)]">
                <div class="mx-auto h-full min-h-[360px] max-w-3xl rounded-xl bg-zinc-200 2xl:max-w-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="campaign" class="space-y-8 sm:space-y-10">
        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <nav class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
              <NuxtLink
                to="/tenant/campaigns"
                class="font-medium text-zinc-600 transition-colors hover:text-zinc-900"
                @click="campaignStore.fetchCampaigns()"
              >
                Campaigns
              </NuxtLink>
              <span class="text-zinc-300" aria-hidden="true">/</span>
              <span class="truncate text-zinc-700">{{ campaign.name }}</span>
            </nav>
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {{ campaign.name }}
            </h1>
            <p class="mt-2 text-sm text-zinc-500 sm:text-[15px]">
              Created {{ formatDate(campaign.createdAt) }}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <NuxtLink
              v-if="campaign.status === 'Draft' || campaign.status === 'Failed'"
              :to="`/tenant/campaigns/add?id=${campaign.id}`"
              class="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:text-[15px]"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </NuxtLink>
            <span
              class="inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 sm:px-4 sm:py-2 sm:text-[15px]"
              :class="{
                'bg-amber-50 text-amber-800 ring-amber-200/80': campaign.status === 'Draft',
                'bg-blue-50 text-blue-800 ring-blue-200/80': campaign.status === 'Scheduled' || campaign.status === 'Sending',
                'bg-emerald-50 text-emerald-800 ring-emerald-200/80': campaign.status === 'Sent',
                'bg-red-50 text-red-800 ring-red-200/80': campaign.status === 'Failed',
                'bg-zinc-50 text-zinc-700 ring-zinc-200/80': !['Draft','Scheduled','Sending','Sent','Failed'].includes(campaign.status)
              }"
            >
              {{ campaign.status }}
            </span>
          </div>
        </header>

        <div class="flex flex-col gap-8 sm:gap-10 xl:grid xl:grid-cols-12 xl:items-start xl:gap-10 2xl:gap-12">
          <div class="min-w-0 space-y-8 xl:col-span-5 2xl:col-span-4 xl:space-y-8">
            <div
              class="grid grid-cols-1 gap-8 lg:gap-10 xl:gap-8"
              :class="{
                'lg:grid-cols-2 xl:grid-cols-1':
                  campaign.recipients?.length &&
                  (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list')
              }"
            >
              <div class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
                <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
                  <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Details
                  </h2>
                </div>
                <dl class="divide-y divide-zinc-100">
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-zinc-500 sm:text-[15px]">Sender</dt>
                    <dd class="break-words text-sm text-zinc-900 sm:col-span-2 sm:text-[15px]">
                      {{ campaign.sender?.name }} &lt;{{ campaign.sender?.email }}&gt;
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-zinc-500 sm:text-[15px]">Subject</dt>
                    <dd class="break-words text-sm text-zinc-900 sm:col-span-2 sm:text-[15px]">
                      {{ campaign.subject || '–' }}
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-zinc-500 sm:text-[15px]">Recipients</dt>
                    <dd class="text-sm text-zinc-900 sm:col-span-2 sm:text-[15px]">
                      <span v-if="campaign.recipientsType === 'manual'">
                        {{ campaign.recipients?.length ?? 0 }} manual recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }}
                      </span>
                      <span v-else-if="campaign.recipientsType === 'list'">
                        {{ campaign.recipients?.length ?? 0 }} recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }} from list
                      </span>
                      <span v-else>–</span>
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-zinc-500 sm:text-[15px]">Updated</dt>
                    <dd class="text-sm text-zinc-900 sm:col-span-2 sm:text-[15px]">
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
                class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
              >
                <div class="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Recipients ({{ campaign.recipients.length }})
                  </h2>
                  <div
                    v-if="campaign.recipients.some(r => r.status)"
                    class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 sm:text-sm"
                  >
                    <span class="text-amber-700">Pending: {{ campaign.recipients.filter(r => r.status === 'pending').length }}</span>
                    <span class="text-emerald-700">Sent: {{ campaign.recipients.filter(r => r.status === 'sent').length }}</span>
                    <span class="text-red-700">Failed: {{ campaign.recipients.filter(r => r.status === 'failed').length }}</span>
                  </div>
                </div>
                <ul class="max-h-80 divide-y divide-zinc-100 overflow-y-auto xl:max-h-[min(52vh,28rem)]">
                  <li
                    v-for="(r, i) in campaign.recipients"
                    :key="i"
                    class="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/50 sm:px-6"
                  >
                    <div class="min-w-0 flex-1">
                      <span class="text-sm text-zinc-900 sm:text-[15px]">{{ r.email }}</span>
                      <p
                        v-if="r.status === 'failed' && r.error"
                        class="mt-1 truncate text-sm text-red-600"
                        :title="r.error"
                      >
                        {{ r.error }}
                      </p>
                    </div>
                    <span
                      v-if="r.status"
                      class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 sm:px-3 sm:py-1 sm:text-sm"
                      :class="{
                        'bg-amber-50 text-amber-800 ring-amber-200/70': r.status === 'pending',
                        'bg-emerald-50 text-emerald-800 ring-emerald-200/70': r.status === 'sent',
                        'bg-red-50 text-red-800 ring-red-200/70': r.status === 'failed'
                      }"
                    >
                      {{ r.status }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="min-w-0 xl:col-span-7 2xl:col-span-8 xl:sticky xl:top-6 xl:self-start">
            <div v-if="campaign.templateHtml" class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]">
              <div class="border-b border-zinc-100 px-5 py-4 sm:px-6">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Email preview
                </h2>
              </div>
              <div class="relative min-h-[400px] max-h-[600px] overflow-auto bg-[#f8f4ef] p-4 sm:p-6 xl:min-h-[min(52vh,560px)] xl:max-h-[min(88vh,920px)] 2xl:min-h-[min(58vh,640px)]">
                <iframe
                  :srcdoc="previewSrcdoc(campaign.templateHtml)"
                  title="Email preview"
                  class="min-h-[400px] w-full border-0 xl:min-h-[min(48vh,520px)]"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <div
              v-else
              class="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-5 py-10 text-center sm:px-8 sm:py-12 xl:py-16"
            >
              <p class="text-sm text-zinc-500 sm:text-[15px]">No email template</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
