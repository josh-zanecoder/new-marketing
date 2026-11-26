import { describe, expect, it } from 'vitest'
import { isValidMarketingEmail } from '@server/helpers/marketingEmail'
import {
  buildPreviewAudiencePipeline,
  PREVIEW_VALID_EMAIL_REGEX,
  previewSearchClause
} from '../previewAudiencePipeline'

describe('preview email rule matches the send rule', () => {
  const re = new RegExp(PREVIEW_VALID_EMAIL_REGEX)
  const samples = [
    'a@b.com',
    'first.last+tag@sub.example.co',
    'nobody',
    '@x.com',
    'a@b',
    'a b@x.com',
    'a@@x.com',
    'a@x..com',
    '',
    'a@.com'
  ]
  for (const email of samples) {
    it(`"${email}"`, () => {
      expect(re.test(email.trim().toLowerCase())).toBe(isValidMarketingEmail(email))
    })
  }
})

describe('buildPreviewAudiencePipeline', () => {
  const stages = buildPreviewAudiencePipeline({
    match: { deletedAt: null },
    skip: 25,
    limit: 25,
    select: { email: 1 }
  }) as Array<Record<string, unknown>>

  it('filters first, then drops unusable emails and de-duplicates by normalized email', () => {
    expect(stages[0]).toEqual({ $match: { deletedAt: null } })
    const keys = stages.map((s) => Object.keys(s)[0])
    expect(keys).toEqual([
      '$match',
      '$addFields',
      '$match',
      '$sort',
      '$group',
      '$replaceRoot',
      '$sort',
      '$facet'
    ])
    expect((stages[4] as { $group: { _id: string } }).$group._id).toBe('$__normalizedEmail')
  })

  it('counts the distinct audience and pages only the rows', () => {
    const facet = (stages[7] as { $facet: Record<string, unknown[]> }).$facet
    expect(facet.total).toEqual([{ $count: 'n' }])
    expect(facet.rows).toEqual([{ $skip: 25 }, { $limit: 25 }, { $project: { email: 1 } }])
  })
})

describe('previewSearchClause (search box in the recipient pop-up)', () => {
  it('is null for empty / blank input', () => {
    expect(previewSearchClause('')).toBeNull()
    expect(previewSearchClause('   ')).toBeNull()
    expect(previewSearchClause(undefined)).toBeNull()
  })

  const matches = (search: string, doc: Record<string, string>) => {
    const clause = previewSearchClause(search) as { $or: Array<Record<string, RegExp>> }
    return clause.$or.some((c) => {
      const [field, re] = Object.entries(c)[0]!
      return re.test(doc[field] ?? '')
    })
  }

  it('matches name or email, ignoring case', () => {
    expect(matches('jane', { firstName: 'Jane' })).toBe(true)
    expect(matches('EXAMPLE.com', { email: 'a@example.com' })).toBe(true)
    expect(matches('bob', { firstName: 'Jane', email: 'a@example.com' })).toBe(false)
  })

  it('treats the text literally (no regex injection)', () => {
    expect(matches('.*', { email: 'a@example.com' })).toBe(false)
    expect(matches('a+b', { email: 'a+b@example.com' })).toBe(true)
    expect(matches('(', { email: 'a@example.com' })).toBe(false)
  })
})

describe('buildPreviewAudiencePipeline — unsubscribed duplicates', () => {
  const stages = buildPreviewAudiencePipeline({
    match: {},
    skip: 0,
    limit: 10,
    select: { email: 1 },
    contactCollection: 'contacts'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspecting raw aggregation stages
  }) as Array<Record<string, any>>

  it('drops an address when any other live contact with that email is unsubscribed', () => {
    const keys = stages.map((s) => Object.keys(s)[0])
    expect(keys).toEqual([
      '$match', '$addFields', '$match', '$lookup', '$match', '$sort', '$group', '$replaceRoot', '$sort', '$facet'
    ])
    const lookup = stages[3]!.$lookup
    expect(lookup.from).toBe('contacts')
    expect(lookup.localField).toBe('__normalizedEmail')
    expect(lookup.foreignField).toBe('email')
    expect(lookup.pipeline[0].$match.isUnsubscribe).toBe(true)
    expect(stages[4]).toEqual({ $match: { __unsubscribedSibling: { $size: 0 } } })
  })
})
