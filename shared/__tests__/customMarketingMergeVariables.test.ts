import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_MARKETING_FALLBACK_MERGE_VARIABLES,
  customMarketingMergeToken,
  customMarketingMergeVariableCategory,
  customMarketingMergeVariableMatchesScope,
  groupCustomMarketingMergeVariables,
  resolveCustomMarketingMergeVariables
} from '../customMarketingMergeVariables'

describe('customMarketingMergeVariables', () => {
  it('formats merge tokens', () => {
    assert.equal(customMarketingMergeToken('recipient.firstName'), '{{recipient.firstName}}')
    assert.equal(customMarketingMergeToken('{{user.firstName}}'), '{{user.firstName}}')
    assert.equal(customMarketingMergeToken('  '), '')
  })

  it('matches scopes and falls back when API list is empty', () => {
    assert.equal(
      customMarketingMergeVariableMatchesScope({ key: 'a', label: 'A', scopes: ['body'] }, 'body'),
      true
    )
    assert.equal(
      customMarketingMergeVariableMatchesScope({ key: 'a', label: 'A', scopes: ['subject'] }, 'body'),
      false
    )
    const resolved = resolveCustomMarketingMergeVariables([], 'body')
    assert.ok(resolved.length >= 1)
    assert.ok(resolved.some((v) => v.key === 'recipient.firstName'))
    assert.ok(CUSTOM_MARKETING_FALLBACK_MERGE_VARIABLES.length >= 1)
  })

  it('merges built-ins with API variables (API label wins on same key)', () => {
    const resolved = resolveCustomMarketingMergeVariables(
      [
        { key: 'recipient.firstName', label: 'First (CRM)', sourceType: 'recipient', scopes: ['body'] },
        { key: 'custom.field', label: 'Custom field', sourceType: 'recipient', scopes: ['body'] },
        { key: 'skip.me', label: 'Skip', enabled: false, scopes: ['body'] }
      ],
      'body'
    )
    assert.ok(resolved.some((v) => v.key === 'recipient.firstName' && v.label === 'First (CRM)'))
    assert.ok(resolved.some((v) => v.key === 'recipient.email'))
    assert.ok(resolved.some((v) => v.key === 'user.firstName'))
    assert.ok(resolved.some((v) => v.key === 'custom.field'))
    assert.ok(!resolved.some((v) => v.key === 'skip.me'))
  })

  it('groups recipient vs sender variables', () => {
    assert.equal(
      customMarketingMergeVariableCategory({ key: 'user.firstName', label: 'FN', sourceType: 'user' }),
      'Sender'
    )
    assert.equal(
      customMarketingMergeVariableCategory({ key: 'unsubscribe', label: 'Unsub', sourceType: 'recipient' }),
      'Other'
    )
    const grouped = groupCustomMarketingMergeVariables([
      { key: 'recipient.email', label: 'Email', sourceType: 'recipient' },
      { key: 'user.firstName', label: 'First', sourceType: 'user' },
      { key: 'unsubscribe', label: 'Unsub' }
    ])
    assert.equal(grouped.recipient.length, 1)
    assert.equal(grouped.sender.length, 1)
    assert.equal(grouped.other.length, 1)
  })
})
