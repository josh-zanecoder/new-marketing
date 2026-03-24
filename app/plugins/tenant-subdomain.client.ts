export default defineNuxtPlugin(() => {
  const original = globalThis.$fetch
  if (!original) return
  globalThis.$fetch = original.create({
    onRequest({ options }) {
      const { getTenantHeaders } = useTenant()
      const headers = getTenantHeaders()
      if (!Object.keys(headers).length) return
      const merged = new Headers((options.headers || {}) as HeadersInit)
      for (const [k, v] of Object.entries(headers)) merged.set(k, v)
      options.headers = merged
    }
  }) as typeof $fetch
})
