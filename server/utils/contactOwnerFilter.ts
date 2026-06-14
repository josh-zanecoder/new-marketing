import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'

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
 * Same email scope as contacts: `contactOwnerScope` on tenant API key sessions, unless
 * `tenantWideContacts` is set (then no row filter).
 */
export function mergeTenantOwnerEmailScopeFilter(
  base: Record<string, unknown>,
  auth: unknown
): Record<string, unknown> {
  if (!isTenantApiKeyAuthContext(auth)) return base
  if (auth.tenantWideContacts === true) return base
  return mergeContactOwnerScopeFilter(base, auth.contactOwnerScope)
}
