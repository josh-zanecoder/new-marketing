/** Write a string at a dotted path, creating intermediate objects (for admin-defined merge keys). */
export function setMergePath(root: Record<string, unknown>, path: string, value: string): void {
  const parts = path
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return
  let cur: Record<string, unknown> = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!
    const next = cur[p]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) {
      cur[p] = {}
    }
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]!] = value
}

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

/** Keys aligned with `mergeRecipientSnapshotFromContact` for stable `{{ recipient.* }}` resolution. */
const RECIPIENT_MERGE_KEYS = [
  'name',
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'contactKind',
  'channel',
  'street',
  'city',
  'state',
  'county'
] as const

export function mergeRootWithUserAndRecipient(
  userSnapshot: UserMergeSnapshot | null | undefined,
  recipientPartial: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const base = mergeRootWithUserSnapshot(userSnapshot)
  const p = recipientPartial || {}
  const recipient: Record<string, string> = {}
  for (const k of RECIPIENT_MERGE_KEYS) {
    const v = p[k]
    recipient[k] = v == null ? '' : String(v)
  }
  return { ...base, recipient }
}
