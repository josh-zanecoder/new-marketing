import type { UserMergeSnapshot } from '../../app/utils/emailTemplateMerge'
import {
  getMergeValue,
  mergeRootWithUserAndRecipient,
  setMergePath
} from '../../app/utils/emailTemplateMerge'
import type { ContactLean } from '../types/tenant/contact.model'
import type { EmailDynamicVariableDoc, EmailDynamicVariableModel } from '../types/tenant/emailDynamicVariable.model'
import { mergeRecipientSnapshotFromContact } from './mergeUserSnapshotFromAuth'

export type EmailMergeDynamicVariableInput = {
  key: string
  contactPath: string
  sourceType: 'recipient' | 'user'
  enabled: boolean
  fallbackValue?: string
}

/**
 * Full merge tree for mustache templates: built-in `user` / `recipient` plus tenant EmailDynamicVariable entries.
 */
export function buildEmailMergeRoot(
  userSnapshot: UserMergeSnapshot | null | undefined,
  contact: ContactLean | null | undefined,
  dynamicVariables: EmailMergeDynamicVariableInput[]
): Record<string, unknown> {
  const recipientSnap = mergeRecipientSnapshotFromContact(contact) ?? {}
  const base = mergeRootWithUserAndRecipient(userSnapshot, recipientSnap)
  const root = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
  const contactObj = contact ? (contact as unknown as Record<string, unknown>) : null

  for (const v of dynamicVariables) {
    if (!v.enabled || !v.key?.trim() || !v.contactPath?.trim()) continue
    let raw: unknown = ''
    if (v.sourceType === 'user') {
      const userObj = (root.user as Record<string, unknown>) || {}
      raw = getMergeValue(userObj, v.contactPath.trim())
    } else if (contactObj) {
      raw = getMergeValue(contactObj, v.contactPath.trim())
    }
    let str = String(raw ?? '').trim()
    if (!str && v.fallbackValue != null && String(v.fallbackValue).length) {
      str = String(v.fallbackValue)
    }
    setMergePath(root, v.key.trim(), str)
  }
  return root
}

export async function loadEnabledDynamicVariableInputs(
  Model: EmailDynamicVariableModel
): Promise<EmailMergeDynamicVariableInput[]> {
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
