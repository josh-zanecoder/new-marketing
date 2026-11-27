/**
 * Count + sample contacts matching recipient-list filter body (no list create).
 * Used by Advanced Recipient Filtering on campaign create/schedule.
 */
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import {
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth
} from '@server/tenant/registry-auth'
import {
  mergeContactOwnerScopeFilter,
  mergeTenantOwnerEmailScopeFilter
} from '@server/utils/contactOwnerFilter'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import {
  buildContactFilterQuery,
  buildNestedFilterQuery
} from '@server/utils/recipient/recipientListMembershipQuery'
import { buildPreviewAudiencePipeline, previewSearchClause } from '@server/utils/recipient/previewAudiencePipeline'
import { pickJoinsForQuery } from '@server/utils/recipient/recipientListMutation'
import { loadWritePayload } from '@server/utils/recipient/recipientListService'
import { withAudienceStatusScopeForTenant } from '@server/utils/recipient/audienceStatusScope'
import { formatPersonDisplayName } from '~~/shared/formatPersonDisplayName'
import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'

export type RecipientListAudiencePreviewContact = {
  id: string
  email: string
  name: string
  status: string
  city: string
  state: string
}

export type RecipientListAudiencePreview = {
  total: number
  page: number
  limit: number
  contacts: RecipientListAudiencePreviewContact[]
}

const DEFAULT_SAMPLE = 25
const MAX_SAMPLE = 100

export async function previewRecipientListAudience(params: {
  tenantConn: Connection
  auth: unknown
  body: Record<string, unknown>
  /** Rows per page (capped). */
  sampleLimit?: number
  /** 1-based page of matching contacts. */
  page?: number
  /** Narrow the shown contacts by name / email (the modal's search box). */
  search?: string
}): Promise<RecipientListAudiencePreview> {
  const { tenantConn, auth, body } = params
  const sampleLimit = Math.min(
    MAX_SAMPLE,
    Math.max(1, Math.floor(Number(params.sampleLimit) || DEFAULT_SAMPLE))
  )
  const page = Math.max(1, Math.floor(Number(params.page) || 1))

  const w = await loadWritePayload(tenantConn, auth, {
    ...body,
    // Preview does not persist a list; name is only required by write payload asserts.
    name: typeof body?.name === 'string' && body.name.trim() ? body.name : 'Preview'
  }, { allowAdvancedAudience: true })

  const joinsForQuery = pickJoinsForQuery(w.criterionGroups, w.criterionJoinsFromBody, {
    criterionJoins: w.joinsToStore
  })

  const nonEmptyGroups = w.criterionGroups.filter((g) => g.length > 0)
  const groupsForQuery = nonEmptyGroups.length > 0 ? w.criterionGroups : undefined

  const contactQuery =
    w.nested && w.nested.groups.length > 0
      ? buildNestedFilterQuery(w.audience, w.nested.groups, w.nested.groupJoins)
      : buildContactFilterQuery(
          w.audience,
          w.filters,
          w.filterMode,
          groupsForQuery,
          joinsForQuery
        )

  let membershipScope = w.membershipScope
  let membershipOwnerEmails = w.membershipOwnerEmails
  if (!membershipScope) {
    membershipScope = recipientListMembershipScopeFromAuth(auth)
    membershipOwnerEmails =
      membershipScope === 'owner_emails'
        ? recipientListMembershipOwnerEmailsFromAuth(auth)
        : []
  }

  const scoped =
    membershipScope === 'tenant'
      ? (contactQuery as Record<string, unknown>)
      : membershipOwnerEmails.length > 0
        ? mergeContactOwnerScopeFilter(
            contactQuery as Record<string, unknown>,
            membershipOwnerEmails
          )
        : mergeTenantOwnerEmailScopeFilter(contactQuery as Record<string, unknown>, auth)

  const statusScoped = await withAudienceStatusScopeForTenant(
    tenantConn,
    scoped as Record<string, unknown>,
    w.audienceStatuses
  )
  const marketableBase = withMarketableContactFilter(statusScoped)
  const searchClause = previewSearchClause(params.search)
  const marketable = searchClause ? { $and: [marketableBase, searchClause] } : marketableBase
  const { Contact } = getTenantClientModels(tenantConn)
  const ContactModel = Contact as ContactModel

  // Count + rows follow the send's rules: marketable, usable email, one row per distinct email.
  const [result] = await ContactModel.aggregate<{
    total: Array<{ n: number }>
    rows: ContactLean[]
  }>(
    buildPreviewAudiencePipeline({
      match: marketable,
      skip: (page - 1) * sampleLimit,
      limit: sampleLimit,
      contactCollection: ContactModel.collection.name,
      select: {
        email: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        name: 1,
        status: 1,
        'address.city': 1,
        'address.state': 1
      }
    })
  ).allowDiskUse(true)
  const total = result?.total?.[0]?.n ?? 0
  const docs = result?.rows ?? []

  const contacts: RecipientListAudiencePreviewContact[] = docs.map((doc) => {
    const email = normalizeMarketingEmail(doc.email) || String(doc.email ?? '').trim()
    const name =
      formatPersonDisplayName({
        firstName: (doc as { firstName?: string }).firstName,
        lastName: (doc as { lastName?: string }).lastName,
        name:
          (doc as { displayName?: string }).displayName ||
          (doc as { name?: string }).name
      }) || email
    const address = (doc as { address?: { city?: string; state?: string } }).address
    return {
      id: String(doc._id),
      email,
      name,
      status: String((doc as { status?: string }).status ?? '').trim(),
      city: String(address?.city ?? '').trim(),
      state: String(address?.state ?? '').trim()
    }
  })

  return { total, page, limit: sampleLimit, contacts }
}
