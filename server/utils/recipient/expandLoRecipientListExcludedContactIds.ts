import type { Types } from 'mongoose'
import { Types as MongooseTypes } from 'mongoose'
import { audienceBaseQuery } from '@server/utils/contact/contactTypeWrite'
import { mergeContactOwnerScopeFilter } from '@server/utils/contactOwnerFilter'
import { normalizeRecipientEmailKey } from '~~/shared/dedupeByNormalizedEmail'
import { recipientListExcludedContactIds } from '@server/utils/recipient/recipientListMutation'

type ContactFindModel = {
  find: (
    filter: Record<string, unknown>
  ) => {
    select: (proj: Record<string, number>) => {
      lean: () => Promise<Array<{ _id?: unknown; email?: unknown }>>
    }
  }
}

/**
 * LO checklist is email-deduped (one row per address) but membership rebuild walks
 * every Contact doc. Expand unchecked checklist ids/emails to every Contact id that
 * shares those addresses under the same LO + audience — otherwise sibling duplicates
 * stay on the list and "1 checked" still yields the full unique-email count.
 */
export async function expandLoRecipientListExcludedContactIds(params: {
  Contact: ContactFindModel
  audience: string
  ownerEmail: string
  seedIds: Types.ObjectId[]
  seedEmails?: string[]
}): Promise<Types.ObjectId[]> {
  const ownerEmail = normalizeRecipientEmailKey(params.ownerEmail)
  if (!ownerEmail.includes('@')) {
    return recipientListExcludedContactIds({ excludedContactIds: params.seedIds })
  }

  const emailSet = new Set<string>()
  for (const raw of params.seedEmails ?? []) {
    const email = normalizeRecipientEmailKey(raw)
    if (email.includes('@')) emailSet.add(email)
  }

  if (params.seedIds.length) {
    const seedDocs = await params.Contact.find({
      _id: { $in: params.seedIds }
    })
      .select({ email: 1 })
      .lean()
    for (const doc of seedDocs) {
      const email = normalizeRecipientEmailKey(doc.email)
      if (email.includes('@')) emailSet.add(email)
    }
  }

  if (!emailSet.size) {
    return recipientListExcludedContactIds({ excludedContactIds: params.seedIds })
  }

  const scoped = mergeContactOwnerScopeFilter(
    {
      ...audienceBaseQuery(params.audience),
      deletedAt: null
    } as Record<string, unknown>,
    [ownerEmail]
  )

  const emails = [...emailSet]
  const siblings = await params.Contact.find({
    $and: [
      scoped,
      {
        $expr: {
          $in: [
            {
              $toLower: {
                $trim: { input: { $toString: { $ifNull: ['$email', ''] } } }
              }
            },
            emails
          ]
        }
      }
    ]
  })
    .select({ _id: 1 })
    .lean()

  const out: Types.ObjectId[] = []
  const seen = new Set<string>()
  const pushId = (raw: unknown) => {
    const s = String(raw ?? '').trim()
    if (!MongooseTypes.ObjectId.isValid(s) || seen.has(s)) return
    seen.add(s)
    out.push(new MongooseTypes.ObjectId(s))
  }
  for (const id of params.seedIds) pushId(id)
  for (const doc of siblings) pushId(doc._id)
  return out
}
