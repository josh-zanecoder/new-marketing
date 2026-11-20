import { describe, expect, it } from 'vitest'
import {
  ADMIN_DELETED_FLYERS_HARD_DELETE_CONFIRM,
  ADMIN_DELETED_FLYERS_RECOVER_CONFIRM,
  ADMIN_DELETED_FLYERS_TAB_LABEL,
  buildAdminDeletedFlyerHardDeleteMessage,
  buildAdminDeletedFlyerRecoverMessage
} from '../adminDeletedFlyersCopy'

describe('adminDeletedFlyersCopy', () => {
  it('exposes tab and action labels', () => {
    expect(ADMIN_DELETED_FLYERS_TAB_LABEL).toBe('Deleted flyers')
    expect(ADMIN_DELETED_FLYERS_RECOVER_CONFIRM).toBe('Recover')
    expect(ADMIN_DELETED_FLYERS_HARD_DELETE_CONFIRM).toBe('Delete forever')
  })

  it('builds recover and hard-delete messages', () => {
    expect(buildAdminDeletedFlyerRecoverMessage('Rate Sheet')).toContain('Rate Sheet')
    expect(buildAdminDeletedFlyerHardDeleteMessage('Rate Sheet')).toContain('forever')
  })
})
