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
