import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'
import { marketingAudienceOwnerEmailsFromAuth } from '@server/utils/auth/marketingAudienceFromAuth'

/**
 * Restricts contacts to rows whose `metadata.ownerEmail` is in `scopedEmails`
 * (case-insensitive). Rows with missing or empty owner email are excluded.
 */
export function mergeContactOwnerScopeFilter(
  base: Record<string, unknown>,
  scopedEmails: string[] | undefined
): Record<string, unknown> {
  if (!scopedEmails?.length) return base
  const lower = scopedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (!lower.length) return base
  return {
    $and: [
      base,
      {
        $expr: {
          $in: [
            {
              $toLower: {
                $trim: {
                  input: { $toString: { $ifNull: ['$metadata.ownerEmail', ''] } }
                }
              }
            },
            lower
          ]
        }
      }
    ]
  }
}

/**
 * Same email scope as contacts: classic handoff `contactOwnerScope` / `tenantWideContacts`.
 * When LO-list feature flag is ON, applies LO/OM role audience rules instead.
 * Scoped sessions with an empty owner list return no rows (do not leak tenant-wide).
 */
export function mergeTenantOwnerEmailScopeFilter(
  base: Record<string, unknown>,
  auth: unknown
): Record<string, unknown> {
  if (!isTenantApiKeyAuthContext(auth)) return base

  // Feature-flagged LO/OM audience — only when allowTenantLoRecipientLists is on the session.
  if (auth.allowTenantLoRecipientLists === true) {
    const emails = marketingAudienceOwnerEmailsFromAuth(auth)
    if (emails === null) return base
    if (!emails.length) {
      return { $and: [base, { _id: { $in: [] } }] }
    }
    return mergeContactOwnerScopeFilter(base, emails)
  }

  // Classic: handoff scope only.
  if (auth.tenantWideContacts === true) return base
  const scope = auth.contactOwnerScope
  if (!scope?.length) {
    return { $and: [base, { _id: { $in: [] } }] }
  }
  return mergeContactOwnerScopeFilter(base, scope)
}
