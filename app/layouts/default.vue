<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="w-56 shrink-0 bg-white border-r border-slate-200/80 flex flex-col">
      <div class="p-5 border-b border-slate-200/80">
        <h1 class="text-lg font-semibold text-slate-800 tracking-tight">Mortdash</h1>
        <p class="text-xs text-slate-500 mt-0.5">Marketing</p>
      </div>
      <nav class="flex-1 p-3 space-y-0.5">
        <NuxtLink
          to="/client/dashboard"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
          active-class="!bg-slate-100 !text-slate-900"
        >
          <svg class="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/client/campaigns"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors relative after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:h-6 after:w-0.5 after:rounded-l after:bg-emerald-500 after:opacity-0 after:content-['']"
          active-class="!bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100 after:!opacity-100"
        >
          <svg class="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>Campaigns</span>
        </NuxtLink>
        <NuxtLink
          to="/client/email-editor"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
          active-class="!bg-slate-100 !text-slate-900"
        >
          <svg class="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Email Editor</span>
        </NuxtLink>
      </nav>
    </aside>
    <main class="flex-1 min-w-0">
      <slot />
    </main>
  </div>
</template>
