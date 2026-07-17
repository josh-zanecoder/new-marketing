import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCrmAuthenticatedSender } from '../crmAuthenticatedSender'

describe('crmAuthenticatedSender', () => {
  it('returns null without an email', () => {
    assert.equal(resolveCrmAuthenticatedSender(null), null)
    assert.equal(resolveCrmAuthenticatedSender({ name: 'Ada' }), null)
    assert.equal(resolveCrmAuthenticatedSender({ email: '  ' }), null)
  })

  it('uses CRM email and prefers first + last name', () => {
    assert.deepEqual(
      resolveCrmAuthenticatedSender({
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        name: 'Ignored'
      }),
      { name: 'Ada Lovelace', email: 'ada@example.com' }
    )
  })

  it('falls back to name then email for display', () => {
    assert.deepEqual(
      resolveCrmAuthenticatedSender({ email: 'ada@example.com', name: 'Ada L' }),
      { name: 'Ada L', email: 'ada@example.com' }
    )
    assert.deepEqual(
      resolveCrmAuthenticatedSender({ email: 'ada@example.com' }),
      { name: 'ada@example.com', email: 'ada@example.com' }
    )
  })
})
