import { describe, expect, it } from 'vitest'
import {
  ACTIVE_EMAIL_TEMPLATE_FILTER,
  DELETED_EMAIL_TEMPLATE_FILTER,
  isEmailTemplateSoftDeleted
} from '~~/shared/utils/emailTemplateActive'

describe('emailTemplateActive', () => {
  it('exports active filter matching contacts soft-delete pattern', () => {
    expect(ACTIVE_EMAIL_TEMPLATE_FILTER).toEqual({ deletedAt: null })
  })

  it('exports deleted filter for admin trash list', () => {
    expect(DELETED_EMAIL_TEMPLATE_FILTER).toEqual({ deletedAt: { $ne: null } })
  })

  it('detects soft-deleted timestamps', () => {
    expect(isEmailTemplateSoftDeleted(null)).toBe(false)
    expect(isEmailTemplateSoftDeleted(undefined)).toBe(false)
    expect(isEmailTemplateSoftDeleted('')).toBe(false)
    expect(isEmailTemplateSoftDeleted(new Date())).toBe(true)
    expect(isEmailTemplateSoftDeleted('2026-07-21T00:00:00.000Z')).toBe(true)
  })
})
