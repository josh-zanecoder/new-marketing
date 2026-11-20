import { describe, expect, it } from 'vitest'
import {
  buildFlyerDeleteConfirmMessage,
  FLYER_DELETE_CONFIRM_TEXT,
  FLYER_DELETE_CONFIRM_TITLE,
  FLYER_UPLOAD_LOADER_HINTS,
  FLYER_UPLOAD_LOADER_HINT_ROTATE_MS,
  FLYER_UPLOAD_LOADER_TITLE
} from '../flyerUploadCopy'

describe('flyerUploadCopy', () => {
  it('exposes a friendly title and rotating hints', () => {
    expect(FLYER_UPLOAD_LOADER_TITLE.length).toBeGreaterThan(0)
    expect(FLYER_UPLOAD_LOADER_HINTS.length).toBeGreaterThan(1)
    expect(FLYER_UPLOAD_LOADER_HINTS.every((hint) => hint.length > 0)).toBe(true)
    expect(FLYER_UPLOAD_LOADER_HINT_ROTATE_MS).toBeGreaterThan(0)
  })

  it('builds delete confirmation copy', () => {
    expect(FLYER_DELETE_CONFIRM_TITLE.length).toBeGreaterThan(0)
    expect(FLYER_DELETE_CONFIRM_TEXT).toBe('Delete')
    const message = buildFlyerDeleteConfirmMessage('Christmas Promo')
    expect(message).toContain('Christmas Promo')
    expect(message).toContain('Custom Flyers library')
    expect(message).not.toContain('hosted file')
  })
})
