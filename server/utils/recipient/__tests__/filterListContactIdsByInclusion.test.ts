import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { filterListContactIdsByInclusion } from '../resolveRecipientListEmails'

const a = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
const b = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013')

describe('filterListContactIdsByInclusion', () => {
  it('keeps the duplicated selection that is still on the list', () => {
    expect(filterListContactIdsByInclusion([a, b], [String(a)]).map(String)).toEqual([String(a)])
  })

  it('keeps the whole list when the save did not send a selection', () => {
    expect(filterListContactIdsByInclusion([a, b], []).map(String)).toEqual([String(a), String(b)])
    expect(filterListContactIdsByInclusion([a, b], null).map(String)).toEqual([String(a), String(b)])
  })

  it('drops copied contacts that are no longer on the list', () => {
    expect(
      filterListContactIdsByInclusion([a], ['507f1f77bcf86cd799439099']).map(String)
    ).toEqual([])
  })
})
