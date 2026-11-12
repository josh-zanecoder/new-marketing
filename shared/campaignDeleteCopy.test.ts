import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_DELETE_ERROR_FALLBACK,
  CAMPAIGN_DELETE_SUCCESS
} from './campaignDeleteCopy'

describe('campaignDeleteCopy', () => {
  it('uses the product success notification copy', () => {
    expect(CAMPAIGN_DELETE_SUCCESS).toBe('Campaign deleted successfully.')
    expect(CAMPAIGN_DELETE_ERROR_FALLBACK.length).toBeGreaterThan(10)
    expect(CAMPAIGN_DELETE_SUCCESS).not.toBe(CAMPAIGN_DELETE_ERROR_FALLBACK)
  })
})
