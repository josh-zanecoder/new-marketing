import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('listCampaignSenderCandidates name preference (Marketing/OM)', () => {
  it('sorts non-empty owner names before $group $first', () => {
    const src = readFileSync(
      resolve(root, 'server/utils/campaign/listCampaignSenderCandidates.ts'),
      'utf8'
    )
    expect(src).toContain('_ownerNameScore')
    expect(src).toContain('$sort: { _ownerNameScore: -1 }')
    expect(src).toContain('enrichCandidatesFromLoContactProfiles')
    expect(src).toContain('pickBestOwnerNameFields')
    // Exact email lookup for list→sender resolve (plus-address safe).
    expect(src).toContain("q.includes('@')")
    expect(src).toContain('$eq: [ownerEmailLowerExpr(), q]')
  })
})
