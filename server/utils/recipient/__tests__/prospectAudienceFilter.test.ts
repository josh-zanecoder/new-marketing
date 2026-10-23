import { describe, expect, it } from 'vitest'
import { buildContactFilterQuery } from '@server/utils/recipient/recipientListMembershipQuery'
import { registryDocToCriteria } from '@server/utils/recipient/recipientListNormalization'
import { distinctBrokerRoleLabels } from '~~/shared/utils/recipientFilterContactField'

describe('prospect audience filters', () => {
  it('expands a priority list into one criterion per value', () => {
    expect(
      registryDocToCriteria({
        property: 'priority',
        propertyType: 'none',
        propertyValue: 'HOT, WARM'
      })
    ).toEqual([
      { property: 'priority', value: 'HOT' },
      { property: 'priority', value: 'WARM' }
    ])
  })

  it('keeps an account owner email whole', () => {
    expect(
      registryDocToCriteria({
        property: 'account_owner',
        propertyType: 'none',
        propertyValue: 'ae@forge.example'
      })
    ).toEqual([{ property: 'account_owner', value: 'ae@forge.example' }])
  })

  it('matches one role inside a comma-separated broker role', () => {
    const query = buildContactFilterQuery(
      'prospect',
      [{ property: 'broker_role', value: 'Loan Officer' }],
      'and'
    ) as { $and?: Array<{ 'metadata.brokerRole'?: { $regex?: RegExp } }> }
    const regex = query.$and?.[0]?.['metadata.brokerRole']?.$regex
    expect(regex?.test('Loan Officer, Processor')).toBe(true)
    expect(regex?.test('processor')).toBe(false)
    expect(regex?.test('Senior Loan Officer')).toBe(false)
  })

  it('splits stored broker role strings into selectable roles', () => {
    expect(distinctBrokerRoleLabels(['Loan Officer, Processor', 'Processor', ' Owner '])).toEqual([
      'Loan Officer',
      'Owner',
      'Processor'
    ])
  })
})
