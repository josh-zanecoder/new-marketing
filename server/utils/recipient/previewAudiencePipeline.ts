import type { PipelineStage } from 'mongoose'

/** Same shape the send accepts (`isValidMarketingEmail`): one "@", something before and a dotted domain after. */
export const PREVIEW_VALID_EMAIL_REGEX = '^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$'

/**
 * Preview pipeline that mirrors what a send would actually mail:
 * contacts without a usable email are dropped, and contacts sharing an email count once
 * (the send de-duplicates by lower-cased email), so the number shown before scheduling matches the send.
 * Returns `{ total: [{ n }], rows: [contact docs for the requested page] }`.
 */
export function buildPreviewAudiencePipeline(params: {
  match: Record<string, unknown>
  skip: number
  limit: number
  select: Record<string, 1>
  /**
   * Name of the tenant contacts collection. When set, an address is also dropped if ANY other
   * non-deleted contact with the same email is unsubscribed (the send blocks it the same way).
   */
  contactCollection?: string
}): PipelineStage[] {
  const { match, skip, limit, select, contactCollection } = params
  const unsubscribedEmailGuard: PipelineStage[] = contactCollection
    ? ([
        {
          $lookup: {
            from: contactCollection,
            localField: '__normalizedEmail',
            foreignField: 'email',
            pipeline: [
              {
                $match: {
                  isUnsubscribe: true,
                  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
                }
              },
              { $limit: 1 },
              { $project: { _id: 1 } }
            ],
            as: '__unsubscribedSibling'
          }
        },
        { $match: { __unsubscribedSibling: { $size: 0 } } }
      ] as PipelineStage[])
    : []
  return [
    { $match: match },
    {
      $addFields: {
        __normalizedEmail: {
          $toLower: { $trim: { input: { $toString: { $ifNull: ['$email', ''] } } } }
        }
      }
    },
    { $match: { __normalizedEmail: { $regex: PREVIEW_VALID_EMAIL_REGEX } } },
    ...unsubscribedEmailGuard,
    { $sort: { _id: 1 } },
    // First contact (lowest _id) represents each distinct email.
    { $group: { _id: '$__normalizedEmail', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { _id: 1 } },
    {
      $facet: {
        total: [{ $count: 'n' }],
        rows: [{ $skip: skip }, { $limit: limit }, { $project: select }]
      }
    }
  ] as PipelineStage[]
}

/** Max characters of a recipient search; longer input is cut (it only narrows what the modal shows). */
const MAX_SEARCH_LENGTH = 100

/**
 * Case-insensitive "contains" match on name / email, for searching inside the recipient preview.
 * Returns `null` for empty input. Input is escaped, never treated as a regex.
 */
export function previewSearchClause(search: unknown): Record<string, unknown> | null {
  const text = String(search ?? '').trim().slice(0, MAX_SEARCH_LENGTH)
  if (!text) return null
  const re = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  return {
    $or: ['email', 'firstName', 'lastName', 'displayName', 'name'].map((f) => ({ [f]: re }))
  }
}
