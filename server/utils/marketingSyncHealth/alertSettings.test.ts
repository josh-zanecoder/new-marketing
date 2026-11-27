import { describe, expect, it } from 'vitest'
import { parseAlertEmailsInput } from './alertSettings'

describe('parseAlertEmailsInput', () => {
  it('parses comma and whitespace separated emails', () => {
    expect(parseAlertEmailsInput('ops@example.com, alerts@Example.com  other@x.io')).toEqual([
      'ops@example.com',
      'alerts@example.com',
      'other@x.io'
    ])
  })

  it('dedupes and drops invalid', () => {
    expect(parseAlertEmailsInput(['ops@example.com', 'not-an-email', 'OPS@example.com'])).toEqual([
      'ops@example.com'
    ])
  })

  it('returns empty for blank input', () => {
    expect(parseAlertEmailsInput('')).toEqual([])
    expect(parseAlertEmailsInput(null)).toEqual([])
  })
})
