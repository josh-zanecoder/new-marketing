import { describe, expect, it } from 'vitest'
import {
  ACTIVE_FLYER_FILTER,
  DELETED_FLYER_FILTER,
  isFlyerSoftDeleted
} from '../flyerActive'

describe('flyerActive', () => {
  it('exports active filter matching email template soft-delete pattern', () => {
    expect(ACTIVE_FLYER_FILTER).toEqual({ deletedAt: null })
  })

  it('exports deleted filter for soft-deleted flyers', () => {
    expect(DELETED_FLYER_FILTER).toEqual({ deletedAt: { $ne: null } })
  })

  it('detects soft-deleted timestamps', () => {
    expect(isFlyerSoftDeleted(null)).toBe(false)
    expect(isFlyerSoftDeleted(undefined)).toBe(false)
    expect(isFlyerSoftDeleted('')).toBe(false)
    expect(isFlyerSoftDeleted(new Date())).toBe(true)
    expect(isFlyerSoftDeleted('2026-11-20T00:00:00.000Z')).toBe(true)
  })
})
