/** Reuse Nuxt payload/static data so list pages don’t refetch on every remount. */
export function readNuxtPayloadCache(key: string, nuxtApp: ReturnType<typeof useNuxtApp>) {
  return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
}

/** Drop a payload/static cache entry so the next visit refetches. */
export function clearNuxtPayloadCache(key: string, nuxtApp?: ReturnType<typeof useNuxtApp>) {
  const app = nuxtApp ?? useNuxtApp()
  if (app.payload.data && Object.prototype.hasOwnProperty.call(app.payload.data, key)) {
    delete app.payload.data[key]
  }
  if (app.static?.data && Object.prototype.hasOwnProperty.call(app.static.data, key)) {
    delete app.static.data[key]
  }
}

/** Shared key for recipient list index page cache. */
export const TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY = 'tenant-recipient-list-index'

/** Shared key for email templates index page cache. */
export const TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY = 'tenant-email-templates-index'

/** Shared key for contacts index page cache. */
export const TENANT_CONTACTS_INDEX_CACHE_KEY = 'tenant-contacts-index'

/** Shared key for campaign name picker (`useTenantCampaignsList`). */
export const TENANT_CAMPAIGNS_LIST_CACHE_KEY = 'tenant-campaigns-list'
