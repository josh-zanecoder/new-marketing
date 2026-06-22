import { DEFAULT_UNSUBSCRIBE_MERGE_KEY } from '~~/shared/defaultEmailDynamicVariables'
import {
  getMergeValue,
  mergeDynamicVariableValue,
  mergeRootWithUserAndRecipient,
  resolveUserSourceDynamicVariable,
  setMergePath
} from '../../../shared/utils/emailTemplateMerge'
import type { ContactLean } from '@server/types/tenant/contact.model'
import type { EmailDynamicVariableDoc, EmailDynamicVariableModel } from '@server/types/tenant/emailDynamicVariable.model'
import { buildUnsubscribeUrl } from '@server/utils/unsubscribeUrl'
import {
  contactLookupRecordForDynamicVariables,
  recipientFieldsFromContact
} from './recipientFromContact'
import { userMergeSnapshotFromContactOwner } from './tenantUserFromAuth'

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
 * `user.*` reflects the contact's CRM account owner only; per-variable `fallbackValue` applies
 * when owner/recipient data is missing (no logged-in user backfill).
 */
export function composeEmailMergeRoot(
  crmContact: ContactLean | null | undefined,
  dynamicVariableBindings: EmailDynamicVariableBinding[]
): Record<string, unknown> {
  const recipientSnap = recipientFieldsFromContact(crmContact) ?? {}
  const ownerUserFields = userMergeSnapshotFromContactOwner(crmContact)
  const base = mergeRootWithUserAndRecipient(ownerUserFields, recipientSnap)
  const root = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
  const contactLookup = contactLookupRecordForDynamicVariables(crmContact ?? null)

  for (const v of dynamicVariableBindings) {
    if (
      !v.enabled ||
      !v.key?.trim() ||
      !v.contactPath?.trim() ||
      v.key.trim().toLowerCase() === DEFAULT_UNSUBSCRIBE_MERGE_KEY
    ) {
      continue
    }
    let resolved = ''
    if (v.sourceType === 'user') {
      resolved = resolveUserSourceDynamicVariable(v.contactPath.trim(), crmContact ?? null)
    } else if (contactLookup) {
      resolved = getMergeValue(contactLookup, v.contactPath.trim())
    }
    const str = mergeDynamicVariableValue(resolved, v.fallbackValue)
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
  const userKeys = new Set([...Object.keys(baseUser), ...Object.keys(curUObj)])
  const mergedUser: Record<string, unknown> = {}
  for (const k of userKeys) {
    const b = baseUser[k]
    const c = curUObj[k]
    const bStr = b == null ? '' : String(b).trim()
    const cStr = c == null ? '' : String(c).trim()
    mergedUser[k] = bStr || cStr || ''
  }
  root.user = mergedUser

  return root
}

/** Fills default `{{unsubscribe}}` with a signed per-recipient URL (or preview placeholder). */
export function applyDefaultUnsubscribeMergeValue(
  root: Record<string, unknown>,
  options: {
    dbName?: string
    contactId?: string
    clientKeyHash?: string
    previewPlaceholder?: string
  }
): void {
  let url = ''
  if (options.dbName && options.contactId && options.clientKeyHash) {
    url = buildUnsubscribeUrl(options.dbName, options.contactId, options.clientKeyHash)
  }
  if (!url && options.previewPlaceholder) {
    url = options.previewPlaceholder
  }
  if (url) setMergePath(root, DEFAULT_UNSUBSCRIBE_MERGE_KEY, url)
}

/** Loads enabled tenant catalog rows for merge (admin-managed `email_dynamic_variables`). */
export async function fetchEnabledEmailDynamicVariableBindings(
  Model: EmailDynamicVariableModel
): Promise<EmailDynamicVariableBinding[]> {
  const docs = await Model.find({ enabled: true })
    .sort({ sortOrder: 1, label: 1, key: 1 })
    .lean<EmailDynamicVariableDoc[]>()
  return docs
    .filter((d) => d.key.trim().toLowerCase() !== DEFAULT_UNSUBSCRIBE_MERGE_KEY)
    .map((d) => ({
      key: d.key,
      contactPath: d.contactPath,
      sourceType: d.sourceType === 'user' ? 'user' : 'recipient',
      enabled: true,
      fallbackValue: d.fallbackValue ?? ''
    }))
}
