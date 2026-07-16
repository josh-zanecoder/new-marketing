<script setup lang="ts">
const {
  subject,
  body,
  senderName,
  senderEmail,
  recipientsListId,
  recipientLists,
  recipientListsPending,
  recipientListsError,
  saveError,
  isSending,
  canSend,
  bootstrap,
  sendCustomMarketing
} = useCustomMarketingCompose()

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl antialiased">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Custom Marketing
      </h1>
      <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
        Compose a personal-looking email. Edit the subject and body before sending in bulk.
      </p>
    </header>

    <div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">From</label>
        <p class="mt-1 text-sm text-slate-800 sm:text-[15px]">
          <span v-if="senderName || senderEmail">{{ senderName }} &lt;{{ senderEmail }}&gt;</span>
          <span v-else class="text-slate-400">Loading sender…</span>
        </p>
      </div>

      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label for="custom-marketing-to" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          To
        </label>
        <select
          id="custom-marketing-to"
          v-model="recipientsListId"
          class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-[15px]"
          :disabled="recipientListsPending"
        >
          <option value="">
            {{ recipientListsPending ? 'Loading lists…' : 'Choose a recipient list' }}
          </option>
          <option
            v-for="list in recipientLists"
            :key="list.id"
            :value="list.id"
          >
            {{ list.name }}
          </option>
        </select>
        <p v-if="recipientListsError" class="mt-2 text-sm text-red-600">{{ recipientListsError }}</p>
        <p
          v-else-if="!recipientListsPending && !recipientLists.length"
          class="mt-2 text-sm text-slate-500"
        >
          No recipient lists yet.
          <NuxtLink to="/tenant/recipient-list/add" class="font-semibold text-indigo-600 underline hover:text-indigo-700">
            Create one
          </NuxtLink>
        </p>
      </div>

      <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
        <label for="custom-marketing-subject" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Subject
        </label>
        <input
          id="custom-marketing-subject"
          v-model="subject"
          type="text"
          autocomplete="off"
          placeholder="Email subject"
          class="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
        >
      </div>

      <div class="px-5 py-4 sm:px-6 sm:py-5">
        <label for="custom-marketing-body" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Message
        </label>
        <textarea
          id="custom-marketing-body"
          v-model="body"
          rows="14"
          placeholder="Write your message…"
          class="w-full resize-y rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:text-[15px]"
        />
        <p class="mt-2 text-xs text-slate-500">
          Looks like a regular email when sent. Merge tags such as
          <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">&#123;&#123; recipient.firstName &#125;&#125;</code>
          are supported.
        </p>
      </div>
    </div>

    <div
      v-if="saveError"
      class="mt-4 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900"
      role="alert"
    >
      {{ saveError }}
    </div>

    <div class="mt-8 flex justify-end">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSend"
        @click="sendCustomMarketing"
      >
        {{ isSending ? 'Sending…' : 'Send' }}
      </button>
    </div>
  </div>
</template>
