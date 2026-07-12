/** Reuse Nuxt payload/static data so list pages don’t refetch on every remount. */
export function readNuxtPayloadCache(key: string, nuxtApp: ReturnType<typeof useNuxtApp>) {
  return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
}
