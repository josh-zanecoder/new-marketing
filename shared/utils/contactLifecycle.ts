/** Prospect / client / contact triad used for audience + picker filters (not tenant registry keys). */
export type ContactLifecycleKey = 'prospect' | 'client' | 'contact'

const KIND_PRIORITY: ContactLifecycleKey[] = ['client', 'prospect', 'contact']

/**
 * Pick one prospect/client/contact bucket from type keys (UI filters, merge ranking, legacy triad).
 */
export function primaryLifecycleKeyFromTypes(types: string[]): ContactLifecycleKey {
  const set = new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean))
  for (const k of KIND_PRIORITY) {
    if (set.has(k)) return k
  }
  return 'contact'
}
