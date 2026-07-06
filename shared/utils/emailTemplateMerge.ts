import { formatUsPhoneNumber } from './usNumberFormatter'

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

/** Maps `user.*` merge paths (and aliases) to contact `metadata.owner*` keys. */
export const USER_MERGE_PATH_TO_OWNER_METADATA: Record<string, string> = {
  firstName: 'ownerFirstName',
  lastName: 'ownerLastName',
  email: 'ownerEmail',
  phone: 'ownerPhone',
  ownerFirstName: 'ownerFirstName',
  ownerLastName: 'ownerLastName',
  ownerEmail: 'ownerEmail',
  ownerPhone: 'ownerPhone',
  ownerAvatarUrl: 'ownerAvatarUrl',
  avatar: 'ownerAvatarUrl',
  avatarUrl: 'ownerAvatarUrl'
}

/** Canonical `metadata.owner*` paths for admin User-source contact paths. */
const USER_SOURCE_PATH_TO_METADATA: Record<string, string> = {
  firstname: 'metadata.ownerFirstName',
  ownerfirstname: 'metadata.ownerFirstName',
  lastname: 'metadata.ownerLastName',
  ownerlastname: 'metadata.ownerLastName',
  email: 'metadata.ownerEmail',
  owneremail: 'metadata.ownerEmail',
  phone: 'metadata.ownerPhone',
  ownerphone: 'metadata.ownerPhone',
  owneravatarurl: 'metadata.ownerAvatarUrl',
  avatar: 'metadata.ownerAvatarUrl',
  avatarurl: 'metadata.ownerAvatarUrl'
}

/** Strips a leading `user.` prefix from admin keys or contact paths. */
export function stripUserMergePrefix(pathOrKey: string): string {
  let path = pathOrKey.trim()
  if (!path) return ''
  while (path.toLowerCase().startsWith('user.')) {
    path = path.slice('user.'.length).trim()
  }
  return path
}

/**
 * Normalizes admin User-source contact paths to canonical `metadata.owner*` paths.
 * e.g. `user.ownerAvatarUrl` and `ownerAvatarUrl` → `metadata.ownerAvatarUrl`
 */
export function normalizeUserSourceContactPath(contactPath: string): string {
  const stripped = stripUserMergePrefix(contactPath)
  if (!stripped) return ''
  if (stripped.toLowerCase().startsWith('metadata.')) {
    return stripped
  }
  return USER_SOURCE_PATH_TO_METADATA[stripped.toLowerCase()] ?? stripped
}

function formatOwnerMetadataMergeValue(path: string, raw: unknown): string {
  const s = raw == null ? '' : String(raw).trim()
  if (!s) return ''
  if (path === 'phone' || path === 'ownerPhone' || path.endsWith('.ownerPhone')) {
    return formatUsPhoneNumber(s)
  }
  if (path === 'email' || path === 'ownerEmail' || path.endsWith('.ownerEmail')) {
    return s.toLowerCase()
  }
  return s
}

/** Builds `user.*` merge fields from CRM account owner metadata on a contact. */
export function userMergeSnapshotFromContactOwnerMetadata(
  metadata: Record<string, unknown> | null | undefined
): UserMergeSnapshot | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const out: UserMergeSnapshot = {}
  const firstName =
    typeof metadata.ownerFirstName === 'string' ? metadata.ownerFirstName.trim() : ''
  const lastName =
    typeof metadata.ownerLastName === 'string' ? metadata.ownerLastName.trim() : ''
  const email =
    typeof metadata.ownerEmail === 'string' ? metadata.ownerEmail.trim().toLowerCase() : ''
  const phone = typeof metadata.ownerPhone === 'string' ? metadata.ownerPhone.trim() : ''
  if (firstName) out.firstName = firstName
  if (lastName) out.lastName = lastName
  if (email) out.email = email
  if (phone) out.phone = phone
  return Object.keys(out).length ? out : undefined
}

/**
 * Resolves admin `sourceType: user` dynamic variables from the recipient contact's
 * CRM account owner (`metadata.owner*`) only — no session or campaign-user fallback.
 */
export function resolveUserSourceDynamicVariable(
  contactPath: string,
  contact: { metadata?: Record<string, unknown> } | null | undefined
): string {
  const path = normalizeUserSourceContactPath(contactPath)
  if (!path) return ''

  const meta = contact?.metadata
  if (!meta || typeof meta !== 'object') return ''

  if (path.startsWith('metadata.')) {
    return formatOwnerMetadataMergeValue(path, getMergeValue({ metadata: meta }, path))
  }

  const ownerMetaKey = USER_MERGE_PATH_TO_OWNER_METADATA[path]
  if (ownerMetaKey) {
    return formatOwnerMetadataMergeValue(path, meta[ownerMetaKey])
  }
  return ''
}

/** Primary resolved value, else per-variable tenant fallback, else empty. */
export function mergeDynamicVariableValue(
  resolved: string,
  fallbackValue?: string | null
): string {
  const primary = resolved.trim()
  if (primary) return primary
  return typeof fallbackValue === 'string' ? fallbackValue.trim() : ''
}

export function mergeRootWithUserSnapshot(
  snapshot: UserMergeSnapshot | null | undefined
): Record<string, unknown> {
  const u = snapshot || {}
  const firstName = u.firstName ?? ''
  const lastName = u.lastName ?? ''
  const name = [firstName, lastName].map((s) => String(s).trim()).filter(Boolean).join(' ')
  return {
    user: {
      firstName,
      lastName,
      name,
      email: u.email ?? '',
      phone: u.phone ? formatUsPhoneNumber(u.phone) : '',
      role: u.role ?? ''
    }
  }
}

/** Keys aligned with `recipientFieldsFromContact` (server) for stable `{{ recipient.* }}` resolution. */
const RECIPIENT_MERGE_KEYS = [
  'name',
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'contactType',
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
    if (k === 'phone') {
      recipient[k] = v == null || v === '' ? '' : formatUsPhoneNumber(String(v))
    } else {
      recipient[k] = v == null ? '' : String(v)
    }
  }
  return { ...base, recipient }
}
