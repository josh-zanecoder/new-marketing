/** Built-in merge token; value is the signed unsubscribe URL at send time (not stored in DB). */
export const DEFAULT_UNSUBSCRIBE_MERGE_KEY = 'unsubscribe'

export type DefaultEmailDynamicVariableRow = {
  id: string
  key: string
  label: string
  description: string
  contactPath: string
  scopes: Array<'subject' | 'body'>
  enabled: boolean
  sortOrder: number
  fallbackValue: string
  requiredForSend: boolean
  sourceType: 'recipient' | 'user'
  isDefault: boolean
}

export function defaultUnsubscribeDynamicVariable(): DefaultEmailDynamicVariableRow {
  return {
    id: '__default_unsubscribe',
    key: DEFAULT_UNSUBSCRIBE_MERGE_KEY,
    label: 'Unsubscribe link',
    description:
      'Per-recipient signed URL. In HTML use {{unsubscribe}} as the href, e.g. <a href="{{unsubscribe}}">Unsubscribe</a>.',
    contactPath: '',
    scopes: ['body'],
    enabled: true,
    sortOrder: -1000,
    fallbackValue: '',
    requiredForSend: false,
    sourceType: 'recipient',
    isDefault: true
  }
}

/** Prepends the system unsubscribe variable; drops duplicate DB rows with the same key. */
export function mergeDefaultEmailDynamicVariables<
  T extends { key: string }
>(variables: T[]): (T | DefaultEmailDynamicVariableRow)[] {
  const rest = variables.filter(
    (v) => v.key.trim().toLowerCase() !== DEFAULT_UNSUBSCRIBE_MERGE_KEY
  )
  return [defaultUnsubscribeDynamicVariable(), ...rest]
}
