import { describe, expect, it } from 'vitest'
import { extractEmailsFromSpreadsheetRows } from '~~/shared/utils/parseUnsubscribeEmailSpreadsheet'
import { normalizeBulkUnsubscribeEmail } from '@server/utils/contact/bulkUnsubscribeContactsByEmail'

describe('extractEmailsFromSpreadsheetRows', () => {
  it('reads the Email column like the bulk template', () => {
    const result = extractEmailsFromSpreadsheetRows([
      ['Email'],
      ['tbowman@amerifirst.us'],
      ['  RSaraogi@EnsureHomeLoans.com '],
      [''],
      ['not-an-address']
    ])
    expect(result.foundEmailColumn).toBe(true)
    expect(result.emails).toEqual([
      'tbowman@amerifirst.us',
      'RSaraogi@EnsureHomeLoans.com',
      'not-an-address'
    ])
  })

  it('finds Email when it is not the first column', () => {
    const result = extractEmailsFromSpreadsheetRows([
      ['Name', 'Email', 'Note'],
      ['Ada', 'ada@example.com', 'x']
    ])
    expect(result.emails).toEqual(['ada@example.com'])
  })
})

describe('normalizeBulkUnsubscribeEmail', () => {
  it('lowercases valid emails', () => {
    expect(normalizeBulkUnsubscribeEmail('Ada@Example.COM')).toBe('ada@example.com')
  })

  it('rejects invalid values', () => {
    expect(normalizeBulkUnsubscribeEmail('not-an-address')).toBeNull()
    expect(normalizeBulkUnsubscribeEmail('')).toBeNull()
  })
})
