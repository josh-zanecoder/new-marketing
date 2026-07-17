import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultScheduleDatetimeLocal,
  parseDatetimeLocalToIso,
  toDatetimeLocalValue
} from '../datetimeLocal'

describe('datetimeLocal', () => {
  it('formats local datetime for datetime-local inputs', () => {
    const d = new Date(2026, 6, 18, 9, 5)
    assert.equal(toDatetimeLocalValue(d), '2026-07-18T09:05')
  })

  it('defaults schedule time about 65 minutes ahead', () => {
    const from = Date.now()
    const local = defaultScheduleDatetimeLocal(from)
    const parsed = new Date(local)
    const delta = parsed.getTime() - from
    assert.ok(delta >= 64 * 60 * 1000)
    assert.ok(delta <= 66 * 60 * 1000)
  })

  it('parses datetime-local to ISO or null', () => {
    assert.equal(parseDatetimeLocalToIso(''), null)
    assert.equal(parseDatetimeLocalToIso('not-a-date'), null)
    const iso = parseDatetimeLocalToIso('2026-07-18T10:30')
    assert.ok(iso)
    assert.equal(new Date(iso!).toISOString(), iso)
  })
})
