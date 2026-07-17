export type CustomMarketingMergeVariable = {
  key: string
  label: string
  sourceType?: 'recipient' | 'user'
  scopes?: Array<'subject' | 'body'>
  enabled?: boolean
}

/** Built-in tokens always shown in Custom Marketing (merged with the tenant catalog). */
export const CUSTOM_MARKETING_FALLBACK_MERGE_VARIABLES: CustomMarketingMergeVariable[] = [
  { key: 'recipient.firstName', label: 'Recipient first name', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'recipient.lastName', label: 'Recipient last name', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'recipient.name', label: 'Recipient full name', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'recipient.email', label: 'Recipient email', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'recipient.phone', label: 'Recipient phone', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'recipient.company', label: 'Recipient company', sourceType: 'recipient', scopes: ['subject', 'body'] },
  { key: 'user.firstName', label: 'Sender first name', sourceType: 'user', scopes: ['subject', 'body'] },
  { key: 'user.lastName', label: 'Sender last name', sourceType: 'user', scopes: ['subject', 'body'] },
  { key: 'user.name', label: 'Sender full name', sourceType: 'user', scopes: ['subject', 'body'] },
  { key: 'user.email', label: 'Sender email', sourceType: 'user', scopes: ['subject', 'body'] },
  { key: 'unsubscribe', label: 'Unsubscribe link', sourceType: 'recipient', scopes: ['body'] }
]

export function customMarketingMergeToken(key: string): string {
  const trimmed = String(key ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return trimmed
  return `{{${trimmed}}}`
}

export function isCustomMarketingMergeVariableEnabled(
  variable: CustomMarketingMergeVariable
): boolean {
  return variable.enabled !== false
}

export function customMarketingMergeVariableMatchesScope(
  variable: CustomMarketingMergeVariable,
  scope: 'subject' | 'body'
): boolean {
  const scopes = variable.scopes ?? []
  if (!scopes.length) return true
  return scopes.includes(scope)
}

/** Built-ins plus tenant catalog (API wins on duplicate keys for label / sourceType). */
export function resolveCustomMarketingMergeVariables(
  apiVariables: CustomMarketingMergeVariable[] | null | undefined,
  scope: 'subject' | 'body'
): CustomMarketingMergeVariable[] {
  const fromApi = (apiVariables ?? [])
    .filter(isCustomMarketingMergeVariableEnabled)
    .filter((v) => customMarketingMergeVariableMatchesScope(v, scope))
  const fromBuiltIn = CUSTOM_MARKETING_FALLBACK_MERGE_VARIABLES
    .filter((v) => customMarketingMergeVariableMatchesScope(v, scope))
  // Built-ins first for a stable Recipient/Sender order; API overlays same keys, then appends extras.
  const byKey = new Map<string, CustomMarketingMergeVariable>()
  for (const v of fromBuiltIn) {
    const key = String(v.key ?? '').trim()
    if (!key) continue
    byKey.set(key, {
      key,
      label: String(v.label ?? '').trim() || key,
      sourceType: v.sourceType,
      scopes: v.scopes,
      enabled: v.enabled
    })
  }
  for (const v of fromApi) {
    const key = String(v.key ?? '').trim()
    if (!key) continue
    const existing = byKey.get(key)
    byKey.set(key, {
      key,
      label: String(v.label ?? '').trim() || existing?.label || key,
      sourceType: v.sourceType ?? existing?.sourceType,
      scopes: v.scopes?.length ? v.scopes : existing?.scopes,
      enabled: v.enabled
    })
  }
  return [...byKey.values()]
}

export function customMarketingMergeVariableCategory(
  variable: CustomMarketingMergeVariable
): 'Recipient' | 'Sender' | 'Other' {
  if (variable.key === 'unsubscribe' || /^unsubscribe$/i.test(variable.key)) return 'Other'
  if (variable.sourceType === 'user') return 'Sender'
  if (variable.sourceType === 'recipient') return 'Recipient'
  if (/^user\./i.test(variable.key)) return 'Sender'
  if (/^recipient\./i.test(variable.key)) return 'Recipient'
  return 'Other'
}

export function groupCustomMarketingMergeVariables(
  variables: CustomMarketingMergeVariable[]
): {
  recipient: CustomMarketingMergeVariable[]
  sender: CustomMarketingMergeVariable[]
  other: CustomMarketingMergeVariable[]
} {
  const recipient: CustomMarketingMergeVariable[] = []
  const sender: CustomMarketingMergeVariable[] = []
  const other: CustomMarketingMergeVariable[] = []
  for (const v of variables) {
    const cat = customMarketingMergeVariableCategory(v)
    if (cat === 'Sender') sender.push(v)
    else if (cat === 'Recipient') recipient.push(v)
    else other.push(v)
  }
  return { recipient, sender, other }
}
