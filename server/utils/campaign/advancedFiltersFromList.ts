/**
 * Rebuilds the Advanced Recipient Filtering form values from the dynamic list a filter-built
 * campaign owns, so the edit page can reopen the same audience.
 */
import {
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth
} from '@server/tenant/registry-auth'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'
import { normalizeAudienceStatuses } from '~~/shared/utils/borrowerStatusLabel'
import type { AdvancedRecipientFiltersInitial } from '~~/shared/campaignAdvancedRecipientFilters'

export type { AdvancedRecipientFiltersInitial }

type Row = { recipientFilterId?: unknown; listPropertyValue?: unknown }

function plainRows(raw: unknown): { recipientFilterId: string; listPropertyValue: string }[] {
  if (!Array.isArray(raw)) return []
  return (raw as Row[]).map((r) => ({
    recipientFilterId: String(r?.recipientFilterId ?? '').trim(),
    listPropertyValue: String(r?.listPropertyValue ?? '').trim()
  }))
}

function plainJoins(raw: unknown): ('and' | 'or')[] {
  if (!Array.isArray(raw)) return []
  return raw.map((j) => (j === 'or' ? 'or' : 'and'))
}

function sameEmails(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((e) => set.has(e))
}

export function advancedRecipientFiltersFromListDoc(
  doc: Record<string, unknown>,
  auth: unknown
): AdvancedRecipientFiltersInitial {
  const groupsRaw = Array.isArray(doc.filterGroups) ? (doc.filterGroups as Record<string, unknown>[]) : []
  const filterGroups = groupsRaw
    .map((g) => ({ rows: plainRows(g?.rows), joins: plainJoins(g?.joins) }))
    .filter((g) => g.rows.length > 0)

  const storedEmails = recipientListStoredMembershipEmails(
    doc as { membershipOwnerEmails?: unknown }
  ).map((e) => e.trim().toLowerCase())

  // A scoped sender's list always carries their own default scope; only a different set is a pick.
  const defaultEmails =
    recipientListMembershipScopeFromAuth(auth) === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(auth).map((e) => e.trim().toLowerCase())
      : []
  const picked =
    doc.membershipScope === 'owner_emails' &&
    storedEmails.length > 0 &&
    !sameEmails(storedEmails, defaultEmails)
      ? storedEmails
      : []

  return {
    audience: String(doc.audience ?? '').trim().toLowerCase(),
    filterMode: doc.filterMode === 'or' ? 'or' : 'and',
    criterionJoins: plainJoins(doc.criterionJoins),
    filterRows: plainRows(doc.filterRows),
    filterGroups,
    groupJoins: plainJoins(doc.groupJoins),
    loanOfficerEmails: picked,
    audienceStatuses: normalizeAudienceStatuses(doc.audienceStatuses)
  }
}
