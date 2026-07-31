import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBrevoEventReportTagsFilter,
  resolveBrevoEventReportRequest
} from '../brevoEventReportQuery'

describe('brevoEventReportQuery', () => {
  it('resolveBrevoEventReportRequest uses 90 days when no range is provided', () => {
    assert.deepEqual(resolveBrevoEventReportRequest(null, null), { days: 90 })
  })

  it('resolveBrevoEventReportRequest clamps explicit ranges to Brevo limits', () => {
    const now = new Date('2026-06-19T12:00:00.000Z')
    const result = resolveBrevoEventReportRequest('2026-01-01', '2026-06-19', now)
    assert.equal(result.startDate, '2026-03-22')
    assert.equal(result.endDate, '2026-06-19')
  })

  it('buildBrevoEventReportTagsFilter prefers campaign over db', () => {
    assert.equal(
      buildBrevoEventReportTagsFilter({
        dbName: 'forge_capital_lending_db',
        campaignId: '6a689f1c8c900ea63a4d8de8'
      }),
      JSON.stringify(['campaign:6a689f1c8c900ea63a4d8de8'])
    )
    assert.equal(
      buildBrevoEventReportTagsFilter({ dbName: 'forge_capital_lending_db' }),
      JSON.stringify(['db:forge_capital_lending_db'])
    )
  })
})
