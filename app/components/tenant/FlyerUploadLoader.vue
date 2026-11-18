<script setup lang="ts">
const props = defineProps<{
  open: boolean
  flyerName: string
}>()

const { title, hint } = useFlyerUploadLoaderCopy(toRef(props, 'open'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Uploading flyer"
    >
      <div
        class="w-full max-w-sm rounded-2xl border border-white/10 bg-white px-6 py-8 text-center shadow-2xl shadow-slate-900/25"
      >
        <div class="flyer-upload-loader__stack" aria-hidden="true">
          <div class="flyer-upload-loader__sheet flyer-upload-loader__sheet--left">
            <div class="flyer-upload-loader__sheet-bar" />
            <div class="flyer-upload-loader__sheet-bar" />
          </div>
          <div class="flyer-upload-loader__sheet flyer-upload-loader__sheet--right">
            <div class="flyer-upload-loader__sheet-bar" />
            <div class="flyer-upload-loader__sheet-bar" />
          </div>
          <div class="flyer-upload-loader__sheet flyer-upload-loader__sheet--front">
            <div class="flyer-upload-loader__sheet-icon">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.75"
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
            <div class="flyer-upload-loader__sheet-bar flyer-upload-loader__sheet-bar--accent" />
            <div class="flyer-upload-loader__sheet-bar flyer-upload-loader__sheet-bar--accent" />
          </div>
        </div>

        <p class="mt-5 text-base font-semibold tracking-tight text-zinc-900">
          {{ title }}
        </p>
        <p
          v-if="flyerName"
          class="mt-1.5 truncate text-sm font-medium text-primary-700"
          :title="flyerName"
        >
          “{{ flyerName }}”
        </p>
        <p class="flyer-upload-loader__hint mt-2 min-h-[2.5rem] text-sm leading-relaxed text-zinc-500">
          {{ hint }}
        </p>

        <div class="flyer-upload-loader__track mt-5" aria-hidden="true">
          <div class="flyer-upload-loader__shimmer" />
        </div>
        <div class="flyer-upload-loader__dots" aria-hidden="true">
          <span class="flyer-upload-loader__dot" />
          <span class="flyer-upload-loader__dot" />
          <span class="flyer-upload-loader__dot" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
