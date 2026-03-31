/** Dot-path lookup for mustache-style tokens, e.g. {{ user.firstName }} */
export function getMergeValue(root: Record<string, unknown>, path: string): string {
  const parts = path
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  let cur: unknown = root
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) return ''
    cur = (cur as Record<string, unknown>)[p]
  }
  if (cur == null) return ''
  return String(cur)
}

const MUSTACHE_RE = /\{\{\s*([^}]+?)\s*\}\}/g

export function mergeMustacheTemplate(template: string, root: Record<string, unknown>): string {
  return template.replace(MUSTACHE_RE, (_full, rawKey: string) => {
    const key = String(rawKey).trim()
    return getMergeValue(root, key)
  })
}

export type UserMergeSnapshot = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  /** CRM role display name; templates use {{ user.role }} */
  role?: string
}

export function mergeRootWithUserSnapshot(
  snapshot: UserMergeSnapshot | null | undefined
): Record<string, unknown> {
  const u = snapshot || {}
  return {
    user: {
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
      role: u.role ?? ''
    }
  }
}
