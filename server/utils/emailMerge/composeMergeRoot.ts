import type { UserMergeSnapshot } from '../../../app/utils/emailTemplateMerge'
import {
  getMergeValue,
  mergeRootWithUserAndRecipient,
  setMergePath
} from '../../../app/utils/emailTemplateMerge'
import type { ContactLean } from '../../types/tenant/contact.model'
import type { EmailDynamicVariableDoc, EmailDynamicVariableModel } from '../../types/tenant/emailDynamicVariable.model'
import {
  contactLookupRecordForDynamicVariables,
  recipientFieldsFromContact
} from './recipientFromContact'

/** One enabled admin-defined token binding (DB row → merge path). */
export type EmailDynamicVariableBinding = {
  key: string
  contactPath: string
  sourceType: 'recipient' | 'user'
  enabled: boolean
  fallbackValue?: string
}

/**
 * Builds the full object passed to `mergeMustacheTemplate`: `user`, `recipient`, plus custom keys
 * from tenant email dynamic variables.
 */
export function composeEmailMergeRoot(
  tenantUserFields: UserMergeSnapshot | null | undefined,
  crmContact: ContactLean | null | undefined,
  dynamicVariableBindings: EmailDynamicVariableBinding[]
): Record<string, unknown> {
  const recipientSnap = recipientFieldsFromContact(crmContact) ?? {}
  const base = mergeRootWithUserAndRecipient(tenantUserFields, recipientSnap)
  const root = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
  const contactLookup = contactLookupRecordForDynamicVariables(crmContact ?? null)

  for (const v of dynamicVariableBindings) {
    if (!v.enabled || !v.key?.trim() || !v.contactPath?.trim()) continue
    let raw: unknown = ''
    if (v.sourceType === 'user') {
      const userObj = (root.user as Record<string, unknown>) || {}
      raw = getMergeValue(userObj, v.contactPath.trim())
    } else if (contactLookup) {
      raw = getMergeValue(contactLookup, v.contactPath.trim())
    }
    let str = String(raw ?? '').trim()
    if (!str && v.fallbackValue != null && String(v.fallbackValue).length) {
      str = String(v.fallbackValue)
    }
    setMergePath(root, v.key.trim(), str)
  }

  const baseObj = base as Record<string, unknown>
  const baseRecipient = (baseObj.recipient ?? {}) as Record<string, unknown>
  const baseUser = (baseObj.user ?? {}) as Record<string, unknown>
  const curR = root.recipient
  const curRObj =
    curR != null && typeof curR === 'object' && !Array.isArray(curR)
      ? { ...(curR as Record<string, unknown>) }
      : {}
  const recipientKeys = new Set([
    ...Object.keys(baseRecipient),
    ...Object.keys(curRObj)
  ])
  const mergedRecipient: Record<string, unknown> = {}
  for (const k of recipientKeys) {
    const b = baseRecipient[k]
    const c = curRObj[k]
    const bStr = b == null ? '' : String(b).trim()
    const cStr = c == null ? '' : String(c).trim()
    mergedRecipient[k] = bStr || cStr || ''
  }
  root.recipient = mergedRecipient
  const curU = root.user
  const curUObj =
    curU != null && typeof curU === 'object' && !Array.isArray(curU)
      ? { ...(curU as Record<string, unknown>) }
      : {}
  root.user = { ...curUObj, ...baseUser }

  return root
}

/** Loads enabled tenant catalog rows for merge (admin-managed `email_dynamic_variables`). */
export async function fetchEnabledEmailDynamicVariableBindings(
  Model: EmailDynamicVariableModel
): Promise<EmailDynamicVariableBinding[]> {
  const docs = await Model.find({ enabled: true })
    .sort({ sortOrder: 1, label: 1, key: 1 })
    .lean<EmailDynamicVariableDoc[]>()
  return docs.map((d) => ({
    key: d.key,
    contactPath: d.contactPath,
    sourceType: d.sourceType === 'user' ? 'user' : 'recipient',
    enabled: true,
    fallbackValue: d.fallbackValue
  }))
}
