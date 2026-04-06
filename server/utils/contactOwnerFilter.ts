import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'

/**
 * Restricts contacts to `metadata.ownerEmail` in `scopedEmails` (case-insensitive),
 * plus rows with no owner (unassigned) for backward compatibility.
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
        $or: [
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
          },
          { 'metadata.ownerEmail': { $exists: false } },
          { 'metadata.ownerEmail': null },
          { 'metadata.ownerEmail': '' }
        ]
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
